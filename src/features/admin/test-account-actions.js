'use server';

// Contas de teste da aplicação (só a conta master). A conta de teste é uma assistência
// marcada como teste (migration 0019): não conta nos números da área admin, não assina e
// tem o plano escolhido aqui. Só conta de teste pode ser excluída.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE_URL } from '@/lib/supabase/env';
import { logError } from '@/lib/logger';
import { slugify } from '@/lib/slug';
import { actionSession } from './session';
import { audit } from './audit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SETUP_CODES = ['PGRST202', 'PGRST205', '42883', '42P01', '42703'];
const SETUP_MESSAGE = 'O banco ainda não tem as contas de teste. Aplique a migration 20261023120000_contas_teste.sql no Supabase.';
const PLANS = ['pro', 'free'];

const text = (formData, key, max) => String(formData.get(key) || '').trim().slice(0, max);
const uuid = (formData, key) => {
  const v = String(formData.get(key) || '');
  return UUID_RE.test(v) ? v : null;
};
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Mensagens do banco (P0001/P0002) já são escritas para a tela. */
function dbMessage(error, fallback) {
  if (!error) return null;
  if (SETUP_CODES.includes(error.code)) return SETUP_MESSAGE;
  if (['P0001', 'P0002'].includes(error.code) && error.message) return error.message;
  return fallback;
}

async function loadTest(db, id) {
  const { data, error } = await db.from('assistances').select('id, name, slug, is_test, test_plan').eq('id', id).maybeSingle();
  if (error) {
    if (SETUP_CODES.includes(error.code)) return { error: SETUP_MESSAGE };
    throw error;
  }
  if (!data) return { error: 'Assistência não encontrada.' };
  return { assistance: data };
}

// ---------------------------------------------------------------- Criar
export async function createTestAccount(_prev, formData) {
  const auth = await actionSession('master');
  if (auth.error) return { ok: false, error: auth.error };

  const name = text(formData, 'assistance_name', 120);
  const fullName = text(formData, 'full_name', 80);
  const email = text(formData, 'email', 200).toLowerCase();
  const password = String(formData.get('password') || '');
  const plan = String(formData.get('plan') || '');

  const fieldErrors = {};
  if (name.length < 2) fieldErrors.assistance_name = 'Informe o nome da assistência.';
  if (fullName.length < 2) fieldErrors.full_name = 'Informe o nome da pessoa.';
  if (!EMAIL_RE.test(email)) fieldErrors.email = 'E-mail inválido.';
  if (password.length < 8) fieldErrors.password = 'Mínimo de 8 caracteres.';
  if (password.length > 72) fieldErrors.password = 'Máximo de 72 caracteres.';
  if (!PLANS.includes(plan)) fieldErrors.plan = 'Escolha o plano.';
  if (Object.keys(fieldErrors).length) return { ok: false, error: 'Confira os campos destacados.', fieldErrors };

  const db = createAdminClient();
  const { data: created, error: userError } = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (userError || !created?.user) {
    if (userError?.code === 'email_exists' || /already|registered|exists/i.test(userError?.message || '')) {
      return { ok: false, error: 'Já existe um login com este e-mail.', fieldErrors: { email: 'Já existe um login com este e-mail.' } };
    }
    logError('admin.testAccount.createUser', userError);
    return { ok: false, error: 'Não foi possível criar o login agora. Tente de novo.' };
  }

  const userId = created.user.id;
  const { data: id, error } = await db.rpc('admin_create_test_assistance', {
    p_user_id: userId, p_name: name, p_slug: slugify(name), p_plan: plan, p_full_name: fullName,
  });
  if (error) {
    // Sem a assistência, o login sozinho não serve: desfaz.
    await db.auth.admin.deleteUser(userId).catch((err) => logError('admin.testAccount.rollback', err));
    const message = dbMessage(error, 'Não foi possível criar a conta de teste agora. Tente de novo.');
    if (message === SETUP_MESSAGE || error.code !== 'P0001') logError('admin.testAccount.create', error);
    return { ok: false, error: message };
  }

  await audit(db, auth.session.username, 'test_create', id, { name, email, plan });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: `Conta de teste criada. Entre em ${SITE_URL.replace(/^https?:\/\//, '')}/entrar com ${email} e a senha informada.` };
}

