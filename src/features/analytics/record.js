import crypto from 'node:crypto';
import { z } from 'zod';
import { TRACKED_PATHS, CAMPAIGN_PATHS } from './constants';
import { isBot, parseUserAgent } from './ua';
import { referrerHost } from './sources';

// Monta o evento de acesso a partir do pedido do navegador. Função pura (testável):
// quem grava no banco é a rota /api/site/evento.

const short = (max) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

export const eventSchema = z.object({
  event: z.enum(['page_view', 'cta_click']),
  path: z.string().max(200),
  label: z.string().trim().max(80).regex(/^[a-z0-9-]+$/).optional().nullable(),
  session: z.string().max(64).regex(/^[A-Za-z0-9-]+$/).optional().nullable(),
  ref: z.string().max(500).optional().nullable(),
  utm_source: short(80),
  utm_medium: short(80),
  utm_campaign: short(80),
});

function dayInSaoPaulo(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Código do visitante: muda todo dia e não guarda o IP (hash com sal secreto). */
export function visitorCode({ ip, ua, salt, now = new Date() }) {
  return crypto.createHash('sha256').update(`${salt}|${dayInSaoPaulo(now)}|${ip || ''}|${ua || ''}`).digest('hex').slice(0, 32);
}

export function clientIpFrom(headers) {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headers.get('x-real-ip') || '';
}

function header(headers, name, max) {
  const v = headers.get(name);
  if (!v) return null;
  try {
    return decodeURIComponent(v).slice(0, max) || null;
  } catch {
    return v.slice(0, max) || null;
  }
}

/** Pedido vindo de outro site (ou sem ser do navegador) não conta. */
export function isSameOrigin(headers) {
  const site = headers.get('sec-fetch-site');
  if (site && !['same-origin', 'none'].includes(site)) return false;
  const origin = headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === headers.get('host');
  } catch {
    return false;
  }
}

/**
 * Devolve { ok: true, row } com os campos para track_site_event, ou { ok: false, reason }.
 * headers: Headers do pedido; body: objeto já lido do JSON.
 */
export function buildEvent({ headers, body, salt, now = new Date() }) {
  const ua = headers.get('user-agent') || '';
  if (isBot(ua)) return { ok: false, reason: 'robô' };
  if (!isSameOrigin(headers)) return { ok: false, reason: 'outro site' };
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return { ok: false, reason: 'dados inválidos' };
  const b = parsed.data;
  const path = b.path.split('?')[0].replace(/\/+$/, '') || '/';
  if (!TRACKED_PATHS.includes(path)) return { ok: false, reason: 'página não rastreada' };
  if (b.event === 'cta_click' && !b.label) return { ok: false, reason: 'clique sem botão' };

  const campaign = CAMPAIGN_PATHS[path] || {};
  const { device, browser, os } = parseUserAgent(ua);
  const host = (headers.get('host') || '').split(':')[0];
  return {
    ok: true,
    row: {
      p_event: b.event,
      p_path: path,
      p_visitor: visitorCode({ ip: clientIpFrom(headers), ua, salt, now }),
      p_session: b.session || null,
      p_label: b.event === 'cta_click' ? b.label : null,
      p_referrer_host: referrerHost(b.ref, host),
      p_utm_source: b.utm_source || campaign.utm_source || null,
      p_utm_medium: b.utm_medium || campaign.utm_medium || null,
      p_utm_campaign: b.utm_campaign || campaign.utm_campaign || null,
      p_device: device,
      p_browser: browser,
      p_os: os,
      p_country: header(headers, 'x-vercel-ip-country', 2),
      p_region: header(headers, 'x-vercel-ip-country-region', 10),
      p_city: header(headers, 'x-vercel-ip-city', 80),
    },
  };
}
