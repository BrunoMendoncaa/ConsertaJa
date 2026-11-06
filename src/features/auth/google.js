import 'server-only';
import { headers } from 'next/headers';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabase/env';
import { isInAppBrowser, inAppName, isAndroid } from '@/lib/in-app-browser';

/**
 * O login com Google está ligado no Supabase (Authentication → Sign In / Providers → Google)?
 * Lê /auth/v1/settings (público) e guarda por 5 minutos. Desligado ou sem resposta: o botão não aparece,
 * para ninguém cair numa tela de erro antes de a configuração terminar.
 */
export async function googleEnabled() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = await res.json();
    return Boolean(body?.external?.google);
  } catch {
    return false;
  }
}

/** Dados do navegador para o botão do Google (navegador embutido do Instagram/Facebook etc.). */
export async function browserInfo() {
  const ua = (await headers()).get('user-agent') || '';
  return { inApp: isInAppBrowser(ua), app: inAppName(ua), android: isAndroid(ua) };
}
