'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { actionError } from '@/lib/errors';
import { parseForm, z, optionalText, optionalUuid, uuid, phone, optionalPhone, email, document } from '@/lib/forms';
import { MANAGER_ROLES, TECH_ROLES, ACCESSORIES, ENTRY_CHECKLIST, PHOTO_KINDS, PHOTO_STAGES } from '@/lib/constants';

// ---------------------------------------------------------------- Abertura
const newCustomer = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.').max(150),
  phone: phone(),
  phone_secondary: optionalPhone(),
  email: email(),
  document: document(),
});

const newEquipment = z.object({
  category_id: uuid('Escolha a categoria.'),
  brand: optionalText(80),
  model: optionalText(120),
  serial_number: optionalText(80),
  imei: z.string().trim().optional().nullable()
    .transform((v) => (v ? v.replace(/\D/g, '') : null))
    .refine((v) => v === null || /^\d{15}$/.test(v), 'O IMEI deve ter 15 dígitos.'),
  color: optionalText(40),
});

const orderSchema = z.object({
  customer_id: optionalUuid(),
  customer: newCustomer.optional().nullable(),
  equipment_id: optionalUuid(),
  equipment: newEquipment.optional().nullable(),
  reported_issue: z.string().trim().min(3, 'Descreva o problema relatado pelo cliente.').max(2000),
  accessories: z.array(z.string().trim().max(60)).max(30).default([]),
  entry_condition: z.record(z.string(), z.boolean()).default({}),
  entry_condition_notes: optionalText(2000),
  priority: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']).default('NORMAL'),
  technician_id: optionalUuid(),
  estimated_completion_at: z.string().optional().nullable()
    .transform((v) => (v ? `${v}T18:00:00-03:00` : null)),
  unlock_code: optionalText(100),
  customer_notes: optionalText(2000),
  internal_notes: optionalText(2000),
}).refine((v) => v.customer_id || v.customer, { message: 'Selecione ou cadastre o cliente.', path: ['customer_id'] })
  .refine((v) => v.equipment_id || v.equipment, { message: 'Selecione ou cadastre o equipamento.', path: ['equipment_id'] });

/** Chamada pelo assistente de abertura com um objeto (não FormData). */
export async function createServiceOrder(input) {
  const { supabase } = await requireStaff();
  const parsed = parseForm(orderSchema, input);
  if (!parsed.data) return parsed;

  const allowedKeys = new Set(ENTRY_CHECKLIST.map((c) => c.key));
  const entry_condition = Object.fromEntries(
    Object.entries(parsed.data.entry_condition).filter(([k]) => allowedKeys.has(k))
  );

  // Remove nulos: o banco decide "cliente novo x existente" pela presença das chaves.
  const payload = Object.fromEntries(
    Object.entries({ ...parsed.data, entry_condition }).filter(([, v]) => v !== null && v !== undefined)
  );
  if (payload.customer_id) delete payload.customer;
  if (payload.equipment_id) delete payload.equipment;

  const { data, error } = await supabase.rpc('create_service_order', { p: payload });
  if (error) return actionError('os.create', error, 'Não foi possível abrir a OS. Verifique os dados e tente novamente.');

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath('/painel/os');
  revalidatePath('/painel');
  return { ok: true, data: row };
}

// ---------------------------------------------------------------- Edição
const detailsSchema = z.object({
  priority: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']),
  reported_issue: z.string().trim().min(3, 'Descreva o problema.').max(2000),
  diagnosis: optionalText(4000),
  solution: optionalText(4000),
  customer_notes: optionalText(2000),
  internal_notes: optionalText(2000),
  technician_id: optionalUuid(),
  estimated_completion_at: z.string().optional().nullable().transform((v) => (v ? `${v}T18:00:00-03:00` : null)),
});

export async function updateServiceOrder(id, _prev, formData) {
  const { supabase, role } = await requireStaff();
  const parsed = parseForm(detailsSchema.partial(), formData);
  if (!parsed.data) return parsed;

  // Só grava os campos que vieram no formulário (campos desabilitados não são enviados).
  const techOnly = ['diagnosis', 'solution'];
  const update = Object.fromEntries(
    Object.keys(detailsSchema.shape)
      .filter((k) => formData.has(k))
      .filter((k) => TECH_ROLES.includes(role) || !techOnly.includes(k))
      .map((k) => [k, parsed.data[k] ?? null])
  );
  if (update.reported_issue === null) delete update.reported_issue;
  if (update.priority === null) delete update.priority;
  if (!Object.keys(update).length) return { ok: true, message: 'Nada para salvar.' };

  const { error } = await supabase.from('service_orders').update(update).eq('id', id);
  if (error) return actionError('os.update', error, 'Não foi possível salvar a OS.');
  revalidatePath(`/painel/os/${id}`);
  return { ok: true, message: 'OS atualizada.' };
}

const entrySchema = z.object({
  accessories: z.array(z.string()).default([]),
  accessories_other: optionalText(200),
  entry_condition_notes: optionalText(2000),
});

