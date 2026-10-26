import Link from 'next/link';
import { Lock } from 'lucide-react';
import { requireAdmin } from '@/features/admin/session';
import { allowedApps, appHome } from '@/features/admin/permissions';

export const metadata = { title: 'Sem acesso' };

export default async function AdminNoAccessPage() {
  const session = await requireAdmin();
  // Atalhos para o que a conta pode abrir: a primeira página de cada aplicação liberada.
  const links = allowedApps(session)
    .map((app) => ({ href: appHome(session, app.key), label: app.name }))
    .filter((l) => l.href);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-slate-200 text-slate-600">
        <Lock className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">Sua conta não tem acesso a esta parte</h1>
      <p className="mt-2 text-sm text-slate-600">
        Se precisar, peça ao administrador master para liberar em Acessos.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/admin" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
          Aplicações
        </Link>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
            {l.label}
          </Link>
        ))}
      </div>
      {!links.length && <p className="mt-4 text-sm text-slate-500">Nenhuma aplicação está liberada para você ainda.</p>}
    </div>
  );
}
