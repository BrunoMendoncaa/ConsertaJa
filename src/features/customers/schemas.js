import { z, optionalText, phone, optionalPhone, email, document } from '@/lib/forms';

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.').max(150),
  phone: phone(),
  phone_secondary: optionalPhone(),
  email: email(),
  document: document(),
  notes: optionalText(2000),
  cep: optionalText(9), rua: optionalText(150), numero: optionalText(20), complemento: optionalText(80),
  bairro: optionalText(80), cidade: optionalText(80), uf: optionalText(2),
});

/** Separa os campos de endereço (jsonb) do resto. */
export function toCustomerRow(data) {
  const { cep, rua, numero, complemento, bairro, cidade, uf, ...rest } = data;
  const address = Object.fromEntries(
    Object.entries({ cep, rua, numero, complemento, bairro, cidade, uf }).filter(([, v]) => v)
  );
  return { ...rest, address };
}
