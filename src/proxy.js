import { updateSession } from '@/lib/supabase/proxy-session';

export async function proxy(request) {
  return updateSession(request);
}

export const config = {
  // O portal do cliente (/a/...) não usa sessão do Supabase Auth.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|a/|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
