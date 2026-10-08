import Link from 'next/link';
import { Logo } from '@/components/layout/logo';

export default function AuthLayout({ children }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <Link href="/" className="mb-8"><Logo /></Link>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  );
}
