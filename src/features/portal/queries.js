import 'server-only';
import { cache } from 'react';
import { createAnonClient } from '@/lib/supabase/anon';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPortalToken, isValidSlug } from '@/lib/portal-session';

export const getPortalAssistance = cache(async (slug) => {
  if (!isValidSlug(slug)) return null;
  const supabase = createAnonClient();
  const { data } = await supabase.rpc('portal_assistance', { p_slug: slug });
  return data?.[0] || null;
});

/**
 * Chama uma função portal_* com o token do cookie.
 * Retorna { data } ou { expired: true } quando a sessão não vale mais.
 */
export async function portalCall(slug, fn, args = {}) {
  const token = await getPortalToken(slug);
  if (!token) return { expired: true };
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc(fn, { p_token: token, p_slug: slug, ...args });
  if (error) {
    if (error.code === 'PT401') return { expired: true };
    throw error;
  }
  return { data };
}

/** URLs assinadas (10 min) só para os caminhos que a função do portal já autorizou. */
export async function signPortalPhotos(photos) {
  if (!photos?.length || !process.env.SUPABASE_SECRET_KEY) return [];
  const admin = createAdminClient();
  const { data } = await admin.storage.from('service-order-photos').createSignedUrls(photos.map((p) => p.path), 600);
  const byPath = new Map((data || []).map((s) => [s.path, s.signedUrl]));
  return photos.map((p) => ({ ...p, url: byPath.get(p.path) || null })).filter((p) => p.url);
}