export async function updateEntry(id, _prev, formData) {
  const { supabase } = await requireStaff();
  const parsed = parseForm(entrySchema, formData, ['accessories', 'condition']);
  if (!parsed.data) return parsed;
  const accessories = parsed.data.accessories.filter((a) => ACCESSORIES.includes(a));
  if (parsed.data.accessories_other) accessories.push(...parsed.data.accessories_other.split(',').map((s) => s.trim()).filter(Boolean));
  const checked = new Set(formData.getAll('condition').map(String));
  const entry_condition = Object.fromEntries(ENTRY_CHECKLIST.map((c) => [c.key, checked.has(c.key)]));

  const { error } = await supabase.from('service_orders')
    .update({ accessories, entry_condition, entry_condition_notes: parsed.data.entry_condition_notes })
    .eq('id', id);
  if (error) return actionError('os.updateEntry', error);
  revalidatePath(`/painel/os/${id}`);
  return { ok: true, message: 'Dados de entrada atualizados.' };
}

// ---------------------------------------------------------------- Status
export async function changeStatus(id, _prev, formData) {
  const { supabase } = await requireStaff();
  const to = String(formData.get('to') || '');
  const note = String(formData.get('note') || '').trim() || null;
  const { error } = await supabase.rpc('change_service_order_status', { p_id: id, p_status: to, p_note: note });
  if (error) return actionError('os.changeStatus', error, 'Não foi possível mudar o status.');
  revalidatePath(`/painel/os/${id}`);
  revalidatePath('/painel/os');
  revalidatePath('/painel');
  // Na retirada, o próximo passo é imprimir o certificado de garantia (ou o termo de retirada).
  if (to === 'ENTREGUE') redirect(`/painel/os/${id}/garantia`);
  return { ok: true, message: 'Status atualizado.' };
}

export async function regenerateAccessCode(id) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc('regenerate_access_code', { p_service_order_id: id });
  if (error) return actionError('os.regenerateCode', error);
  revalidatePath(`/painel/os/${id}`);
  return { ok: true, message: 'Novo código gerado. O código anterior deixou de valer para novos acessos.' };
}

export async function setUnlockCode(id, _prev, formData) {
  const { supabase } = await requireStaff();
  const code = String(formData.get('unlock_code') || '').trim();
  if (!code) {
    const { error } = await supabase.from('service_order_secrets').delete().eq('service_order_id', id);
    if (error) return actionError('os.clearUnlock', error);
  } else {
    const { data: existing } = await supabase.from('service_order_secrets').select('service_order_id').eq('service_order_id', id).maybeSingle();
    const { error } = existing
      ? await supabase.from('service_order_secrets').update({ unlock_code: code }).eq('service_order_id', id)
      : await supabase.from('service_order_secrets').insert({ service_order_id: id, unlock_code: code });
    if (error) return actionError('os.setUnlock', error);
  }
  revalidatePath(`/painel/os/${id}`);
  return { ok: true, message: code ? 'Senha registrada. Ela será apagada na entrega.' : 'Senha removida.' };
}

// ---------------------------------------------------------------- Fotos
const photoSchema = z.object({
  service_order_id: uuid(),
  storage_path: z.string().min(10).max(300),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size_bytes: z.number().int().min(1).max(10 * 1024 * 1024),
  kind: z.enum(Object.keys(PHOTO_KINDS)),
  stage: z.enum(Object.keys(PHOTO_STAGES)),
  description: optionalText(200),
});

/** Registra o metadado depois do upload direto do navegador para o Storage. */
export async function registerPhoto(input) {
  const { supabase, assistance } = await requireStaff();
  const parsed = parseForm(photoSchema, input);
  if (!parsed.data) return parsed;
  if (!parsed.data.storage_path.startsWith(`${assistance.id}/${parsed.data.service_order_id}/`)) {
    return { ok: false, error: 'Caminho de arquivo inválido.' };
  }
  const { error } = await supabase.from('service_order_photos').insert(parsed.data);
  if (error) {
    await supabase.storage.from('service-order-photos').remove([parsed.data.storage_path]);
    return actionError('os.registerPhoto', error, 'Não foi possível salvar a foto.');
  }
  revalidatePath(`/painel/os/${parsed.data.service_order_id}`);
  return { ok: true };
}

export async function togglePhotoVisibility(photoId, osId, _prev, formData) {
  const { supabase } = await requireStaff();
  const visible = formData.get('visible') === 'true';
  const { error } = await supabase.from('service_order_photos').update({ visible_to_customer: visible }).eq('id', photoId);
  if (error) return actionError('os.photoVisibility', error);
  revalidatePath(`/painel/os/${osId}`);
  return { ok: true };
}

export async function deletePhoto(photoId, osId) {
  const { supabase } = await requireStaff(MANAGER_ROLES);
  const { data: photo } = await supabase.from('service_order_photos').select('storage_path').eq('id', photoId).maybeSingle();
  if (!photo) return { ok: false, error: 'Foto não encontrada.' };
  const { error } = await supabase.from('service_order_photos').delete().eq('id', photoId);
  if (error) return actionError('os.deletePhoto', error);
  await supabase.storage.from('service-order-photos').remove([photo.storage_path]);
  revalidatePath(`/painel/os/${osId}`);
  return { ok: true, message: 'Foto excluída.' };
}
