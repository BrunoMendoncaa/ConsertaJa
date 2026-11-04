import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/supabase/env';

const isPath = (p) => typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/\\');

/**
 * Destino depois do link. Vem de `next` (caminho) ou de `redirect_to`, que é o endereço
 * pedido no cadastro ({{ .RedirectTo }} do modelo do Supabase, ex.: /auth/confirm?next=/onboarding).
 * Só aceita endereço deste site.
 */
function destination(searchParams, origin) {
  const next = searchParams.get('next');
  if (isPath(next)) return next;
  const raw = searchParams.get('redirect_to');
  if (raw) {
    try {
      const url = new URL(raw);
      const own = [origin, new URL(SITE_URL).origin];
      if (own.includes(url.origin)) {
        if (url.pathname === '/auth/confirm') {
          const inner = url.searchParams.get('next');
          if (isPath(inner)) return inner;
        } else if (isPath(url.pathname) && url.pathname !== '/') {
          return `${url.pathname}${url.search}`;
        }
      }
    } catch {
      // endereço inválido: segue o padrão
    }
  }
  return '/painel';
}

// Retorno dos links de e-mail do Supabase Auth (confirmação, recuperação, convite).
// Aceita o fluxo PKCE (?code=) e o fluxo por token_hash (?token_hash=&type=).
// Com token_hash o link funciona em qualquer navegador (o modelo de e-mail usa esse).
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const next = destination(searchParams, origin);

  const supabase = await createClient();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  let error = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else {
    error = new Error('missing params');
  }

  if (error) return NextResponse.redirect(`${origin}/entrar?erro=link`);
  return NextResponse.redirect(`${origin}${next}`);
}
