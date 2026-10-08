import Link from 'next/link';
import { Logo } from '@/components/layout/logo';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo />
      <h1 className="text-2xl font-semibold text-slate-900">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-slate-500">O endereço pode ter mudado ou você não tem acesso a este conteúdo.</p>
      <Link href="/" className="text-sm font-medium text-brand-700 hover:underline">Voltar ao início</Link>
    </main>
  );
}
