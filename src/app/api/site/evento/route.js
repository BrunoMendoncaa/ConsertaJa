import { createAdminClient } from '@/lib/supabase/admin';
import { buildEvent } from '@/features/analytics/record';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Recebe as visitas e cliques das páginas públicas (componente SiteTracker) e grava
// em site_events pela função track_site_event (migration 0016). Responde sempre 204:
// quem visita o site nunca vê erro por causa da contagem.
const NO_CONTENT = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
const MISSING = ['PGRST202', 'PGRST205', '42883', '42P01'];

export async function POST(request) {
  let body;
  try {
    const text = await request.text();
    if (text.length > 4000) return NO_CONTENT();
    body = JSON.parse(text);
  } catch {
    return NO_CONTENT();
  }

  const salt = process.env.ANALYTICS_SALT || process.env.SUPABASE_SECRET_KEY || '';
  const built = buildEvent({ headers: request.headers, body, salt });
  if (!built.ok) return NO_CONTENT();

  try {
    const { error } = await createAdminClient().rpc('track_site_event', built.row);
    // Banco sem a migration 0016: ignora em silêncio (a tela Site avisa o que falta).
    if (error && !MISSING.includes(error.code)) logError('site.track', error);
  } catch (err) {
    logError('site.track', err);
  }
  return NO_CONTENT();
}
