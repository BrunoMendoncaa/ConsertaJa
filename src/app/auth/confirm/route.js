import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/supabase/env';
import { landingPath } from '@/features/tenancy/landing';

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

/** Volta para a tela de onde a pessoa saiu (cadastro ou entrar) com o aviso do Google. */
function googleErrorPath(searchParams, next) {
  const mode = searchParams.get('modo') === 'cadastro' ? 'cadastro' : 'entrar';
  const keep = next !== '/onboarding' && next !== '/painel' ? `&proximo=${encodeURIComponent(next)}` : '';
  // access_denied = a pessoa cancelou na tela do Google
  const kind = searchParams.get('error') === 'access_denied' ? 'google-cancelado' : 'google';
  return `/${mode}?erro=${kind}${keep}`;
}

// Retorno dos links de e-mail do Supabase Auth (confirmação, recuperação, convite) e do login com Google.
// Aceita o fluxo PKCE (?code=) e o fluxo por token_hash (?token_hash=&type=).
// Com token_hash o link funciona em qualquer navegador (o modelo de e-mail usa esse).
// Login com Google: vem com ?via=google (ver signInWithGoogle) e, se der errado, ?error=...
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const next = destination(searchParams, origin);
  const viaGoogle = searchParams.get('via') === 'google';

  if (viaGoogle && searchParams.get('error')) {
    return NextResponse.redirect(`${origin}${googleErrorPath(searchParams, next)}`);
  }

  const supabase = await createClient();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  let error = null;
  let data = null;
  if (code) {
    ({ data, error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else {
    error = new Error('missing params');
  }

  if (error) return NextResponse.redirect(`${origin}${viaGoogle ? googleErrorPath(searchParams, next) : '/entrar?erro=link'}`);
  // Entrou sem destino: mesma regra do login com senha (cadastro da loja incompleto → Configurações).
  const userId = data?.user?.id || data?.session?.user?.id;
  const to = next === '/painel' ? await landingPath(supabase, userId) : next;
  return NextResponse.redirect(`${origin}${to}`);
}
