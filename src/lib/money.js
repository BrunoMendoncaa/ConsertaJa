// Dinheiro trafega como string decimal ("1234.56") até o banco (numeric).
// Nunca fazemos conta de dinheiro com float no cliente: quem calcula é o banco.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata um valor numérico (ou string decimal) como R$ 1.234,56. */
export function formatBRL(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return BRL.format(n);
}

/**
 * Converte o que o usuário digitou ("1.234,56", "1234,5", "R$ 10") em string decimal
 * com 2 casas ("1234.56"). Retorna null se não for um valor válido.
 */
export function parseMoney(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().replace(/R\$\s?/i, '').replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, dec = ''] = s.split('.');
  return `${BigInt(int).toString()}.${dec.padEnd(2, '0')}`;
}

/** Quantidade ("1", "1,5", "2.25") → string decimal com até 3 casas. */
export function parseQuantity(input) {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return null;
  if (Number(s) <= 0) return null;
  return s;
}

/** Valor para preencher um input (12.5 → "12,50"). */
export function moneyInputValue(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(2).replace('.', ',');
}
