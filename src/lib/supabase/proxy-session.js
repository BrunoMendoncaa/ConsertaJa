import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Renova a sessão do Supabase a cada requisição e protege /painel.
 * A autorização de verdade continua no banco (RLS); aqui só redirecionamos
 * quem não está logado.
 */
export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Não coloque código entre a criação do cliente e getClaims().
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const path = request.nextUrl.pathname;
  const needsAuth = path.startsWith('/painel') || path.startsWith('/onboarding');
  if (!user && needsAuth) {
    const login = request.nextUrl.clone();
    login.pathname = '/entrar';
    login.search = `?proximo=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }

  return response;
}
