'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncAssistance } from '@/features/billing/sync';
import { logError } from '@/lib/logger';
import { adminConfig, actionSession, clientIp, ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS } from './session';
import { signSession } from './token';
import { verifyPassword, safeEqual, dummyHash } from './password';
import { USERNAME_RE } from './permissions';
import { audit } from './audit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SETUP_CODES = ['PGRST202', 'PGRST205', '42883', '42P01'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 86400000;

function idFrom(formData) {
  const id = String(formData.get('assistance_id') || '');
  return UUID_RE.test(id) ? id : null;
}

async function loadAssistance(db, id) {
  const { data, error } = await db.from('assistances')
    .select('id, name, subscription_status, trial_ends_at, paid_until, mp_preapproval_id').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------- Login
export async function adminSignIn(_prev, formData) {
  const cfg = adminConfig();
  if (!cfg) return { ok: false, error: 'A área admin ainda não foi configurada (variáveis ADMIN_* na Vercel).' };

  const username = String(formData.get('username') || '').trim().toLowerCase().slice(0, 60);
  const password = String(formData.get('password') || '').slice(0, 200);
  const ip = await clientIp();
  const db = createAdminClient();

  // Limite contra força bruta: 5 erros por IP ou 20 no total em 15 minutos.
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const [byIp, total] = await Promise.all([
    ip
      ? db.from('admin_login_attempts').select('id', { count: 'exact', head: true }).eq('ip', ip).eq('success', false).gte('created_at', since)
      : Promise.resolve({ count: 0 }),
    db.from('admin_login_attempts').select('id', { count: 'exact', head: true }).eq('success', false).gte('created_at', since),
  ]);
  const setupError = [byIp.error, total.error].find(Boolean);
  if (setupError) {
    if (SETUP_CODES.includes(setupError.code)) return { ok: false, error: 'Aplique a migration 0015 (área admin) no Supabase antes de entrar.' };
    logError('admin.signIn', setupError);
    return { ok: false, error: 'Não foi possível entrar agora. Tente de novo.' };
  }
  if ((byIp.count ?? 0) >= 5 || (total.count ?? 0) >= 20) {
    return { ok: false, error: 'Muitas tentativas. Aguarde 15 minutos e tente de novo.' };
  }

  // A master (variáveis ADMIN_*) ou uma conta criada na tela Acessos (tabela admin_accounts).
  // A senha é conferida sempre (mesmo tempo de resposta para usuário inexistente ou senha errada).
  const isMaster = safeEqual(username, cfg.username);
  let account = null;
  if (!isMaster && USERNAME_RE.test(username)) {
    const { data, error } = await db.from('admin_accounts')
      .select('id, username, password_hash, active, must_change_password, session_version')
      .eq('username', username).maybeSingle();
    if (error && !SETUP_CODES.includes(error.code)) {
      logError('admin.signIn.account', error);
      return { ok: false, error: 'Não foi possível entrar agora. Tente de novo.' };
    }
    account = data;
  }
  const passOk = verifyPassword(password, isMaster ? cfg.hash : (account?.password_hash || dummyHash()));
  const ok = passOk && (isMaster || Boolean(account?.active));
  await db.from('admin_login_attempts').insert({ username: username || null, ip, success: ok });
  if (!ok) {
    await sleep(400);
    return { ok: false, error: 'Usuário ou senha incorretos.' };
  }

  const jar = await cookies();
  if (isMaster) {
    jar.set(ADMIN_COOKIE, signSession(cfg), ADMIN_COOKIE_OPTIONS);
    await audit(db, cfg.username, 'login', null);
    redirect('/admin');
  }
  jar.set(ADMIN_COOKIE, signSession(cfg, Date.now(), account), ADMIN_COOKIE_OPTIONS);
  await db.from('admin_accounts').update({ last_login_at: new Date().toISOString() }).eq('id', account.id);
  await audit(db, account.username, 'login', null);
  redirect(account.must_change_password ? '/admin/minha-senha' : '/admin');
}

export async function adminSignOut() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, '', { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
  redirect('/admin/entrar');
}

// ---------------------------------------------------------------- Ações em assistências
export async function extendTrial(_prev, formData) {
  const auth = await actionSession('assistencias_estender_teste');
  if (auth.error) return { ok: false, error: auth.error };
  const { username } = auth.session;
  const id = idFrom(formData);
  const days = Number(formData.get('days'));
  const note = String(formData.get('note') || '').trim().slice(0, 200);
  if (!id) return { ok: false, error: 'Assistência inválida.' };
  if (!Number.isInteger(days) || days < 1 || days > 365) return { ok: false, error: 'Escolha de 1 a 365 dias.' };

  const db = createAdminClient();
  const a = await loadAssistance(db, id);
  if (!a) return { ok: false, error: 'Assistência não encontrada.' };
  const base = Math.max(new Date(a.trial_ends_at).getTime(), Date.now());
  const until = new Date(base + days * DAY).toISOString();
  const { error } = await db.from('assistances').update({ trial_ends_at: until }).eq('id', id);
  if (error) { logError('admin.extendTrial', error, { id }); return { ok: false, error: 'Não foi possível estender o teste.' }; }

  await audit(db, username, 'extend_trial', id, { from: a.trial_ends_at, to: until, days, note: note || undefined });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: `Teste estendido por ${days} dia(s).` };
}

