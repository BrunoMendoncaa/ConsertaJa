import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPreapproval, listAuthorizedPayments, cancelPreapproval } from '@/lib/mercadopago';
import { mapPreapprovalStatus, mapAuthorizedPayments } from '@/features/billing/mp-utils';
import { logError } from '@/lib/logger';

const PENDING_DAYS = 3; // checkout aberto e não concluído: confere por alguns dias

/**
 * Busca a assinatura e as faturas NO MERCADO PAGO (nunca confia no corpo do webhook
 * nem em parâmetros da URL) e grava no banco pela função billing_apply_sync.
 * Retorna a situação de acesso da assistência ('trial' | 'active' | 'grace' | 'blocked').
 */
export async function syncSubscription(preapprovalId) {
  const pre = await getPreapproval(preapprovalId);
  const invoices = await listAuthorizedPayments(preapprovalId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('billing_apply_sync', {
    p_provider_id: String(pre.id),
    p_external_reference: pre.external_reference ?? null,
    p_status: mapPreapprovalStatus(pre.status),
    p_payments: mapAuthorizedPayments(invoices),
  });
  if (error) throw error;
  return data;
}

/** Assistência dona de uma assinatura (null se não for nossa). */
export async function assistanceIdOf(preapprovalId) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('billing_subscriptions')
    .select('assistance_id')
    .eq('provider', 'mercadopago')
    .eq('provider_id', String(preapprovalId))
    .maybeSingle();
  return data?.assistance_id ?? null;
}

/**
 * Uma assinatura por assistência: se além da vigente ainda houver outra autorizada
 * (ex.: o dono assinou duas vezes), cancela a sobra no Mercado Pago para não cobrar
 * em dobro. Só age quando a vigente está ativa no Mercado Pago (autorizada ou pausada).
 * Erros são registrados e não interrompem (a conferência diária tenta de novo).
 */
export async function cancelSupersededSubscriptions(assistanceId) {
  const admin = createAdminClient();
  const { data: a } = await admin.from('assistances').select('mp_preapproval_id').eq('id', assistanceId).maybeSingle();
  if (!a?.mp_preapproval_id) return 0;
  const { data: subs, error } = await admin
    .from('billing_subscriptions')
    .select('provider_id, status')
    .eq('assistance_id', assistanceId)
    .in('status', ['authorized', 'paused']);
  if (error) throw error;
  const current = (subs || []).find((s) => s.provider_id === a.mp_preapproval_id);
  if (!current) return 0; // vigente cancelada/pendente: a próxima conferência escolhe a nova vigente
  let canceled = 0;
  for (const s of subs) {
    if (s.provider_id === a.mp_preapproval_id) continue;
    try {
      await cancelPreapproval(s.provider_id);
      await syncSubscription(s.provider_id);
      canceled += 1;
      console.info(JSON.stringify({ level: 'info', context: 'billing.dedupe', message: 'assinatura duplicada cancelada no Mercado Pago',
        assistanceId, preapprovalId: s.provider_id, kept: a.mp_preapproval_id, at: new Date().toISOString() }));
    } catch (error) {
      if (error?.status === 404) continue; // não existe nesta conta do Mercado Pago (ex.: assinatura de teste)
      logError('billing.dedupe', error, { assistanceId, preapprovalId: s.provider_id, mp: error?.details });
    }
  }
  return canceled;
}

/**
 * Confere todas as assinaturas que importam de uma assistência: as autorizadas/pausadas
 * e os pagamentos iniciados nos últimos dias. Depois cancela duplicadas.
 * Usado na volta do checkout e no botão "Verificar pagamento".
 */
export async function syncAssistance(assistanceId) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - PENDING_DAYS * 86400000).toISOString();
  const { data: subs, error } = await admin
    .from('billing_subscriptions')
    .select('provider_id, status, created_at')
    .eq('assistance_id', assistanceId)
    .or(`status.in.(authorized,paused),and(status.eq.pending,created_at.gte."${since}")`)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;

  let access = null;
  let lastError = null;
  let synced = 0;
  for (const s of subs || []) {
    try {
      access = await syncSubscription(s.provider_id);
      synced += 1;
    } catch (err) {
      if (err?.status === 404) continue;
      lastError = err;
      logError('billing.syncAssistance', err, { assistanceId, preapprovalId: s.provider_id, mp: err?.details });
    }
  }
  if (lastError && synced === 0) throw lastError;
  if (synced > 0) await cancelSupersededSubscriptions(assistanceId);
  return access;
}
