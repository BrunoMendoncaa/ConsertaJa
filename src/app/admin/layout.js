// Área administrativa do TecnoFix (só o dono do sistema). Fora do painel das assistências
// e fora dos buscadores.
export const metadata = {
  title: { default: 'Admin', template: '%s · Admin TecnoFix' },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }) {
  return children;
}
