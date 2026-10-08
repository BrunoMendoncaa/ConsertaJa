import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, assertSupabaseEnv } from './env';

/**
 * Cliente Supabase com a sessão do usuário logado (cookies).
 * Toda consulta feita com ele passa pelo RLS.
 */
export async function createClient() {
  // cookies() primeiro: marca a rota como dinâmica antes de qualquer outra coisa.
  const cookieStore = await cookies();
  assertSupabaseEnv();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de um Server Component: o proxy.js renova a sessão.
        }
      },
    },
  });
}
