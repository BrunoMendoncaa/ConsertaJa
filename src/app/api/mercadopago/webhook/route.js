import { verifyWebhookSignature, parseWebhook } from '@/features/billing/mp-utils';
import { syncSubscription } from '@/features/billing/sync';
import { getAuthorizedPayment } from '@/lib/mercadopago';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Avisos do Mercado Pago (Webhooks → "Planos e assinaturas").
 * 1. Confere a assinatura secreta (x-signature). Sem ela, nada é processado.
 * 2. Usa o aviso só como "algo mudou": busca a assinatura na API e grava o que a API diz.
 */
export async function POST(request) {
  const url = new URL(request.url);
  let body = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const { type, dataId } = parseWebhook({ searchParams: url.searchParams, body });

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    logError('billing.webhook', new Error('MP_WEBHOOK_SECRET não configurado'), { type });
    return Response.json({ error: 'webhook não configurado' }, { status: 503 });
  }
  const valid = verifyWebhookSignature({
    signature: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId: url.searchParams.get('data.id') || dataId,
    secret,
  });
  if (!valid) {
    // Sem dados sensíveis: só o que ajuda a achar o problema (segredo trocado, aviso de outra aplicação).
    console.warn(JSON.stringify({
      level: 'warn', context: 'billing.webhook', message: 'assinatura inválida (confira MP_WEBHOOK_SECRET)',
      type, dataId, hasSignature: Boolean(request.headers.get('x-signature')), at: new Date().toISOString(),
    }));
    return Response.json({ error: 'assinatura inválida' }, { status: 401 });
  }
  if (!dataId) return Response.json({ ok: true, ignored: 'sem id' });

  try {
    if (type === 'subscription_preapproval') {
      await syncSubscription(dataId);
    } else if (type === 'subscription_authorized_payment') {
      const invoice = await getAuthorizedPayment(dataId);
      if (invoice?.preapproval_id) await syncSubscription(String(invoice.preapproval_id));
    }
    // Outros tipos (ex.: payment) não mudam o acesso: a fatura da assinatura já cobre.
    console.info(JSON.stringify({ level: 'info', context: 'billing.webhook', message: 'aviso processado', type, dataId, at: new Date().toISOString() }));
    return Response.json({ ok: true });
  } catch (error) {
    // Assinatura que não é nossa (ou de outro ambiente): confirma para não receber de novo.
    if (error?.status === 404 || String(error?.message || '').includes('Assinatura desconhecida')) {
      return Response.json({ ok: true, ignored: 'assinatura desconhecida' });
    }
    const ref = logError('billing.webhook', error, { type, dataId, mp: error?.details });
    return Response.json({ error: 'falha ao processar', ref }, { status: 500 });
  }
}
