import 'server-only';
import { cookies, headers } from 'next/headers';

// Uma sessão por assistência: o nome e o path do cookie incluem o slug.
const cookieName = (slug) => `cj_portal_${slug}`;
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export async function getPortalToken(slug) {
  const store = await cookies();
  return store.get(cookieName(slug))?.value || null;
}

export async function setPortalToken(slug, token) {
  const store = await cookies();
  store.set(cookieName(slug), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/a/${slug}`,
    maxAge: MAX_AGE,
  });
}

export async function clearPortalToken(slug) {
  const store = await cookies();
  store.set(cookieName(slug), '', { httpOnly: true, path: `/a/${slug}`, maxAge: 0 });
}

/** IP e navegador do cliente (registrados na decisão do orçamento). */
export async function requestFingerprint() {
  const h = await headers();
  // Na Vercel, x-vercel-forwarded-for / x-real-ip vêm da própria plataforma (não do navegador).
  const forwarded = h.get('x-vercel-forwarded-for') || h.get('x-real-ip') || h.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0].trim() || null;
  return { ip, userAgent: h.get('user-agent') || null };
}

/** Slug só com caracteres esperados (evita lixo em cookie/path). */
export function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 50;
}