// ---------------------------------------------------------------- Plano e marca de teste
export async function setTestPlan(_prev, formData) {
  const auth = await actionSession('master');
  if (auth.error) return { ok: false, error: auth.error };
  const id = uuid(formData, 'assistance_id');
  const plan = String(formData.get('plan') || '');
  if (!id || !PLANS.includes(plan)) return { ok: false, error: 'Escolha o plano.' };

  const db = createAdminClient();
  const found = await loadTest(db, id);
  if (found.error) return { ok: false, error: found.error };
  if (!found.assistance.is_test) return { ok: false, error: 'Esta assistência não é conta de teste.' };
  if (found.assistance.test_plan === plan) return { ok: true, message: 'O plano já era esse.' };

  const { error } = await db.rpc('admin_set_test_assistance', { p_id: id, p_is_test: true, p_plan: plan });
  if (error) { logError('admin.testAccount.plan', error, { id }); return { ok: false, error: dbMessage(error, 'Não foi possível trocar o plano.') }; }
  await audit(db, auth.session.username, 'test_plan', id, { from: found.assistance.test_plan, to: plan });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: plan === 'pro' ? 'Conta de teste no Pro (tudo liberado).' : 'Conta de teste no Grátis (com os limites do plano).' };
}

export async function markAsTest(_prev, formData) {
  const auth = await actionSession('master');
  if (auth.error) return { ok: false, error: auth.error };
  const id = uuid(formData, 'assistance_id');
  const plan = String(formData.get('plan') || 'pro');
  if (!id || !PLANS.includes(plan)) return { ok: false, error: 'Assistência inválida.' };

  const db = createAdminClient();
  const found = await loadTest(db, id);
  if (found.error) return { ok: false, error: found.error };
  if (found.assistance.is_test) return { ok: true, message: 'Já é conta de teste.' };

  const { error } = await db.rpc('admin_set_test_assistance', { p_id: id, p_is_test: true, p_plan: plan });
  if (error) {
    if (error.code !== 'P0001') logError('admin.testAccount.mark', error, { id });
    return { ok: false, error: dbMessage(error, 'Não foi possível marcar como teste.') };
  }
  await audit(db, auth.session.username, 'test_mark', id, { plan });
  revalidatePath('/admin', 'layout');
  // O cartão da página muda (vira conta de teste): o aviso vai no topo, pela URL.
  redirect(`/admin/tecnofix/assistencias/${id}?aviso=teste`);
}

export async function unmarkTest(_prev, formData) {
  const auth = await actionSession('master');
  if (auth.error) return { ok: false, error: auth.error };
  const id = uuid(formData, 'assistance_id');
  if (!id) return { ok: false, error: 'Assistência inválida.' };

  const db = createAdminClient();
  const found = await loadTest(db, id);
  if (found.error) return { ok: false, error: found.error };
  if (!found.assistance.is_test) return { ok: true, message: 'Já conta como assistência.' };

  const { error } = await db.rpc('admin_set_test_assistance', { p_id: id, p_is_test: false, p_plan: null });
  if (error) { logError('admin.testAccount.unmark', error, { id }); return { ok: false, error: dbMessage(error, 'Não foi possível desfazer.') }; }
  await audit(db, auth.session.username, 'test_unmark', id, {});
  revalidatePath('/admin', 'layout');
  redirect(`/admin/tecnofix/assistencias/${id}?aviso=real`);
}

