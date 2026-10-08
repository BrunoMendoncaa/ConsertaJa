import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/** Situação da assinatura da assistência ativa (uma vez por requisição). */
export const getBillingStatus = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('billing_status');
  if (error) return null; // banco sem a migration 0011: não bloqueia nada na tela
  return data;
});
