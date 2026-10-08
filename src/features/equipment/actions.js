'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { actionError } from '@/lib/errors';
import { parseForm } from '@/lib/forms';
import { equipmentSchema } from './schemas';

export async function createEquipment(customerId, _prev, formData) {
  const { supabase } = await requireStaff();
  const parsed = parseForm(equipmentSchema, formData);
  if (!parsed.data) return parsed;

  const { error } = await supabase.from('equipment').insert({ ...parsed.data, customer_id: customerId });
  if (error) return actionError('equipment.create', error, 'Não foi possível salvar o equipamento.');
  revalidatePath(`/painel/clientes/${customerId}`);
  return { ok: true, message: 'Equipamento cadastrado.' };
}

export async function updateEquipment(id, _prev, formData) {
  const { supabase } = await requireStaff();
  const parsed = parseForm(equipmentSchema, formData);
  if (!parsed.data) return parsed;

  const { error } = await supabase.from('equipment').update(parsed.data).eq('id', id);
  if (error) return actionError('equipment.update', error, 'Não foi possível salvar o equipamento.');
  revalidatePath(`/painel/equipamentos/${id}`);
  return { ok: true, message: 'Equipamento atualizado.' };
}

/** Equipamentos de um cliente (wizard de OS). */
export async function listCustomerEquipment(customerId) {
  const { supabase } = await requireStaff();
  const { data } = await supabase
    .from('equipment')
    .select('id, brand, model, serial_number, imei, color, category:equipment_categories!equipment_category_fk(name)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  return data || [];
}
