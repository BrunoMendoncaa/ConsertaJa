// De onde veio a visita: campanha (utm), site de origem (referrer) ou app do navegador.

const NAMED_SOURCES = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  google: 'Google',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  email: 'E-mail',
  portal: 'Portal do cliente',
};

/** Nome do site de origem a partir do host (google.com.br -> Google). */
export function sourceFromHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  if (!h) return null;
  if (/(^|\.)google\./.test(h)) return 'Google';
  if (/(^|\.)bing\.com$/.test(h)) return 'Bing';
  if (/(^|\.)instagram\.com$/.test(h)) return 'Instagram';
  if (/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$/.test(h)) return 'Facebook';
  if (/(^|\.)whatsapp\.com$|(^|\.)wa\.me$/.test(h)) return 'WhatsApp';
  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(h)) return 'YouTube';
  if (/(^|\.)tiktok\.com$/.test(h)) return 'TikTok';
  if (/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/.test(h)) return 'LinkedIn';
  if (/(^|\.)t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/.test(h)) return 'X (Twitter)';
  return h;
}

/** Host do referrer, ou null se vazio, inválido ou do próprio site. */
export function referrerHost(referrer, siteHost) {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).host.toLowerCase();
    const own = String(siteHost || '').toLowerCase().replace(/^www\./, '');
    if (!host || host.replace(/^www\./, '') === own) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

/**
 * Origem legível de uma visita (primeiro evento da visita).
 * Campanha > site de origem > app (navegador do Instagram/Facebook) > sem origem.
 */
export function originOf(e) {
  if (e.utm_source) {
    const key = String(e.utm_source).toLowerCase();
    const name = NAMED_SOURCES[key] || e.utm_source;
    return e.utm_campaign ? `${name} · ${e.utm_campaign}` : name;
  }
  const fromHost = sourceFromHost(e.referrer_host);
  if (fromHost) return fromHost;
  if (e.browser === 'Instagram' || e.browser === 'Facebook') return e.browser;
  return 'Sem origem (link direto, WhatsApp ou app)';
}
