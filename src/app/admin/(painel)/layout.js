import Link from 'next/link';
import { Wrench, LogOut } from 'lucide-react';
import { requireAdmin } from '@/features/admin/session';
import { adminSignOut } from '@/features/admin/actions';
import { AdminNav } from '@/features/admin/components/admin-nav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const session = await requireAdmin();
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-sm print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/admin" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-brand-600">
              <Wrench className="size-4" aria-hidden="true" />
            </span>
            <span>Tecno<span className="text-accent-500">Fix</span></span>
            <span className="rounded bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-900">Admin</span>
          </Link>
          <AdminNav />
          <form action={adminSignOut} className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:inline">{session.username}</span>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
              <LogOut className="size-4" aria-hidden="true" /> Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
