import Link from 'next/link';
import { ArrowRight, ExternalLink, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { requireAdmin } from '@/features/admin/session';
import { allowedApps, appHome } from '@/features/admin/permissions';
import { appSummary } from '@/features/admin/app-summaries';
import { AppIcon } from '@/features/admin/components/app-icon';
import { formatDateTime } from '@/lib/dates';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Aplicações' };

const TONES = { positive: 'text-emerald-700', warning: 'text-amber-700', negative: 'text-red-700' };

/** Tela inicial da central: as aplicações que a conta abre, com os números principais de cada uma. */
export default async function AdminHubPage() {
  const session = await requireAdmin();
  const apps = allowedApps(session);
  const summaries = await Promise.all(apps.map((app) => appSummary(session, app.key)));

  return (
    <>
      <PageHeader
        title="Aplicações"
        description={`Atualizado em ${formatDateTime(new Date())} · escolha uma aplicação para ver os detalhes.`}
      />

      {!apps.length && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-medium text-slate-900">Nenhuma aplicação liberada para a sua conta</p>
          <p className="mt-1 text-sm text-slate-500">Peça ao administrador master para liberar em Acessos.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {apps.map((app, i) => {
          const summary = summaries[i] || { stats: [] };
          const home = appHome(session, app.key);
          return (
            <section key={app.key} aria-labelledby={`app-${app.key}`} className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <AppIcon appKey={app.key} size="lg" />
                  <div className="min-w-0">
                    <h2 id={`app-${app.key}`} className="text-lg font-semibold text-slate-900">{app.name}</h2>
                    <p className="text-sm text-slate-500">{app.tagline}</p>
                  </div>
                </div>
                {app.site && (
                  <a href={app.site} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                    {app.site.replace(/^https?:\/\//, '')} <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>

              <div className="flex-1 px-5 py-4">
                {summary.stats.length > 0 ? (
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {summary.stats.map((s) => (
                      <div key={s.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                        <dt className="text-xs text-slate-500">{s.label}</dt>
                        <dd className={cn('tabular mt-0.5 text-xl font-semibold tracking-tight text-slate-900', TONES[s.tone])}>{s.value}</dd>
                        {s.hint && <dd className="mt-0.5 text-[11px] leading-tight text-slate-500">{s.hint}</dd>}
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-slate-500">{summary.note || 'Sem números para mostrar.'}</p>
                )}
              </div>

              <div className="border-t border-slate-100 px-5 py-3">
                {home ? (
                  <Link href={home} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                    Abrir {app.name} <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="text-sm text-slate-500">Nenhuma tela desta aplicação está liberada para você.</p>
                )}
              </div>
            </section>
          );
        })}

        {session.master && (
          <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Plus className="size-6" aria-hidden="true" />
            </span>
            <p className="mt-3 font-medium text-slate-900">Próxima aplicação</p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              Quando você criar outra aplicação, ela entra aqui com os números dela, e você escolhe em Acessos quem pode abrir.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
