import './globals.css';
import { SITE_URL } from '@/lib/supabase/env';

const SHARE_TITLE = 'TecnoFix: sistema grátis para assistência técnica';
const SHARE_DESCRIPTION =
  'Ordem de serviço, orçamento aprovado pelo celular do cliente, garantia e caixa. Grátis, sem prazo e sem cartão de crédito.';

// O cartão que aparece ao compartilhar o link (WhatsApp, Facebook, LinkedIn) usa
// openGraph + a imagem src/app/opengraph-image.jpg (1200x630), servida pelo próprio Next.
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'TecnoFix · Gestão para assistências técnicas', template: '%s · TecnoFix' },
  description:
    'Ordens de serviço, orçamentos com aprovação online, fotos de entrada, portal do cliente e caixa para assistências técnicas.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'TecnoFix',
    url: '/',
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
  },
};

export const viewport = {
  themeColor: '#1d4ed8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
