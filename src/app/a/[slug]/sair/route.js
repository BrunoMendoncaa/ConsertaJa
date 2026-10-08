import { NextResponse } from 'next/server';
import { createAnonClient } from '@/lib/supabase/anon';
import { getPortalToken, clearPortalToken, isValidSlug } from '@/lib/portal-session';

export async function POST(request, { params }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) return new NextResponse('Not found', { status: 404 });
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return new NextResponse('Origem inválida', { status: 403 });
  }
  const token = await getPortalToken(slug);
  if (token) await createAnonClient().rpc('portal_logout', { p_token: token });
  await clearPortalToken(slug);
  return NextResponse.redirect(new URL(`/a/${slug}`, request.url), { status: 303 });
}
