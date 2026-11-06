// Navegador embutido de apps (Instagram, Facebook, Messenger, TikTok...). O Google não deixa
// entrar com a conta Google dentro deles ("Erro 403: disallowed_useragent"), e é por eles
// que chega quem clica nos anúncios. Nesses casos o botão do Google explica como abrir no
// navegador em vez de levar a uma tela de erro.

const IN_APP_RE = /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Instagram|Messenger|MessengerLite|LinkedInApp|\bLine\/|Snapchat|TikTok|musical_ly|BytedanceWebview|Pinterest|; wv\)/i;

/** O user-agent é de um navegador embutido em app (webview)? */
export function isInAppBrowser(userAgent) {
  return IN_APP_RE.test(String(userAgent || ''));
}

/** Nome do app, para a mensagem ("navegador do Instagram"). */
export function inAppName(userAgent) {
  const ua = String(userAgent || '');
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/Messenger/i.test(ua)) return 'Messenger';
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return 'Facebook';
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'TikTok';
  if (/LinkedInApp/i.test(ua)) return 'LinkedIn';
  return null;
}

export function isAndroid(userAgent) {
  return /Android/i.test(String(userAgent || ''));
}

/**
 * Link que, no Android, abre o mesmo endereço no Chrome (sai do navegador do app).
 * Se o Chrome não estiver instalado, o Android abre o endereço normal.
 */
export function chromeIntentUrl(href) {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
}
