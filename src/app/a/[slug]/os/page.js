import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, LogOut } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { portalCall } from '@/features/portal/queries';
import { formatDate } from '@/lib/dates';
import { formatBRL } from '@/lib/money';

export default async function PortalOrdersPage({ params }) {
  const { slug } = await params;
  const [me, list] = await Promise.all([portalCall(slug, 'portal_me'), portalCall(slug, 'portal_list_orders')]);
  if (me.expired || list.expired) redirect(`/a/${slug}?expirada=1`);

  const name = (me.data?.[0]?.customer_name || '').split(' ')[0];
  const orders = list.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Olá{name ? `, ${name}` : ''}!</h1>
          <p className="mt-1 text-slate-600">Seus equipamentos nesta assistência.</p>
        </div>
        <form action={`/a/${slug}/sair`} method="post">
          <button className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
            <LogOut className="size-4" aria-hidden="true" /> Sair
          </button>
        </form>
      </div>

      {orders.length === 0 && <p className="rounded-xl bg-white p-6 text-center text-slate-500">Nenhuma OS encontrada.</p>}

      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.code}>
            <Link href={`/a/${slug}/os/${o.code}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-slate-900">{[o.brand, o.model].filter(Boolean).join(' ') || o.category}</p>
                  <p className="text-sm text-slate-500">{o.code} · entrada em {formatDate(o.received_at)}</p>
                </div>
                <ChevronRight className="mt-1 size-5 shrink-0 text-slate-400" aria-hidden="true" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={o.status} customer />
                {o.estimated_completion_at && !['PRONTO', 'ENTREGUE', 'CANCELADO'].includes(o.status) && (
                  <span className="text-xs text-slate-500">Previsão: {formatDate(o.estimated_completion_at)}</span>
                )}
              </div>
              {o.pending_budget_total !== null && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                  Orçamento de {formatBRL(o.pending_budget_total)} aguardando sua aprovação →
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
