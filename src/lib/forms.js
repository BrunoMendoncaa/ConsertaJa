import { z } from 'zod';
import { parseMoney, parseQuantity } from '@/lib/money';
import { normalizeBrPhone } from '@/lib/phone';
import { parseDocument } from '@/lib/document';

z.config(z.locales.ptBR());

export { z };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Texto opcional: string vazia vira null. */
export const optionalText = (max = 2000) =>
  z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional().nullable()
    .transform((v) => (v ? v : null));

export const requiredText = (min, max, message) =>
  z.string({ error: message }).trim().min(min, message).max(max, `Máximo de ${max} caracteres.`);

export const uuid = (message = 'Selecione uma opção válida.') => z.string().regex(UUID_RE, message);

export const optionalUuid = () =>
  z.string().optional().nullable().transform((v) => (v ? v : null))
    .refine((v) => v === null || UUID_RE.test(v), 'Seleção inválida.');

export const phone = (message = 'Informe um telefone válido com DDD.') =>
  z.string().trim().refine((v) => normalizeBrPhone(v) !== null, message);

export const optionalPhone = () =>
  z.string().trim().optional().nullable().transform((v) => (v ? v : null))
    .refine((v) => v === null || normalizeBrPhone(v) !== null, 'Telefone inválido.');

export const document = () =>
  z.string().trim().optional().nullable()
    .transform((v) => parseDocument(v))
    .refine((v) => v !== false, 'CPF/CNPJ inválido.');

export const email = () =>
  z.string().trim().toLowerCase().optional().nullable().transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'E-mail inválido.');

export const money = (message = 'Informe um valor válido, como 150,00.') =>
  z.string().transform((v) => parseMoney(v)).refine((v) => v !== null, message);

export const optionalMoney = () =>
  z.string().optional().nullable()
    .transform((v) => (v === undefined || v === null || String(v).trim() === '' ? '0.00' : parseMoney(v)))
    .refine((v) => v !== null, 'Valor inválido.');

export const quantity = () =>
  z.string().transform((v) => parseQuantity(v)).refine((v) => v !== null, 'Quantidade inválida.');

export const optionalInt = (min, max, message) =>
  z.string().optional().nullable().transform((v) => (v === undefined || v === null || v === '' ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), message);

/** Lê um FormData em objeto simples. Campos repetidos (checkbox múltiplo) viram array. */
export function formToObject(formData, arrayFields = []) {
  const out = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith('$ACTION')) continue;
    out[key] = arrayFields.includes(key) ? formData.getAll(key).map(String) : formData.get(key);
  }
  for (const key of arrayFields) if (!(key in out)) out[key] = [];
  return out;
}

/**
 * Valida o FormData com um schema Zod.
 * @returns {{ data: any } | { error: string, fieldErrors: Record<string,string> }}
 */
export function parseForm(schema, formData, arrayFields = []) {
  const raw = formData instanceof FormData ? formToObject(formData, arrayFields) : formData;
  const result = schema.safeParse(raw);
  if (result.success) return { data: result.data };
  const fieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: 'Revise os campos destacados.', fieldErrors };
}
