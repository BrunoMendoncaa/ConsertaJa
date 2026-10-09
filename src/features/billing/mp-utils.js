// Funções puras da integração com o Mercado Pago (sem rede): validação do
// webhook e conversão das respostas da API para o formato do banco.
import crypto from 'node:crypto';

/**
 * Valida o cabeçalho x-signature do webhook do Mercado Pago.
 * Manifest: "id:[data.id];request-id:[x-request-id];ts:[ts];" — partes ausentes são omitidas,
 * data.id em minúsculas. HMAC-SHA256 (hex) com a assinatura secreta da aplicação.
 */
export function verifyWebhookSignature({ signature, requestId, dataId, secret, now = Date.now(), toleranceSec = 0 }) {
  if (!signature || !secret) return false;
  const parts = Object.fromEntries(
    String(signature).split(',').map((p) => p.split('=').map((s) => s.trim())).filter((kv) => kv.length === 2),
  );
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  let manifest = '';
  if (dataId) manifest += `id:${String(dataId).toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(v1), 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  if (toleranceSec > 0) {
    const tsMs = Number(ts) > 1e12 ? Number(ts) : Number(ts) * 1000;
    if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > toleranceSec * 1000) return false;
  }
  return true;
}

/** Tipo e id do recurso avisado (aceita o formato novo e o antigo de notificação). */
export function parseWebhook({ searchParams, body }) {
  const get = (k) => (searchParams?.get ? searchParams.get(k) : searchParams?.[k]) || null;
  const type = body?.type || get('type') || get('topic') || null;
  const dataId = get('data.id') || body?.data?.id || get('id') || null;
  return { type, dataId: dataId ? String(dataId) : null };
}

/** Status da assinatura no Mercado Pago → status aceito pelo banco. */
export function mapPreapprovalStatus(status) {
  switch (status) {
    case 'authorized':
      return 'authorized';
    case 'paused':
      return 'paused';
    case 'cancelled':
    case 'canceled':
    case 'finished':
      return 'cancelled';
    default:
      return 'pending';
  }
}

/** Faturas (authorized_payments) → pagamentos para billing_apply_sync. Só "approved" conta como pago. */
export function mapAuthorizedPayments(results) {
  return (results || []).map((r) => {
    const paymentStatus = r?.payment?.status || null;
    const approved = paymentStatus === 'approved';
    return {
      id: String(r.id),
      payment_id: r?.payment?.id ? String(r.payment.id) : null,
      amount: Number(r.transaction_amount || 0),
      status: approved ? 'approved' : paymentStatus || r.status || 'pending',
      paid_at: approved ? r.debit_date || r.last_modified || r.date_created || null : null,
    };
  });
}

/**
 * Mensagem para quem tentou assinar, a partir do erro da API do Mercado Pago.
 * Casos comuns ganham explicação própria; nos demais, mostra o motivo que o MP informou.
 */
export function describeCheckoutError(error, { backUrl } = {}) {
  const status = Number(error?.status) || 0;
  const d = error?.details || {};
  const causes = Array.isArray(d.cause) ? d.cause.map((c) => c?.description || c?.message || c?.code) : [];
  const reason = [d.message, d.error, ...causes]
    .filter((s) => typeof s === 'string' && s.trim())
    .filter((s, i, all) => all.indexOf(s) === i)
    .join(' · ')
    .slice(0, 200);
  const text = reason.toLowerCase();

  if (status === 401 || status === 403 || /access.?token|unauthorized|invalid.?token|live credentials/.test(text)) {
    return 'O Mercado Pago não aceitou as credenciais configuradas (MP_ACCESS_TOKEN). Confira o token no .env / Vercel.';
  }
  if (!status || status >= 500) {
    return 'Não foi possível abrir o pagamento no Mercado Pago agora. Tente de novo em instantes.';
  }
  if (/same user|mismo usuario|mesmo usu[aá]rio|cannot be the same/.test(text)) {
    return 'Esse e-mail é da mesma conta Mercado Pago que recebe as assinaturas. Para assinar, use outra conta do Mercado Pago.';
  }
  if (/test user|real or test|prueba|teste|invalid users|test_user/.test(text)) {
    return 'O Mercado Pago deste ambiente está com credenciais de TESTE: informe o e-mail de um comprador de teste (painel do Mercado Pago → sua aplicação → Contas de teste), não um e-mail real.';
  }
  if (/countr|pa[ií]s/.test(text)) {
    return 'A conta Mercado Pago desse e-mail é de outro país. Use uma conta do Brasil.';
  }
  if (/back.?url/.test(text)) {
    return `O Mercado Pago recusou o endereço de retorno${backUrl ? ` (${backUrl})` : ''}. Confira NEXT_PUBLIC_SITE_URL: precisa ser o endereço público, com https://. Motivo informado: "${reason}".`;
  }
  return reason
    ? `O Mercado Pago recusou o pedido. Motivo informado: "${reason}".`
    : 'O Mercado Pago recusou o pedido. Confira o e-mail informado e tente de novo.';
}
