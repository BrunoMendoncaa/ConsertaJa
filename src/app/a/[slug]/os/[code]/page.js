import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, FileText } from 'lucide-react';
import { StatusBadge, BudgetStatusBadge } from '@/components/ui/badge';
import { OrderProgress } from '@/features/portal/components/progress';
import { Timeline } from '@/features/service-orders/components/timeline';
import { portalCall, signPortalPhotos } from '@/features/portal/queries';
import { formatDate } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { OUTCOMES, PHOTO_KINDS } from '@/lib/constants';

export default async function PortalOrderPage({ params }) {
  const { slug, code } = await params;
  const res = await portalCall(slug, 'portal_get_order', { p_code: decodeURIComponent(code) });
  if (res.expired) redirect(`/a/${slug}?expirada=1`);
  const o = res.data;
  if (!o) notFound();

  const photos = await signPortalPhotos(o.photos);
  const pending = o.budgets.find((b) => b.status === 'ENVIADO' && !b.is_expired);
  const eq = o.equipment || {};

  return (
    <div className="space-y-5">
      <Link href={`/a/${slug}/os`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ChevronLeft className="size-4" aria-hidden="true" /> Meus equipamentos
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">{o.code}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{[eq.brand, eq.model].filter(Boolean).join(' ') || eq.category}</h1>
        <div className="mt-2"><StatusBadge status={o.status} customer /></div>
        <div className="mt-5"><OrderProgress status={o.status} /></div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-500">Entrada</dt><dd className="font-medium text-slate-900">{formatDate(o.received_at)}</dd></div>
          <div><dt className="text-slate-500">Previsão</dt><dd className="font-medium text-slate-900">{o.estimated_completion_at ? formatDate(o.estimated_completion_at) : 'Após o diagnóstico'}</dd></div>
          {o.delivered_at && <div><dt className="text-slate-500">Entregue em</dt><dd className="font-medium text-slate-900">{formatDate(o.delivered_at)}</dd></div>}
          {o.warranty_until && <div><dt className="text-slate-500">Garantia até</dt><dd className="font-medium text-slate-900">{formatDate(o.warranty_until)}</dd></div>}
        </dl>
        {o.outcome && o.outcome !== 'REPARADO' && <p className="mt-4 text-sm text-slate-600">{OUTCOMES[o.outcome]}</p>}
      </section>

      {pending && (
        <Link href={`/a/${slug}/os/${o.code}/orcamento`}
          className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--brand)] p-5 text-white shadow-sm hover:opacity-95">
          <div>
            <p className="text-sm text-white/80">Orçamento aguardando sua aprovação</p>
            <p className="tabular text-2xl font-semibold">{formatBRL(pending.total)}</p>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold">Ver e aprovar</span>
        </Link>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Problema relatado</h2>
        <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{o.reported_issue}</p>
        {o.accessories?.length > 0 && <p className="mt-3 text-sm text-slate-600">Acessórios deixados: {o.accessories.join(', ')}</p>}
        {o.customer_notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{o.customer_notes}</p>}
      </section>

      {o.budgets.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Orçamentos</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {o.budgets.map((b) => (
              <li key={b.id}>
                <Link href={`/a/${slug}/os/${o.code}/orcamento?versao=${b.version}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="flex items-center gap-2 whitespace-nowrap text-slate-700"><FileText className="size-4 text-slate-400" aria-hidden="true" /> Versão {b.version}</span>
                  <span className="tabular font-medium text-slate-900">{formatBRL(b.total)}</span>
                  <BudgetStatusBadge status={b.status} expired={b.is_expired} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {photos.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Fotos do equipamento</h2>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <li key={p.path}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={PHOTO_KINDS[p.kind]} className="size-full object-cover" loading="lazy" />
                </a>
                <p className="mt-1 text-center text-[11px] text-slate-500">{PHOTO_KINDS[p.kind]}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-900">Histórico</h2>
        <Timeline events={o.timeline} customerView />
      </section>
    </div>
  );
}
