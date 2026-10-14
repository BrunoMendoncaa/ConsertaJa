import 'server-only';
import { MANAGER_ROLES } from '@/lib/constants';
import { isProfileComplete } from './profile';

export const COMPLETE_PROFILE_PATH = '/painel/configuracoes?completar=1';

/**
 * Para onde levar quem acabou de entrar (ou trocou de assistência).
 * Proprietário/administrador de assistência com cadastro incompleto vai direto para Configurações.
 * Não bloqueia nada: é só a primeira tela. Qualquer falha na consulta mantém o destino normal.
 */
export async function landingPath(supabase, userId, fallback = '/painel') {
  if (!userId) return fallback;
  try {
    const { data: profile } = await supabase
      .from('profiles').select('active_assistance_id').eq('id', userId).maybeSingle();
    const assistanceId = profile?.active_assistance_id;
    if (!assistanceId) return fallback;

    const [{ data: assistance }, { data: member }] = await Promise.all([
      supabase.from('assistances').select('phone, whatsapp, address').eq('id', assistanceId).maybeSingle(),
      supabase.from('assistance_members').select('role, active')
        .eq('assistance_id', assistanceId).eq('user_id', userId).maybeSingle(),
    ]);
    if (assistance && member?.active && MANAGER_ROLES.includes(member.role) && !isProfileComplete(assistance)) {
      return COMPLETE_PROFILE_PATH;
    }
  } catch {
    // segue para o destino normal
  }
  return fallback;
}
