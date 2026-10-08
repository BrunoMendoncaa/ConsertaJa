import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Usuário logado (validado pelo Supabase) ou null. Uma vez por requisição. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  return claims ? { id: claims.sub, email: claims.email } : null;
});

/**
 * Contexto da equipe: usuário, perfil, assistência ativa e papel.
 * O tenant vem do banco (profiles.active_assistance_id + vínculo ativo), nunca da URL.
 */
export const getStaffContext = cache(async () => {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { supabase, user: null, profile: null, assistance: null, role: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, phone, active_assistance_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.active_assistance_id) return { supabase, user, profile, assistance: null, role: null };

  const [{ data: assistance }, { data: member }] = await Promise.all([
    supabase.from('assistances').select('*').eq('id', profile.active_assistance_id).maybeSingle(),
    supabase
      .from('assistance_members')
      .select('role, active')
      .eq('assistance_id', profile.active_assistance_id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (!assistance || !member?.active) return { supabase, user, profile, assistance: null, role: null };
  return { supabase, user, profile, assistance, role: member.role };
});

/**
 * Exige usuário logado com assistência ativa (e, opcionalmente, um dos papéis).
 * Use no topo de páginas e Server Actions do painel.
 */
export async function requireStaff(roles) {
  const ctx = await getStaffContext();
  if (!ctx.user) redirect('/entrar');
  if (!ctx.assistance) redirect('/onboarding');
  if (roles && !roles.includes(ctx.role)) redirect('/painel?aviso=sem-permissao');
  return ctx;
}

export function can(ctx, roles) {
  return Boolean(ctx?.role && roles.includes(ctx.role));
}
