// CPF/CNPJ: guardamos só os dígitos e validamos os dígitos verificadores.

export function onlyDigits(s) {
  return String(s ?? '').replace(/\D/g, '');
}

export function isValidCPF(input) {
  const c = onlyDigits(input);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

export function isValidCNPJ(input) {
  const c = onlyDigits(input);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

/** Retorna os dígitos se for CPF/CNPJ válido, null se vazio, false se inválido. */
export function parseDocument(input) {
  const d = onlyDigits(input);
  if (!d) return null;
  if (d.length === 11) return isValidCPF(d) ? d : false;
  if (d.length === 14) return isValidCNPJ(d) ? d : false;
  return false;
}

export function formatDocument(input) {
  const d = onlyDigits(input);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return input || '';
}
