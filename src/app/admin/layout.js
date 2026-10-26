// Central admin (só o dono): acompanha as aplicações (hoje o TecnoFix). Fora do painel das assistências
// e fora dos buscadores.
export const metadata = {
  title: { default: 'Central admin', template: '%s · Central admin' },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }) {
  return children;
}
