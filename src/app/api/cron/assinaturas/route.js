import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { isMercadoPagoConfigured } from '@/lib/mercadopago';
import { syncSubscription } from '@/features/billing/sync';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PENDING_DAYS = 3; // checkout aberto e não concluído: confere por alguns dias
const CONCURRENCY = 5;

/** A Vercel envia "Authorization: Bearer <CRON_SECRET>" nas chamadas agendadas. */
function isAuthorized(request, secret) {
  const got = Buffer.from(request.headers.get('authorization') || '', 'utf8');
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

/**
 * Rede de segurança diária (Vercel Cron, ver vercel.json). Confere no Mercado Pago as
 * assinaturas vigentes e os pagamentos iniciados nos últimos dias, para o caso de um
 * aviso (webhook) se perder: renovação paga, cobrança recusada, cancelamento feito
 * pelo app do Mercado Pago, cliente que pagou e fechou a aba sem voltar ao sistema.
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET não configurado' }, { status: 503 });
  if (!isAuthorized(request, secret)) return Response.json({ error: 'não autorizado' }, { status: 401 });
  if (!isMercadoPagoConfigured()) return Response.json({ ok: true, skipped: 'Mercado Pago não configurado' });

  const admin = createAdminClient();
  const since = new Date(Date.now() - PENDING_DAYS * 86400000).toISOString();
  const [current, pending] = await Promise.all([
    admin.from('assistances').select('mp_preapproval_id').not('mp_preapproval_id', 'is', null),
    admin.from('billing_subscriptions').select('provider_id').eq('status', 'pending').gte('created_at', since),
  ]);
  if (current.error || pending.error) {
    const ref = logError('billing.cron', current.error || pending.error);
    return Response.json({ error: 'falha ao listar assinaturas', ref }, { status: 500 });
  }

  const ids = [...new Set([
    ...(current.data || []).map((r) => r.mp_preapproval_id),
    ...(pending.data || []).map((r) => r.provider_id),
  ])];

  const result = { total: ids.length, synced: 0, ignored: 0, failed: 0 };
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((id) => syncSubscription(id)));
    settled.forEach((s, j) => {
      if (s.status === 'fulfilled') {
        result.synced += 1;
      } else if (s.reason?.status === 404) {
        result.ignored += 1; // não existe nesta conta do Mercado Pago (ex.: assinatura de teste)
      } else {
        result.failed += 1;
        logError('billing.cron', s.reason, { preapprovalId: batch[j], mp: s.reason?.details });
      }
    });
  }

  console.info(JSON.stringify({ level: 'info', context: 'billing.cron', ...result, at: new Date().toISOString() }));
  return Response.json({ ok: result.failed === 0, ...result }, { status: result.failed ? 500 : 200 });
}
