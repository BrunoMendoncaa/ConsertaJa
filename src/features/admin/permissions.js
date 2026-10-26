// Permissões da área admin. A conta master (variáveis ADMIN_* da Vercel) pode tudo, em todas
// as aplicações; as outras contas (tabela admin_accounts) entram só nas aplicações marcadas
// (apps) e, dentro delas, fazem só o que a master marcar (permissions).
// As permissões de cada aplicação ficam em apps.js. Use can(session, 'chave') na página ou ação.
import { APPS, APP_KEYS, getApp, normalizeApps } from './apps';

export { normalizeApps };

/** Grupos de permissão de todas as aplicações (cada grupo sabe de qual aplicação é). */
export const PERMISSION_GROUPS = APPS.flatMap((app) => app.permissionGroups.map((g) => ({ ...g, app: app.key })));
export const PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((p) => ({ ...p, app: g.app })));
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
const BY_KEY = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p]));

export function permissionLabel(key) {
  return BY_KEY[key]?.label || key;
}

export function permissionApp(key) {
  return BY_KEY[key]?.app || null;
}

/**
 * Só chaves conhecidas, sem repetir, na ordem da lista, e com as que cada uma exige
 * (ex.: estender teste exige ver). Com apps, fica só o que é dessas aplicações.
 */
export function normalizePermissions(list, apps = null) {
  const allowedApps = apps ? new Set(normalizeApps(apps)) : null;
  const known = (k) => BY_KEY[k] && (!allowedApps || allowedApps.has(BY_KEY[k].app));
  const set = new Set((Array.isArray(list) ? list : [list]).map((k) => String(k ?? '')).filter(known));
  for (const k of [...set]) if (BY_KEY[k].requires) set.add(BY_KEY[k].requires);
  return PERMISSION_KEYS.filter((k) => set.has(k));
}

/** A conta entra nesta aplicação? */
export function canApp(session, appKey) {
  if (!session || !getApp(appKey)) return false;
  if (session.master) return true;
  return Array.isArray(session.apps) && session.apps.includes(appKey);
}

/** A conta pode usar esta funcionalidade? (precisa da permissão e da aplicação dela) */
export function can(session, key) {
  if (!session) return false;
  if (session.master) return true;
  return Array.isArray(session.permissions) && session.permissions.includes(key) && canApp(session, permissionApp(key));
}

/** Aplicações que a conta pode abrir. */
export function allowedApps(session) {
  return APPS.filter((a) => canApp(session, a.key));
}

/** Seções do menu de uma aplicação que a conta pode abrir (com o endereço completo). */
export function appSections(session, appKey) {
  const app = getApp(appKey);
  if (!app || !canApp(session, appKey)) return [];
  return app.sections.filter((s) => can(session, s.permission)).map((s) => ({ href: `${app.base}${s.path}`, label: s.label }));
}

/** Primeira página da aplicação que a conta pode abrir (ou null). */
export function appHome(session, appKey) {
  return appSections(session, appKey)[0]?.href || null;
}

// Seções da central (fora das aplicações). "Acessos" é só da master.
export const HUB_SECTIONS = [
  { href: '/admin', label: 'Aplicações', permission: null },
  { href: '/admin/acessos', label: 'Acessos', permission: 'master' },
];

export function hubSections(session) {
  return HUB_SECTIONS.filter((s) => (s.permission === 'master' ? Boolean(session?.master) : Boolean(session)));
}

/** Tela inicial depois de entrar: a central de aplicações. */
export function homeFor() {
  return '/admin';
}

export { APP_KEYS };

export const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;
