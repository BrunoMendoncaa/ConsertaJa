import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, assertSupabaseEnv } from './env';

/**
 * Cliente sem sessão (papel anon), usado pelo portal do cliente no servidor.
 * Só consegue chamar as funções portal_*; as tabelas são fechadas para anon.
 */
export function createAnonClient() {
  assertSupabaseEnv();
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
