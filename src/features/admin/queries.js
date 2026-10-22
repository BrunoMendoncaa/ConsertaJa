import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { isTestUser } from './format';

// Leituras da área admin. Sempre com a chave secreta (ignora o RLS), por isso só
// são chamadas depois de requireAdmin(). As funções admin_* vêm da migration 0015.

export class AdminSetupError extends Error {}

function check(error, what) {
  if (!error) return;
  // Função ou tabela ainda não existe: a migration 0015 não foi aplicada no banco.
  if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code)) {
    throw new AdminSetupError('O banco ainda não tem a atualização da área admin (migration 0015).');
  }
  throw new Error(`${what}: ${error.message}`);
}

async function allAssistances() {
  const { data, error } = await createAdminClient().rpc('admin_assistances');
  check(error, 'admin_assistances');
  return data || [];
}

/**
 * Assistências de verdade (clientes). Contas de teste (is_test, migration 0019) ficam
 * fora de todos os números, listas e da planilha: aparecem só em Acessos → Aplicação.
 */
export async function listAssistances() {
  return (await allAssistances()).filter((a) => !a.is_test);
}

/** Contas de teste da aplicação (criadas na área admin ou marcadas como teste). */
export async function listTestAssistances() {
  return (await allAssistances()).filter((a) => a.is_test);
}

export async function listUsers() {
  const { data, error } = await createAdminClient().rpc('admin_users');
  check(error, 'admin_users');
  return (data || []).filter((u) => !isTestUser(u));
}

/** Pagamentos aprovados desde uma data (para "recebido no mês"), sem os de contas de teste. */
export async function approvedPaymentsSince(isoDate) {
  const db = createAdminClient();
  const [{ data, error }, tests] = await Promise.all([
    db.from('billing_payments').select('amount, paid_at, assistance_id').eq('status', 'approved').gte('paid_at', isoDate),
    db.from('assistances').select('id').eq('is_test', true),
  ]);
  check(error, 'billing_payments');
  // Sem a migration 0019 a coluna is_test não existe: nenhuma conta é de teste.
  const testIds = new Set(tests.error ? [] : (tests.data || []).map((t) => t.id));
  return (data || []).filter((p) => !testIds.has(p.assistance_id));
}

export class SiteSetupError extends Error {}

/** Acessos do site (migration 0016) desde uma data, em páginas de 1000 linhas. */
export async function siteEventsSince(isoDate, cap = 100000) {
  const db = createAdminClient();
  const cols = 'created_at, event, path, label, visitor, session, referrer_host, utm_source, utm_medium, utm_campaign, device, browser, os, country, region, city';
  const out = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await db.from('site_events').select(cols).gte('created_at', isoDate)
      .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, from + 999);
    if (error) {
      if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code)) {
        throw new SiteSetupError('O banco ainda não tem a contagem de acessos do site (migration 0016).');
      }
      throw new Error(`site_events: ${error.message}`);
    }
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Últimas ações registradas (sem os logins). Com username, só as dessa conta. */
export async function recentAdminActions(limit = 8, username = null) {
  let q = createAdminClient()
    .from('admin_audit_log').select('id, admin_username, action, assistance_id, details, created_at')
    .neq('action', 'login');
  if (username) q = q.eq('admin_username', username);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  check(error, 'admin_audit_log');
  return data || [];
}

export class AccountsSetupError extends Error {}

function checkAccounts(error, what) {
  if (!error) return;
  if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code)) {
    throw new AccountsSetupError('O banco ainda não tem a tabela de acessos da área admin (migration 0017).');
  }
  throw new Error(`${what}: ${error.message}`);
}

const ACCOUNT_FIELDS = 'id, username, full_name, permissions, active, must_change_password, last_login_at, created_at, created_by, updated_at, password_changed_at';

/** Contas de acesso à área admin (sem o hash da senha). */
export async function listAdminAccounts() {
  const { data, error } = await createAdminClient().from('admin_accounts').select(ACCOUNT_FIELDS).order('full_name');
  checkAccounts(error, 'admin_accounts');
  return data || [];
}

export async function getAdminAccount(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) return null;
  const db = createAdminClient();
  const { data, error } = await db.from('admin_accounts').select(ACCOUNT_FIELDS).eq('id', id).maybeSingle();
  checkAccounts(error, 'admin_accounts');
  if (!data) return null;
  const { data: log, error: logErr } = await db.from('admin_audit_log')
    .select('id, admin_username, action, assistance_id, details, created_at')
    .or(`admin_username.eq.${data.username},details->>target.eq.${data.username}`)
    // Só desta conta: um acesso antigo excluído com o mesmo usuário não aparece aqui.
    .gte('created_at', data.created_at)
    .order('created_at', { ascending: false }).limit(20);
  check(logErr, 'admin_audit_log');
  return { ...data, log: log || [] };
}

export async function getAssistanceDetail(id) {
  const db = createAdminClient();
  const [list, members, subs, payments, audit] = await Promise.all([
    allAssistances(),
    db.rpc('admin_assistance_members', { p_assistance_id: id }),
    db.from('billing_subscriptions').select('id, provider_id, cycle, amount, payer_email, status, created_at, last_synced_at')
      .eq('assistance_id', id).order('created_at', { ascending: false }).limit(20),
    db.from('billing_payments').select('id, provider_id, payment_id, amount, status, paid_at, created_at')
      .eq('assistance_id', id).order('created_at', { ascending: false }).limit(30),
    db.from('admin_audit_log').select('id, admin_username, action, details, created_at')
      .eq('assistance_id', id).order('created_at', { ascending: false }).limit(30),
  ]);
  check(members.error, 'admin_assistance_members');
  check(subs.error, 'billing_subscriptions');
  check(payments.error, 'billing_payments');
  check(audit.error, 'admin_audit_log');
  const assistance = list.find((a) => a.id === id);
  if (!assistance) return null;
  const team = members.data || [];
  // Conta de teste: quais logins só existem nela (são apagados junto na exclusão).
  let onlyHere = [];
  if (assistance.is_test && team.length) {
    const { data: rows, error } = await db.from('assistance_members').select('user_id').in('user_id', team.map((m) => m.user_id));
    check(error, 'assistance_members');
    const count = {};
    for (const r of rows || []) count[r.user_id] = (count[r.user_id] || 0) + 1;
    onlyHere = team.filter((m) => count[m.user_id] === 1).map((m) => m.user_id);
  }
  return {
    assistance, members: team, onlyHere, subscriptions: subs.data || [], payments: payments.data || [], audit: audit.data || [],
  };
}