// ---------------------------------------------------------------- Senha de um login da conta de teste
export async function resetTestPassword(_prev, formData) {
  const auth = await actionSession('master');
  if (auth.error) return { ok: false, error: auth.error };
  const id = uuid(formData, 'assistance_id');
  const userId = uuid(formData, 'user_id');
  const password = String(formData.get('password') || '');
  if (!id || !userId) return { ok: false, error: 'Login inválido.' };
  if (password.length < 8 || password.length > 72) {
    return { ok: false, error: 'A senha precisa ter de 8 a 72 caracteres.', fieldErrors: { password: 'De 8 a 72 caracteres.' } };
  }

  const db = createAdminClient();
  const found = await loadTest(db, id);
  if (found.error) return { ok: false, error: found.error };
  if (!found.assistance.is_test) return { ok: false, error: 'Só dá para trocar a senha de logins de contas de teste.' };

  // Só login que participa apenas de contas de teste (nunca a senha de um cliente real).
  const { data: rows, error } = await db.from('assistance_members').select('assistance_id, assistances(is_test)').eq('user_id', userId);
  if (error) { logError('admin.testAccount.password.check', error); return { ok: false, error: 'Não foi possível conferir o login.' }; }
  const memberships = rows || [];
  if (!memberships.some((r) => r.assistance_id === id)) return { ok: false, error: 'Este login não é desta conta de teste.' };
  if (!memberships.every((r) => r.assistances?.is_test)) {
    return { ok: false, error: 'Este login também participa de uma assistência real. A senha dele não pode ser trocada por aqui.' };
  }

  const { error: upError } = await db.auth.admin.updateUserById(userId, { password });
  if (upError) { logError('admin.testAccount.password', upError); return { ok: false, error: 'Não foi possível trocar a senha agora.' }; }
  await audit(db, auth.session.username, 'test_password', id, {});
  return { ok: true, message: 'Senha trocada.' };
}

// ---------------------------------------------------------------- Excluir
export async function deleteTestAccount(_prev, formData) {
  const auth = await actionSession('master');
  if (auth.error) return { ok: false, error: auth.error };
  const id = uuid(formData, 'assistance_id');
  const typed = text(formData, 'confirm_name', 160);
  if (!id) return { ok: false, error: 'Assistência inválida.' };

  const db = createAdminClient();
  const found = await loadTest(db, id);
  if (found.error) return { ok: false, error: found.error };
  const a = found.assistance;
  if (!a.is_test) return { ok: false, error: 'Só contas de teste podem ser excluídas. Marque como conta de teste antes.' };
  if (norm(typed) !== norm(a.name)) {
    return { ok: false, error: 'Digite o nome da assistência para confirmar.', fieldErrors: { confirm_name: `Digite: ${a.name}` } };
  }

  const { data: team } = await db.rpc('admin_assistance_members', { p_assistance_id: id });

  // 1. Fotos e logo (o Supabase só deixa apagar arquivos pela API do Storage).
  const { data: files, error: filesError } = await db.rpc('admin_test_assistance_files', { p_id: id });
  if (filesError) {
    logError('admin.testAccount.files', filesError, { id });
    return { ok: false, error: dbMessage(filesError, 'Não foi possível listar as fotos. Nada foi excluído.') };
  }
  const byBucket = {};
  for (const f of files || []) (byBucket[f.bucket_id] ||= []).push(f.name);
  for (const [bucket, names] of Object.entries(byBucket)) {
    for (let i = 0; i < names.length; i += 100) {
      const { error } = await db.storage.from(bucket).remove(names.slice(i, i + 100));
      if (error) {
        logError('admin.testAccount.storage', error, { id, bucket });
        return { ok: false, error: 'Não foi possível apagar as fotos agora. A conta continua aqui; tente de novo.' };
      }
    }
  }

  // 2. Tudo da assistência no banco, na ordem certa.
  const { data: orphanIds, error: purgeError } = await db.rpc('admin_purge_test_assistance', { p_id: id });
  if (purgeError) {
    logError('admin.testAccount.purge', purgeError, { id });
    return { ok: false, error: dbMessage(purgeError, 'Não foi possível excluir a conta agora. Tente de novo.') };
  }

  // 3. Logins que só existiam nesta conta.
  const orphans = orphanIds || [];
  const kept = [];
  for (const userId of orphans) {
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) { kept.push(userId); logError('admin.testAccount.deleteUser', error, { userId }); }
  }
  const emailOf = (uid) => (team || []).find((m) => m.user_id === uid)?.email || uid;
  await audit(db, auth.session.username, 'test_delete', null, {
    name: a.name, slug: a.slug, files: (files || []).length,
    logins: orphans.filter((u) => !kept.includes(u)).map(emailOf),
    logins_not_deleted: kept.length ? kept.map(emailOf) : undefined,
  });

  revalidatePath('/admin', 'layout');
  const params = new URLSearchParams({ tipo: 'tecnofix', excluida: a.name });
  if (kept.length) params.set('logins_mantidos', String(kept.length));
  redirect(`/admin/acessos?${params}`);
}
