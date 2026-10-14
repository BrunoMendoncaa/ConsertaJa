// Cadastro mínimo da assistência: WhatsApp (ou telefone) e endereço completo.
// Esses dados saem no comprovante, no orçamento, no certificado de garantia e no portal do cliente.
import { BR_STATES } from '@/lib/constants';

export const REQUIRED_ADDRESS_FIELDS = ['cep', 'rua', 'numero', 'bairro', 'cidade', 'uf'];

const filled = (v) => String(v ?? '').trim().length > 0;

/** O que ainda falta no cadastro (textos curtos para avisos). Vazio = completo. */
export function missingProfileFields(assistance) {
  const missing = [];
  if (!filled(assistance?.whatsapp) && !filled(assistance?.phone)) missing.push('WhatsApp ou telefone');
  const addr = assistance?.address || {};
  if (REQUIRED_ADDRESS_FIELDS.some((k) => !filled(addr[k]))) missing.push('endereço completo');
  return missing;
}

export function isProfileComplete(assistance) {
  return missingProfileFields(assistance).length === 0;
}

/** "01310100" ou "01310-100" → "01310-100". Qualquer outra coisa → null. */
export function formatCep(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : null;
}

/**
 * Erros por campo ao salvar as configurações (mesmos nomes dos campos da tela).
 * `contact`: { phone, whatsapp } já validados; `address`: textos do formulário.
 */
export function profileFieldErrors(contact, address) {
  const errors = {};
  if (!filled(contact?.phone) && !filled(contact?.whatsapp)) {
    errors.whatsapp = 'Informe o WhatsApp ou o telefone da assistência.';
  }
  const a = address || {};
  if (!filled(a.cep)) errors.cep = 'Informe o CEP.';
  else if (!formatCep(a.cep)) errors.cep = 'CEP inválido. Use 8 números.';
  if (!filled(a.rua)) errors.rua = 'Informe a rua.';
  if (!filled(a.numero)) errors.numero = 'Informe o número (ou S/N).';
  if (!filled(a.bairro)) errors.bairro = 'Informe o bairro.';
  if (!filled(a.cidade)) errors.cidade = 'Informe a cidade.';
  if (!filled(a.uf)) errors.uf = 'Escolha o estado.';
  else if (!BR_STATES.includes(String(a.uf).toUpperCase())) errors.uf = 'Estado inválido.';
  return errors;
}
