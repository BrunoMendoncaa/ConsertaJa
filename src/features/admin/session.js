import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { logError } from '@/lib/logger';
import { readAdminConfig, verifySession, SESSION_HOURS } from './token';
import { PERMISSION_KEYS, normalizePermissions, can } from './permissions';

export const ADMIN_COOKIE = 'tf_admin';

/** Cookie só vai para /admin, só pelo servidor, e nunca em pedidos vindos de outros sites. */
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/admin',
  maxAge: SESSION_HOURS * 3600,
};

export const ACCOUNT_COLUMNS = 'id, username, full_name, permissions, active, must_change_password, session_version, last_login_at, created_at, created_by, updated_at, password_changed_at';

export function adminConfig() {
  return readAdminConfig();
}

/**
 * Sessão da área admin (uma vez por pedido):
 * - master: { master: true, username, permissions: todas }
 * - conta do banco: { master: false, id, username, name, permissions, mustChangePassword }
 * A conta do banco é conferida a cada pedido: desativada, apagada ou com a senha trocada, a sessão cai.
 */
export const getAdminSession = cache(async () => {
  const cfg = adminConfig();
  if (!cfg) return null;
  const jar = await cookies();
  const token = verifySession(cfg, jar.get(ADMIN_COOKIE)?.value);
  if (!token) return null;
  if (token.master) {
    return { master: true, username: cfg.username, name: null, permissions: PERMISSION_KEYS, mustChangePassword: false, expiresAt: token.expiresAt };
  }
  const { data, error } = await createAdminClient().from('admin_accounts').select(ACCOUNT_COLUMNS)
    .eq('username', token.username).maybeSingle();
  if (error) {
    logError('admin.session', error);
    return null;
  }
  if (!data || !data.active || data.session_version !== token.sv) return null;
  return {
    master: false,
    id: data.id,
    username: data.username,
    name: data.full_name,
    permissions: normalizePermissions(data.permissions),
    mustChangePassword: data.must_change_password,
    sessionVersion: data.session_version,
    expiresAt: token.expiresAt,
  };
});

function denied(session, permission) {
  if (!permission) return false;
  if (permission === 'master') return !session.master;
  return !can(session, permission);
}

/**
 * Use no topo de toda página da área admin (o layout sozinho não protege: numa navegação
 * dentro do app o Next.js pode carregar só a página). permission: chave de permissions.js,
 * 'master' ou null (só precisa estar logado).
 */
export async function requireAdmin(permission = null, { allowPasswordChange = false } = {}) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/entrar');
  if (session.mustChangePassword && !allowPasswordChange) redirect('/admin/minha-senha');
  if (denied(session, permission)) redirect('/admin/sem-acesso');
  return session;
}

/** Para Server Actions: devolve { session } ou { error } (sem redirecionar quando falta permissão). */
export async function actionSession(permission = null) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/entrar');
  if (session.mustChangePassword) return { error: 'Troque sua senha antes de continuar.' };
  if (denied(session, permission)) return { error: 'Sua conta não tem permissão para isso. Fale com o administrador master.' };
  return { session };
}

export async function clientIp() {
  const h = await headers();
  const raw = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || '';
  return /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : null;
}
