import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { readAdminConfig, verifySession, SESSION_HOURS } from './token';

export const ADMIN_COOKIE = 'tf_admin';

/** Cookie só vai para /admin, só pelo servidor, e nunca em pedidos vindos de outros sites. */
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/admin',
  maxAge: SESSION_HOURS * 3600,
};

export function adminConfig() {
  return readAdminConfig();
}

export async function getAdminSession() {
  const cfg = adminConfig();
  if (!cfg) return null;
  const jar = await cookies();
  return verifySession(cfg, jar.get(ADMIN_COOKIE)?.value);
}

/** Use no topo de toda página, Server Action e rota da área admin. */
export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/entrar');
  return session;
}

export async function clientIp() {
  const h = await headers();
  const raw = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || '';
  return /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : null;
}
