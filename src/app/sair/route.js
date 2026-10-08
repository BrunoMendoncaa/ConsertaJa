import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
  // Só aceita o POST vindo do próprio site (evita logout forçado por outro site).
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return new NextResponse('Origem inválida', { status: 403 });
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/entrar', request.url), { status: 303 });
}
