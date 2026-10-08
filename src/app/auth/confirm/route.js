import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Retorno dos links de e-mail do Supabase Auth (confirmação, recuperação, convite).
// Aceita o fluxo PKCE (?code=) e o fluxo por token_hash (?token_hash=&type=).
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const nextParam = searchParams.get('next') || '/painel';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/painel';

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
