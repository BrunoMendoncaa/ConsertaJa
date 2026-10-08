// Log técnico estruturado. O usuário vê só a mensagem amigável + o código de referência.

export function newRequestId() {
  return globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
}

export function logError(context, error, extra = {}) {
  const ref = newRequestId();
  console.error(JSON.stringify({
    level: 'error',
    ref,
    context,
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    ...extra,
    at: new Date().toISOString(),
  }));
  return ref;
}