export async function suspendAssistance(_prev, formData) {
  const auth = await actionSession('assistencias_suspender');
  if (auth.error) return { ok: false, error: auth.error };
  const { username } = auth.session;
  const id = idFrom(formData);
  const reason = String(formData.get('reason') || '').trim().slice(0, 300);
  if (!id) return { ok: false, error: 'Assistência inválida.' };
  if (reason.length < 3) return { ok: false, error: 'Informe o motivo da suspensão.', fieldErrors: { reason: 'Informe o motivo.' } };

  const db = createAdminClient();
  const a = await loadAssistance(db, id);
  if (!a) return { ok: false, error: 'Assistência não encontrada.' };
  if (a.subscription_status === 'suspended') return { ok: false, error: 'Esta assistência já está suspensa.' };
  const { error } = await db.from('assistances').update({ subscription_status: 'suspended' }).eq('id', id);
  if (error) { logError('admin.suspend', error, { id }); return { ok: false, error: 'Não foi possível suspender.' }; }

  await audit(db, username, 'suspend', id, { previous_status: a.subscription_status, reason });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Assistência suspensa. A equipe e o portal dos clientes ficam bloqueados.' };
}

export async function reactivateAssistance(_prev, formData) {
  const auth = await actionSession('assistencias_suspender');
  if (auth.error) return { ok: false, error: auth.error };
  const { username } = auth.session;
  const id = idFrom(formData);
  if (!id) return { ok: false, error: 'Assistência inválida.' };

  const db = createAdminClient();
  const a = await loadAssistance(db, id);
  if (!a) return { ok: false, error: 'Assistência não encontrada.' };
  if (a.subscription_status !== 'suspended') return { ok: false, error: 'Esta assistência não está suspensa.' };

  // Volta ao status de antes da suspensão (registrado na ação de suspender).
  const { data: last } = await db.from('admin_audit_log').select('details')
    .eq('assistance_id', id).eq('action', 'suspend').order('created_at', { ascending: false }).limit(1);
  const previous = last?.[0]?.details?.previous_status;
  const fallback = a.paid_until && new Date(a.paid_until) > new Date() ? 'active' : 'trialing';
  const restored = ['trialing', 'active', 'past_due', 'canceled'].includes(previous) ? previous : fallback;

  const { error } = await db.from('assistances').update({ subscription_status: restored }).eq('id', id);
  if (error) { logError('admin.reactivate', error, { id }); return { ok: false, error: 'Não foi possível reativar.' }; }

  // Com assinatura no Mercado Pago, confere de novo para acertar a situação.
  let sync = null;
  if (a.mp_preapproval_id) {
    try { sync = await syncAssistance(id); } catch (err) { sync = 'falhou'; logError('admin.reactivate.sync', err, { id }); }
  }
  await audit(db, username, 'reactivate', id, { restored_status: restored, sync });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Assistência reativada.' };
}

export async function syncWithMercadoPago(_prev, formData) {
  const auth = await actionSession('assistencias_mercado_pago');
  if (auth.error) return { ok: false, error: auth.error };
  const { username } = auth.session;
  const id = idFrom(formData);
  if (!id) return { ok: false, error: 'Assistência inválida.' };

  const db = createAdminClient();
  const { count } = await db.from('billing_subscriptions').select('id', { count: 'exact', head: true }).eq('assistance_id', id);
  if (!count) return { ok: false, error: 'Esta assistência ainda não tem assinatura no Mercado Pago.' };
  try {
    const access = await syncAssistance(id);
    await audit(db, username, 'sync_mp', id, { access });
    revalidatePath('/admin', 'layout');
    return { ok: true, message: 'Conferido no Mercado Pago. Situação atualizada.' };
  } catch (err) {
    logError('admin.syncMp', err, { id });
    return { ok: false, error: 'Não foi possível consultar o Mercado Pago agora.' };
  }
}
