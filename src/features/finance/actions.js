'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { actionError } from '@/lib/errors';
import { parseForm, z, optionalText, money, optionalUuid } from '@/lib/forms';
import { parseQuantity } from '@/lib/money';
import { CASH_CATEGORIES, PAYMENT_METHODS, MANAGER_ROLES, TECH_ROLES } from '@/lib/constants';
import { allowedCategories } from './rules';

const txSchema = z.object({
  category: z.enum(Object.keys(CASH_CATEGORIES), { error: 'Escolha a categoria.' }),
  amount: money(),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
  payment_method: z.enum(Object.keys(PAYMENT_METHODS), { error: 'Escolha a forma de pagamento.' }),
  description: z.string().trim().min(2, 'Descreva o lançamento.').max(300),
  quantity: z.string().optional().nullable().transform((v) => (v ? parseQuantity(v) : null)),
  service_order_id: optionalUuid(),
  service_order_code: optionalText(20),
  supplier_id: optionalUuid(),
});

export async function createCashTransaction(_prev, formData) {
  const { supabase, role } = await requireStaff();
  const parsed = parseForm(txSchema, formData);
  if (!parsed.data) return parsed;
  const d = parsed.data;

  if (!allowedCategories(role).includes(d.category)) {
    return { ok: false, error: 'Você não tem permissão para lançar esta categoria.' };
  }
  if (Number(d.amount) <= 0) return { ok: false, error: 'Revise os campos.', fieldErrors: { amount: 'O valor precisa ser maior que zero.' } };

  // OS informada pelo número (ex.: 123 ou OS-2026-000123)
  let serviceOrderId = d.service_order_id;
  if (!serviceOrderId && d.service_order_code) {
    const code = d.service_order_code.toUpperCase();
    const digits = code.replace(/\D/g, '');
    let q = supabase.from('service_orders').select('id, code').order('received_at', { ascending: false }).limit(1);
    q = code.startsWith('OS-') ? q.eq('code', code) : q.eq('number', Number(digits.slice(-6)) || 0);
    const { data: found } = await q;
    if (!found?.length) return { ok: false, error: 'Revise os campos.', fieldErrors: { service_order_code: 'OS não encontrada.' } };
    serviceOrderId = found[0].id;
  }

  const direction = CASH_CATEGORIES[d.category].direction;
  const { error } = await supabase.from('cash_transactions').insert({
    direction,
    category: d.category,
    amount: d.amount,
    occurred_at: `${d.occurred_at}T12:00:00-03:00`,
    payment_method: d.payment_method,
    description: d.description,
    quantity: d.quantity,
    service_order_id: serviceOrderId,
    supplier_id: d.supplier_id,
  });
  if (error) return actionError('finance.createTx', error, 'Não foi possível registrar o lançamento.');

  revalidatePath('/painel/caixa');
  revalidatePath('/painel');
  if (serviceOrderId) revalidatePath(`/painel/os/${serviceOrderId}`);
  return { ok: true, message: direction === 'IN' ? 'Recebimento registrado.' : 'Saída registrada.' };
}

export async function voidCashTransaction(id, _prev, formData) {
  const { supabase } = await requireStaff(MANAGER_ROLES);
  const reason = String(formData.get('reason') || '').trim();
  const { error } = await supabase.rpc('void_cash_transaction', { p_id: id, p_reason: reason });
  if (error) return actionError('finance.voidTx', error, 'Não foi possível anular o lançamento.');
  revalidatePath('/painel/caixa');
  revalidatePath('/painel');
  return { ok: true, message: 'Lançamento anulado.' };
}

const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome.').max(120),
  phone: optionalText(30),
  document: optionalText(20),
  notes: optionalText(1000),
});

export async function createSupplier(_prev, formData) {
  const { supabase } = await requireStaff(TECH_ROLES);
  const parsed = parseForm(supplierSchema, formData);
  if (!parsed.data) return parsed;
  const { error } = await supabase.from('suppliers').insert(parsed.data);
  if (error) return actionError('finance.createSupplier', error, 'Não foi possível salvar o fornecedor.');
  revalidatePath('/painel/fornecedores');
  return { ok: true, message: 'Fornecedor cadastrado.' };
}

export async function updateSupplier(id, _prev, formData) {
  const { supabase } = await requireStaff(TECH_ROLES);
  const parsed = parseForm(supplierSchema, formData);
  if (!parsed.data) return parsed;
  const active = formData.get('active') !== 'false';
  const { error } = await supabase.from('suppliers').update({ ...parsed.data, active }).eq('id', id);
  if (error) return actionError('finance.updateSupplier', error, 'Não foi possível salvar o fornecedor.');
  revalidatePath('/painel/fornecedores');
  return { ok: true, message: 'Fornecedor atualizado.' };
}
