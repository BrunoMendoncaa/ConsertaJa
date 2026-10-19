import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

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

export async function listAssistances() {
  const { data, error } = await createAdminClient().rpc('admin_assistances');
  check(error, 'admin_assistances');
  return data || [];
}

export async function listUsers() {
  const { data, error } = await createAdminClient().rpc('admin_users');
  check(error, 'admin_users');
  return data || [];
}

/** Pagamentos aprovados desde uma data (para "recebido no mês"). */
export async function approvedPaymentsSince(isoDate) {
  const { data, error } = await createAdminClient()
    .from('billing_payments').select('amount, paid_at, assistance_id')
    .eq('status', 'approved').gte('paid_at', isoDate);
  check(error, 'billing_payments');
  return data || [];
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

export async function recentAdminActions(limit = 8) {
  const { data, error } = await createAdminClient()
    .from('admin_audit_log').select('id, admin_username, action, assistance_id, details, created_at')
    .neq('action', 'login').order('created_at', { ascending: false }).limit(limit);
  check(error, 'admin_audit_log');
  return data || [];
}

export async function getAssistanceDetail(id) {
  const db = createAdminClient();
  const [list, members, subs, payments, audit] = await Promise.all([
    listAssistances(),
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
  return { assistance, members: members.data || [], subscriptions: subs.data || [], payments: payments.data || [], audit: audit.data || [] };
}
