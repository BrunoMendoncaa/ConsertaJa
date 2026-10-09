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
    admin.from('assistances').select('id, mp_preapproval_id').not('mp_preapproval_id', 'is', null),
    admin.from('billing_subscriptions').select('assistance_id, provider_id').eq('status', 'pending').gte('created_at', since),
  ]);
  if (current.error || pending.error) {
    const ref = logError('billing.cron', current.error || pending.error);
    return Response.json({ error: 'falha ao listar assinaturas', ref }, { status: 500 });
  }

  // Agrupa por assistência: as assinaturas de uma mesma assistência são conferidas uma de
  // cada vez (todas gravam na mesma linha); assistências diferentes rodam em paralelo.
  const groups = new Map();
  const add = (assistanceId, preapprovalId) => {
    if (!groups.has(assistanceId)) groups.set(assistanceId, new Set());
    groups.get(assistanceId).add(preapprovalId);
  };
  (current.data || []).forEach((r) => add(r.id, r.mp_preapproval_id));
  (pending.data || []).forEach((r) => add(r.assistance_id, r.provider_id));
  const queue = [...groups.values()].map((set) => [...set]);

  const result = { total: queue.reduce((n, ids) => n + ids.length, 0), synced: 0, ignored: 0, failed: 0 };
  const syncGroup = async (ids) => {
    for (const id of ids) {
      try {
        await syncSubscription(id);
        result.synced += 1;
      } catch (error) {
        if (error?.status === 404) {
          result.ignored += 1; // não existe nesta conta do Mercado Pago (ex.: assinatura de teste)
        } else {
          result.failed += 1;
          logError('billing.cron', error, { preapprovalId: id, mp: error?.details });
        }
      }
    }
  };
  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    await Promise.all(queue.slice(i, i + CONCURRENCY).map(syncGroup));
  }

  console.info(JSON.stringify({ level: 'info', context: 'billing.cron', ...result, at: new Date().toISOString() }));
  return Response.json({ ok: result.failed === 0, ...result }, { status: result.failed ? 500 : 200 });
}
