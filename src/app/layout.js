import './globals.css';

export const metadata = {
  title: { default: 'Conserta Já · Gestão para assistências técnicas', template: '%s · Conserta Já' },
  description:
    'Ordens de serviço, orçamentos com aprovação online, fotos de entrada, portal do cliente e caixa para assistências técnicas.',
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
