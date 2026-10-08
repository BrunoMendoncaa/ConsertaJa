'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth';
import { actionError } from '@/lib/errors';
import { parseForm } from '@/lib/forms';
import { MANAGER_ROLES } from '@/lib/constants';
import { customerSchema, toCustomerRow } from './schemas';

export async function createCustomer(_prev, formData) {
  const { supabase } = await requireStaff();
  const parsed = parseForm(customerSchema, formData);
  if (!parsed.data) return parsed;

  const { data, error } = await supabase.from('customers').insert(toCustomerRow(parsed.data)).select('id').single();
  if (error) return actionError('customers.create', error, 'Não foi possível salvar o cliente.');
  revalidatePath('/painel/clientes');
  redirect(`/painel/clientes/${data.id}`);
}

export async function updateCustomer(id, _prev, formData) {
  const { supabase } = await requireStaff();
  const parsed = parseForm(customerSchema, formData);
  if (!parsed.data) return parsed;

  const { error } = await supabase.from('customers').update(toCustomerRow(parsed.data)).eq('id', id);
  if (error) return actionError('customers.update', error, 'Não foi possível salvar o cliente.');
  revalidatePath(`/painel/clientes/${id}`);
  return { ok: true, message: 'Cliente atualizado.' };
}

export async function deleteOrAnonymizeCustomer(id) {
  const { supabase } = await requireStaff(MANAGER_ROLES);
  const { count } = await supabase.from('service_orders').select('id', { count: 'exact', head: true }).eq('customer_id', id);

  if (!count) {
    await supabase.from('equipment').delete().eq('customer_id', id);
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) return actionError('customers.delete', error, 'Não foi possível excluir o cliente.');
    revalidatePath('/painel/clientes');
    redirect('/painel/clientes');
  }

  // Com histórico de OS: anonimiza (LGPD) em vez de apagar.
  const { error } = await supabase.rpc('anonymize_customer', { p_customer_id: id });
  if (error) return actionError('customers.anonymize', error, 'Não foi possível anonimizar o cliente.');
  revalidatePath(`/painel/clientes/${id}`);
  return { ok: true, message: 'Dados pessoais removidos. O histórico de OS foi mantido sem identificação.' };
}

export async function revokePortalAccess(id) {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc('revoke_customer_portal_sessions', { p_customer_id: id });
  if (error) return actionError('customers.revokePortal', error);
  return { ok: true, message: data ? `${data} acesso(s) ao portal encerrado(s).` : 'Nenhum acesso ativo ao portal.' };
}

/** Busca rápida (wizard de OS): nome, telefone ou CPF/CNPJ. */
export async function searchCustomers(term) {
  const { supabase } = await requireStaff();
  const q = String(term || '').trim();
  if (q.length < 2) return [];
  const digits = q.replace(/\D/g, '');
  const safe = q.replace(/[^\p{L}\p{N}\s.'-]/gu, ' ').trim();

  const filters = [];
  if (safe) filters.push(`name.ilike.%${safe}%`);
  if (digits.length >= 4) {
    filters.push(`phone_e164.ilike.%${digits}%`, `document.ilike.%${digits}%`);
  }
  if (!filters.length) return [];

  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, document')
    .is('anonymized_at', null)
    .or(filters.join(','))
    .order('name')
    .limit(10);
  return data || [];
}
