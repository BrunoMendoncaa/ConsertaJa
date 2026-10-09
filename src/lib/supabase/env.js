// Variáveis públicas (podem ir ao navegador).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Endereço público do sistema. Aceita "conserta-ja.vercel.app" sem o https:// (completa sozinho).
// Sem NEXT_PUBLIC_SITE_URL, na Vercel usa o domínio de produção do projeto (variável de sistema da Vercel).
const RAW_SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL
  || process.env.VERCEL_PROJECT_PRODUCTION_URL
  || process.env.VERCEL_URL
  || 'http://localhost:3000'
).trim().replace(/\/+$/, '');
export const SITE_URL = /^https?:\/\//i.test(RAW_SITE_URL) ? RAW_SITE_URL : `https://${RAW_SITE_URL}`;

export function assertSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      'Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local (veja .env.example).'
    );
  }
}
