import LandingPage from '../page';

// tecnofix.pro/grupos: a mesma página inicial, com o cartão de link próprio para posts em grupos do Facebook.
// O cartão (opengraph-image.jpg desta pasta) é clicável no post e leva direto ao site.
// A origem "Facebook · grupos" é marcada pelo SiteTracker (CAMPAIGN_PATHS em src/features/analytics/constants.js).
const TITLE = 'TecnoFix: sistema para assistência técnica | 14 dias grátis';
const DESCRIPTION = 'OS em 1 minuto, orçamento aprovado pelo celular do cliente e garantia na entrega. Teste grátis, sem cartão, e ganhe mais 14 dias pelo WhatsApp.';

export const metadata = {
  // Mesmo conteúdo da página inicial: fica fora do Google para não duplicar.
  robots: { index: false, follow: true },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'TecnoFix',
    url: '/grupos',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default LandingPage;
