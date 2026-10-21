// Leitura simples do navegador (User-Agent): tipo de aparelho, navegador, sistema e robôs.
// Só categorias amplas; nada que identifique a pessoa.

const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|facebot|telegrambot|twitterbot|linkedinbot|discordbot|skypeuripreview|embedly|preview|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|python|curl|wget|httpclient|axios|node-fetch|go-http|java\/|okhttp|postman|insomnia/i;
// O robô que monta a prévia do link no WhatsApp se identifica só como "WhatsApp/2.x".
// Um navegador de verdade aberto pelo WhatsApp começa com "Mozilla/" e é gente: conta.
const WHATSAPP_PREVIEW = /^whatsapp\//i;

export function isBot(ua) {
  return !ua || WHATSAPP_PREVIEW.test(ua) || BOT.test(ua);
}

export function parseUserAgent(ua = '') {
  const s = String(ua);
  const device = /iPad|Tablet|PlayBook|Silk|Kindle/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))
    ? 'tablet'
    : /Mobi|iPhone|iPod|Android|Windows Phone/i.test(s) ? 'mobile' : 'desktop';

  let browser = 'Outro';
  if (/Instagram/i.test(s)) browser = 'Instagram';
  else if (/FBAN|FBAV|FB_IAB/i.test(s)) browser = 'Facebook';
  else if (/SamsungBrowser/i.test(s)) browser = 'Samsung Internet';
  else if (/EdgA?\//i.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(s)) browser = 'Opera';
  else if (/Firefox|FxiOS/i.test(s)) browser = 'Firefox';
  else if (/CriOS|Chrome\//i.test(s)) browser = 'Chrome';
  else if (/Safari\//i.test(s)) browser = 'Safari';

  let os = 'Outro';
  if (/Windows/i.test(s)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS';
  else if (/CrOS/i.test(s)) os = 'ChromeOS';
  else if (/Linux/i.test(s)) os = 'Linux';

  return { device, browser, os };
}
