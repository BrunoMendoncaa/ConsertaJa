'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/supabase/env';
import { requireStaff } from '@/lib/auth';
import { actionError } from '@/lib/errors';
import {
  parseForm, z, optionalText, optionalPhone, email, document, optionalMoney, optionalInt, uuid,
} from '@/lib/forms';
import { MANAGER_ROLES } from '@/lib/constants';

// ---------------------------------------------------------------- Onboarding
const assistanceSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da assistência.').max(120),
  slug: z.string().trim().toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens (ex.: assistencia-silva).')
    .min(3, 'Mínimo de 3 caracteres.').max(50),
});

export async function createAssistance(_prev, formData) {
  const parsed = parseForm(assistanceSchema, formData);
  if (!parsed.data) return parsed;

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_assistance', { p_name: parsed.data.name, p_slug: parsed.data.slug });
  if (error) return actionError('tenancy.createAssistance', error, 'Não foi possível criar a assistência.');
  redirect('/painel');
}

export async function switchAssistance(formData) {
  const id = String(formData.get('assistance_id') || '');
  const supabase = await createClient();
  await supabase.rpc('switch_assistance', { p_assistance_id: id });
  redirect('/painel');
}

// ---------------------------------------------------------------- Convites
export async function acceptInvitation(_prev, formData) {
  const token = String(formData.get('token') || '');
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_invitation', { p_token: token });
  if (error) return actionError('tenancy.acceptInvitation', error, 'Não foi possível aceitar o convite.');
  redirect('/painel');
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  role: z.enum(['admin', 'technician', 'attendant'], { error: 'Escolha a função.' }),
});

