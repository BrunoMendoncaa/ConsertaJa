import Link from 'next/link';
import { Lock } from 'lucide-react';
import { requireAdmin } from '@/features/admin/session';
import { allowedSections } from '@/features/admin/permissions';

export const metadata = { title: 'Sem acesso' };

export default async function AdminNoAccessPage() {
  const session = await requireAdmin();
  const sections = allowedSections(session);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-slate-200 text-slate-600">
        <Lock className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">Sua conta não tem acesso a esta parte</h1>
      <p className="mt-2 text-sm text-slate-600">
        Se precisar, peça ao administrador master para liberar em Acessos.
      </p>
      {sections.length > 0 ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
              {s.label}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-500">Nenhuma parte da área admin está liberada para você ainda.</p>
      )}
    </div>
  );
}
