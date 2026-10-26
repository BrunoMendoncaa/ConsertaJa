/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
];

// Endereços antigos do sistema. Quando NEXT_PUBLIC_SITE_URL aponta para o domínio próprio
// (ex.: https://tecnofix.pro), quem abrir um link antigo (portal do cliente, convite, QR code)
// é levado para o mesmo caminho no domínio novo. /api (webhook do Mercado Pago e rotina
// diária) não é redirecionado. Redirecionamento temporário (307): fácil de desfazer.
const OLD_HOSTS = ['conserta-ja.vercel.app'];

function publicHost() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).host;
  } catch {
    return null;
  }
}

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Links curtos de campanha: mostram a página inicial e marcam a origem da visita
  // (ver src/features/analytics/constants.js). Ex.: https://tecnofix.pro/14dias
  async rewrites() {
    // /grupos é uma página própria (src/app/(site)/grupos), com o cartão de link dos posts em grupos.
    return ['/14dias', '/gratis', '/anuncio'].map((source) => ({ source, destination: '/' }));
  },
  async redirects() {
    // Área admin virou central de aplicações: as telas do TecnoFix foram para /admin/tecnofix.
    const adminMoved = ['assistencias', 'usuarios', 'site', 'exportar'].flatMap((page) => [
      { source: `/admin/${page}`, destination: `/admin/tecnofix/${page}`, permanent: false },
      { source: `/admin/${page}/:path*`, destination: `/admin/tecnofix/${page}/:path*`, permanent: false },
    ]);
    const host = publicHost();
    if (!host || OLD_HOSTS.includes(host) || host.startsWith('localhost') || host.startsWith('127.')) return adminMoved;
    return [...adminMoved, ...OLD_HOSTS.map((old) => ({
      source: '/:path((?!api/).*)',
      has: [{ type: 'host', value: old }],
      destination: `https://${host}/:path`,
      permanent: false,
    }))];
  },
};

export default nextConfig;
