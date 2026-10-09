import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './env';

/**
 * Cliente com a CHAVE SECRETA. Ignora o RLS — por isso o uso é restrito a:
 * - assinar URLs de fotos que uma função portal_* já autorizou para a sessão;
 * - gravar a assinatura do TecnoFix depois de conferir no Mercado Pago
 *   (funções billing_* que a equipe não pode executar).
 * Nunca importe este arquivo em um Client Component.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error('Configure SUPABASE_SECRET_KEY no .env.local (somente servidor).');
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
