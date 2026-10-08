import 'server-only';

// Cliente mínimo da API do Mercado Pago (somente servidor).
// O Access Token fica em MP_ACCESS_TOKEN no .env / Vercel — nunca no navegador.
// MP_API_BASE só existe para os testes automatizados (simulador local).
const API = process.env.MP_API_BASE || 'https://api.mercadopago.com';

export function isMercadoPagoConfigured() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

async function mp(path, { method = 'GET', body, idempotencyKey } = {}) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('Configure MP_ACCESS_TOKEN no .env (somente servidor).');
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    const err = new Error(`Mercado Pago ${method} ${path} → ${res.status}: ${data?.message || data?.error || text.slice(0, 200)}`);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

/** Assinatura sem plano, pendente: o cliente conclui o pagamento no link (init_point). */
export function createPreapproval({ reason, externalReference, payerEmail, amount, months, startDate, backUrl, idempotencyKey }) {
  return mp('/preapproval', {
    method: 'POST',
    idempotencyKey,
    body: {
      reason,
      external_reference: externalReference,
      payer_email: payerEmail,
      auto_recurring: {
        frequency: months,
        frequency_type: 'months',
        transaction_amount: amount,
        currency_id: 'BRL',
        ...(startDate ? { start_date: startDate } : {}),
      },
      back_url: backUrl,
      status: 'pending',
    },
  });
}

export function getPreapproval(id) {
  return mp(`/preapproval/${encodeURIComponent(id)}`);
}

export function cancelPreapproval(id) {
  return mp(`/preapproval/${encodeURIComponent(id)}`, { method: 'PUT', body: { status: 'cancelled' } });
}

export async function listAuthorizedPayments(preapprovalId) {
  const data = await mp(`/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}`);
  return data?.results || [];
}

export function getAuthorizedPayment(id) {
  return mp(`/authorized_payments/${encodeURIComponent(id)}`);
}
