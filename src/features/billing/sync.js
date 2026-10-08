import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPreapproval, listAuthorizedPayments } from '@/lib/mercadopago';
import { mapPreapprovalStatus, mapAuthorizedPayments } from '@/features/billing/mp-utils';

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

/** Sincroniza as assinaturas recentes de uma assistência (retorno do checkout / botão "Atualizar"). */
export async function syncAssistance(assistanceId) {
  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from('billing_subscriptions')
    .select('provider_id, status')
    .eq('assistance_id', assistanceId)
    .in('status', ['pending', 'authorized', 'paused'])
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) throw error;
  let access = null;
  for (const s of subs || []) access = await syncSubscription(s.provider_id);
  return access;
}
