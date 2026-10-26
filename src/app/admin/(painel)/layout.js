import Link from 'next/link';
import { LayoutGrid, LogOut, KeyRound } from 'lucide-react';
import { requireAdmin } from '@/features/admin/session';
import { hubSections, allowedApps, appSections, appHome } from '@/features/admin/permissions';
import { adminSignOut } from '@/features/admin/actions';
import { AdminNav } from '@/features/admin/components/admin-nav';
import { RefreshButton } from '@/features/admin/components/refresh-button';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  // Cada página confere a própria permissão; aqui só o login (e deixa abrir a troca de senha).
  const session = await requireAdmin(null, { allowPasswordChange: true });
  // Antes de trocar a senha obrigatória, nada de menu.
  const locked = session.mustChangePassword;
  const hubItems = locked ? [] : hubSections(session).map(({ href, label }) => ({ href, label }));
  const apps = locked ? [] : allowedApps(session).map((app) => ({
    key: app.key, name: app.name, base: app.base,
    home: appHome(session, app.key), items: appSections(session, app.key),
  }));
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-sm print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/admin" className="flex items-center gap-2 font-semibold tracking-tight" title="Todas as aplicações">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-slate-700">
              <LayoutGrid className="size-4" aria-hidden="true" />
            </span>
            <span>Central</span>
            <span className="rounded bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-900">Admin</span>
          </Link>
          <AdminNav hubItems={hubItems} apps={apps} master={session.master} />
          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <RefreshButton renderedAt={new Date().toISOString()} />
            {!session.master && (
              <Link href="/admin/minha-senha" className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white" title="Trocar minha senha">
                <KeyRound className="size-4" aria-hidden="true" /><span className="hidden lg:inline">Minha senha</span>
              </Link>
            )}
            <form action={adminSignOut} className="flex items-center gap-3">
              <span className="hidden text-sm text-slate-400 sm:inline">
                {session.name || session.username}
                {session.master && <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">Master</span>}
              </span>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
                <LogOut className="size-4" aria-hidden="true" /> Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
