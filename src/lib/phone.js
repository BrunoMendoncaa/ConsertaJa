// Espelho da função private.normalize_br_phone do banco (o banco é a fonte da verdade).

/** Normaliza telefone brasileiro para E.164 (+55DDDNUMERO) ou null. */
export function normalizeBrPhone(input) {
  if (!input) return null;
  let d = String(input).replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.startsWith('0') && (d.length === 11 || d.length === 12)) d = d.slice(1);
  if ((d.length !== 10 && d.length !== 11) || d.startsWith('0')) return null;
  return `+55${d}`;
}

/** +5511987654321 → (11) 98765-4321 */
export function formatPhone(input) {
  const e164 = normalizeBrPhone(input);
  if (!e164) return input || '';
  const d = e164.slice(3);
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  return rest.length === 9
    ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
    : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

/** Link de conversa no WhatsApp com mensagem pronta (sem API, custo zero). */
export function whatsappLink(phone, message) {
  const e164 = normalizeBrPhone(phone);
  const base = e164 ? `https://wa.me/${e164.slice(1)}` : 'https://wa.me/';
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
