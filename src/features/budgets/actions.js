'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { actionError } from '@/lib/errors';
import { parseForm, z, optionalText, money, optionalMoney, quantity, optionalInt } from '@/lib/forms';
import { TECH_ROLES } from '@/lib/constants';

function refresh(osId) {
  revalidatePath(`/painel/os/${osId}/orcamento`);
  revalidatePath(`/painel/os/${osId}`);
  revalidatePath('/painel/orcamentos');
  revalidatePath('/painel');
}

export async function openDraft(osId) {
  const { supabase } = await requireStaff(TECH_ROLES);
  const { error } = await supabase.rpc('create_budget_version', { p_service_order_id: osId });
  if (error) return actionError('budget.openDraft', error, 'Não foi possível abrir o orçamento.');
  refresh(osId);
  return { ok: true };
}

const itemSchema = z.object({
  kind: z.enum(['PECA', 'SERVICO'], { error: 'Escolha o tipo.' }),
  description: z.string().trim().min(1, 'Descreva o item.').max(300),
  quantity: quantity(),
  unit_price: money('Informe o valor unitário.'),
  discount_amount: optionalMoney(),
});

export async function addItem(versionId, osId, _prev, formData) {
  const { supabase } = await requireStaff(TECH_ROLES);
  const parsed = parseForm(itemSchema, formData);
  if (!parsed.data) return parsed;
  const { count } = await supabase.from('budget_items').select('id', { count: 'exact', head: true }).eq('budget_version_id', versionId);
  const { error } = await supabase.from('budget_items').insert({ ...parsed.data, budget_version_id: versionId, position: (count || 0) + 1 });
  if (error) return actionError('budget.addItem', error, 'Não foi possível adicionar o item.');
  refresh(osId);
  return { ok: true, message: 'Item adicionado.' };
}

export async function updateItem(itemId, osId, _prev, formData) {
  const { supabase } = await requireStaff(TECH_ROLES);
  const parsed = parseForm(itemSchema, formData);
  if (!parsed.data) return parsed;
  const { error } = await supabase.from('budget_items').update(parsed.data).eq('id', itemId);
  if (error) return actionError('budget.updateItem', error, 'Não foi possível salvar o item.');
  refresh(osId);
  return { ok: true, message: 'Item atualizado.' };
}

export async function deleteItem(itemId, osId) {
  const { supabase } = await requireStaff(TECH_ROLES);
  const { error } = await supabase.from('budget_items').delete().eq('id', itemId);
  if (error) return actionError('budget.deleteItem', error, 'Não foi possível remover o item.');
  refresh(osId);
  return { ok: true };
}

const headerSchema = z.object({
  discount_amount: optionalMoney(),
  surcharge_amount: optionalMoney(),
  warranty_days: optionalInt(0, 3650, 'Garantia entre 0 e 3650 dias.'),
  payment_terms: optionalText(500),
  customer_notes: optionalText(2000),
  technical_notes: optionalText(2000),
  internal_notes: optionalText(2000),
});

export async function updateDraftHeader(versionId, osId, _prev, formData) {
  const { supabase } = await requireStaff(TECH_ROLES);
  const parsed = parseForm(headerSchema, formData);
  if (!parsed.data) return parsed;
  const { error } = await supabase.from('budget_versions').update(parsed.data).eq('id', versionId);
  if (error) return actionError('budget.updateHeader', error, 'Não foi possível salvar o orçamento.');
  refresh(osId);
  return { ok: true, message: 'Condições salvas.' };
}

// O prazo do conserto é pedido junto com o envio (antes ficava só em "Condições"
// e era fácil esquecer de salvar). Ele é gravado no rascunho e depois o envio
// congela tudo; se o envio falhar por outro motivo, o prazo já fica salvo.
export async function sendBudget(versionId, osId, _prev, formData) {
  const { supabase } = await requireStaff(TECH_ROLES);
  const fieldErrors = {};

  const rawDays = String(formData.get('estimated_days') || '').trim();
  const estimatedDays = Number(rawDays);
  if (!rawDays) fieldErrors.estimated_days = 'Informe em quantos dias o conserto fica pronto.';
  else if (!Number.isInteger(estimatedDays) || estimatedDays < 1 || estimatedDays > 365) {
    fieldErrors.estimated_days = 'Prazo entre 1 e 365 dias.';
  }

  const rawValid = String(formData.get('valid_days') || '').trim();
  const validDays = rawValid ? Number(rawValid) : null;
  if (validDays !== null && (!Number.isInteger(validDays) || validDays < 1 || validDays > 90)) {
    fieldErrors.valid_days = 'Validade entre 1 e 90 dias.';
  }

  if (Object.keys(fieldErrors).length) return { ok: false, error: 'Revise os campos.', fieldErrors };

  const { error: saveError } = await supabase
    .from('budget_versions')
    .update({ estimated_days: estimatedDays })
    .eq('id', versionId);
  if (saveError) return actionError('budget.sendSaveDays', saveError, 'Não foi possível salvar o prazo.');

  const { error } = await supabase.rpc('send_budget_version', { p_version_id: versionId, p_valid_days: validDays });
  if (error) return actionError('budget.send', error, 'Não foi possível enviar o orçamento.');
  refresh(osId);
  return { ok: true, message: 'Orçamento enviado. Agora é só mandar o link para o cliente.' };
}

const decisionSchema = z.object({
  decision: z.enum(['APROVADO', 'RECUSADO']),
  channel: z.enum(['BALCAO', 'TELEFONE', 'WHATSAPP'], { error: 'Informe como o cliente decidiu.' }),
  reason: optionalText(1000),
});

export async function staffDecide(versionId, osId, _prev, formData) {
  const { supabase } = await requireStaff();
  const parsed = parseForm(decisionSchema, formData);
  if (!parsed.data) return parsed;
  const { error } = await supabase.rpc('staff_decide_budget', {
    p_version_id: versionId, p_decision: parsed.data.decision, p_channel: parsed.data.channel, p_reason: parsed.data.reason,
  });
  if (error) return actionError('budget.staffDecide', error, 'Não foi possível registrar a decisão.');
  refresh(osId);
  return { ok: true, message: parsed.data.decision === 'APROVADO' ? 'Aprovação registrada.' : 'Recusa registrada.' };
}