export async function createInvitation(_prev, formData) {
  const { supabase, assistance } = await requireStaff(MANAGER_ROLES);
  const parsed = parseForm(inviteSchema, formData);
  if (!parsed.data) return parsed;

  const { data: token, error } = await supabase.rpc('create_invitation', {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return actionError('tenancy.createInvitation', error, 'Não foi possível criar o convite.');

  revalidatePath('/painel/usuarios');
  const link = `${SITE_URL}/convite/${token}`;
  return {
    ok: true,
    message: `Convite criado para ${parsed.data.email}. Envie o link abaixo (vale por 7 dias).`,
    data: {
      link,
      whatsappText: `Olá! Você foi convidado(a) para a equipe da ${assistance.name} no Conserta Já. Crie sua conta ou entre com o e-mail ${parsed.data.email} e acesse: ${link}`,
    },
  };
}

export async function revokeInvitation(_prev, formData) {
  const { supabase } = await requireStaff(MANAGER_ROLES);
  const id = String(formData.get('id') || '');
  const { error } = await supabase
    .from('assistance_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('accepted_at', null);
  if (error) return actionError('tenancy.revokeInvitation', error);
  revalidatePath('/painel/usuarios');
  return { ok: true, message: 'Convite cancelado.' };
}

const memberSchema = z.object({
  user_id: uuid(),
  role: z.enum(['owner', 'admin', 'technician', 'attendant']),
  active: z.enum(['true', 'false']).transform((v) => v === 'true'),
});

export async function updateMember(_prev, formData) {
  const { supabase } = await requireStaff(MANAGER_ROLES);
  const parsed = parseForm(memberSchema, formData);
  if (!parsed.data) return parsed;

  const { data, error } = await supabase
    .from('assistance_members')
    .update({ role: parsed.data.role, active: parsed.data.active })
    .eq('user_id', parsed.data.user_id)
    .select('user_id');
  if (error) return actionError('tenancy.updateMember', error, 'Não foi possível atualizar o acesso.');
  if (!data?.length) return { ok: false, error: 'Você não tem permissão para alterar este acesso.' };
  revalidatePath('/painel/usuarios');
  return { ok: true, message: 'Acesso atualizado.' };
}

// ---------------------------------------------------------------- Configurações
const addressSchema = z.object({
  cep: optionalText(9), rua: optionalText(150), numero: optionalText(20), complemento: optionalText(80),
  bairro: optionalText(80), cidade: optionalText(80), uf: optionalText(2),
});

const settingsSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome.').max(120),
  legal_name: optionalText(150),
  document: document(),
  phone: optionalPhone(),
  whatsapp: optionalPhone(),
  email: email(),
  brand_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida.').optional().nullable()
    .transform((v) => v || null),
  business_hours: optionalText(200),
  welcome_message: optionalText(500),
  warranty_policy: optionalText(2000),
  entry_terms: optionalText(3000),
  default_payment_terms: optionalText(500),
  default_budget_validity_days: optionalInt(1, 90, 'Validade entre 1 e 90 dias.'),
  default_warranty_days: optionalInt(0, 3650, 'Garantia entre 0 e 3650 dias.'),
  diagnosis_fee: optionalMoney(),
  portal_show_photos: z.string().optional().transform((v) => v === 'on'),
});

export async function updateAssistanceSettings(_prev, formData) {
  const { supabase, assistance } = await requireStaff(MANAGER_ROLES);
  const parsed = parseForm(settingsSchema, formData);
  if (!parsed.data) return parsed;
  const addr = addressSchema.safeParse({
    cep: formData.get('cep'), rua: formData.get('rua'), numero: formData.get('numero'),
    complemento: formData.get('complemento'), bairro: formData.get('bairro'),
    cidade: formData.get('cidade'), uf: formData.get('uf'),
  });

  const { portal_show_photos, ...fields } = parsed.data;
  const { error } = await supabase
    .from('assistances')
    .update({
      ...fields,
      default_budget_validity_days: fields.default_budget_validity_days ?? 10,
      default_warranty_days: fields.default_warranty_days ?? 90,
      address: addr.success ? Object.fromEntries(Object.entries(addr.data).filter(([, v]) => v)) : assistance.address,
      settings: { ...(assistance.settings || {}), portal_show_photos },
    })
    .eq('id', assistance.id);
  if (error) return actionError('tenancy.updateSettings', error, 'Não foi possível salvar as configurações.');

  revalidatePath('/painel', 'layout');
  return { ok: true, message: 'Configurações salvas.' };
}

export async function setLogo(path) {
  const { supabase, assistance } = await requireStaff(MANAGER_ROLES);
  if (path !== null && (typeof path !== 'string' || !path.startsWith(`${assistance.id}/`))) {
    return { ok: false, error: 'Arquivo inválido.' };
  }
  const { error } = await supabase.from('assistances').update({ logo_path: path }).eq('id', assistance.id);
  if (error) return actionError('tenancy.setLogo', error);
  revalidatePath('/painel', 'layout');
  return { ok: true };
}

// ---------------------------------------------------------------- Categorias
export async function addCategory(_prev, formData) {
  const { supabase } = await requireStaff(MANAGER_ROLES);
  const name = String(formData.get('name') || '').trim();
  if (name.length < 2) return { ok: false, fieldErrors: { name: 'Informe o nome.' }, error: 'Revise os campos.' };
  const { error } = await supabase.from('equipment_categories').insert({ name, sort_order: 500 });
  if (error) return actionError('tenancy.addCategory', error);
  revalidatePath('/painel/configuracoes');
  return { ok: true, message: 'Categoria criada.' };
}

export async function toggleCategory(_prev, formData) {
  const { supabase } = await requireStaff(MANAGER_ROLES);
  const id = String(formData.get('id') || '');
  const active = formData.get('active') === 'true';
  const { error } = await supabase.from('equipment_categories').update({ active }).eq('id', id);
  if (error) return actionError('tenancy.toggleCategory', error);
  revalidatePath('/painel/configuracoes');
  return { ok: true };
}

// ---------------------------------------------------------------- Minha conta
const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Informe seu nome.').max(120),
  phone: optionalPhone(),
});

export async function updateProfile(_prev, formData) {
  const { supabase, user } = await requireStaff();
  const parsed = parseForm(profileSchema, formData);
  if (!parsed.data) return parsed;
  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', user.id);
  if (error) return actionError('tenancy.updateProfile', error);
  revalidatePath('/painel', 'layout');
  return { ok: true, message: 'Dados atualizados.' };
}
