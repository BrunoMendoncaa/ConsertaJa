import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Table, THead, TBody, TH, TD } from '@/components/ui/table';
import { PeriodFilter } from '@/components/ui/period-filter';
import { Alert } from '@/components/ui/alert';
import { formatBRL } from '@/lib/money';
import { formatDate, resolvePeriod } from '@/lib/dates';
import { PAYMENT_METHODS, CASH_CATEGORIES, MANAGER_ROLES } from '@/lib/constants';

export const metadata = { title: 'Relatórios' };

function Bars({ rows, label, value, format = (v) => v }) {
  const max = Math.max(1, ...rows.map((r) => Number(r[value])));
  if (!rows.length) return <p className="text-sm text-slate-500">Sem dados no período.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r[label]} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-slate-700">{r._label || r[label]}</span>
          <span className="h-2 overflow-hidden rounded-full bg-slate-100">
            <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(Number(r[value]) / max) * 100}%` }} />
          </span>
          <span className="tabular text-right font-medium text-slate-900">{format(r[value])}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportsPage({ searchParams }) {
  const { supabase } = await requireStaff(MANAGER_ROLES);
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const { data: r, error } = await supabase.rpc('report_summary', { p_from: period.from, p_to: period.to });

  const inflow = (r?.inflow_by_method || []).map((x) => ({ ...x, _label: PAYMENT_METHODS[x.method] }));
  const outflow = (r?.outflow_by_category || []).map((x) => ({ ...x, _label: CASH_CATEGORIES[x.category]?.label }));
  const orders = r?.orders || [];
  const totals = orders.reduce((acc, o) => ({
    approved: acc.approved + Number(o.approved_total), received: acc.received + Number(o.received),
    costs: acc.costs + Number(o.costs), profit: acc.profit + Number(o.profit),
  }), { approved: 0, received: 0, costs: 0, profit: 0 });

  return (
    <>
      <PageHeader title="Relatórios" description={`${formatDate(period.from)} a ${formatDate(period.to)}`} />
      <div className="mb-6"><PeriodFilter period={period} /></div>
      {error && <Alert variant="error" className="mb-6">{error.message}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recebimentos por forma de pagamento" />
          <CardContent><Bars rows={inflow} label="method" value="total" format={formatBRL} /></CardContent>
        </Card>
        <Card>
          <CardHeader title="Saídas por categoria" />
          <CardContent><Bars rows={outflow} label="category" value="total" format={formatBRL} /></CardContent>
        </Card>
        <Card>
          <CardHeader title="OS entregues por técnico" />
          <CardContent><Bars rows={r?.by_technician || []} label="technician" value="delivered" /></CardContent>
        </Card>
        <Card>
          <CardHeader title="Entradas por categoria de equipamento" />
          <CardContent><Bars rows={r?.by_category || []} label="category" value="received" /></CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Lucro estimado por OS entregue" description="Recebido − peças compradas para a OS." />
        {orders.length ? (
          <>
          <ul className="divide-y divide-slate-100 sm:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/painel/os/${o.id}`} className="block px-4 py-3 active:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{o.code}</p>
                      <p className="truncate text-sm text-slate-600">{o.customer}</p>
                    </div>
                    <p className={`tabular shrink-0 text-right text-sm font-semibold ${Number(o.profit) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatBRL(o.profit)}<span className="block text-[11px] font-normal text-slate-500">lucro</span>
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Aprovado {formatBRL(o.approved_total)} · recebido {formatBRL(o.received)} · custos {formatBRL(o.costs)}</p>
                </Link>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-3 bg-slate-50 px-4 py-3 text-sm font-semibold">
              <span>Total</span>
              <span className="tabular">{formatBRL(totals.profit)}</span>
            </li>
          </ul>
          <div className="hidden sm:block">
          <Table>
            <THead><tr><TH>OS</TH><TH>Cliente</TH><TH className="text-right">Aprovado</TH><TH className="text-right">Recebido</TH><TH className="text-right">Custos</TH><TH className="text-right">Lucro</TH></tr></THead>
            <TBody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <TD><Link href={`/painel/os/${o.id}`} className="font-medium text-slate-900 hover:text-brand-700">{o.code}</Link></TD>
                  <TD>{o.customer}</TD>
                  <TD className="tabular text-right">{formatBRL(o.approved_total)}</TD>
                  <TD className="tabular text-right">{formatBRL(o.received)}</TD>
                  <TD className="tabular text-right">{formatBRL(o.costs)}</TD>
                  <TD className={`tabular text-right font-semibold ${Number(o.profit) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatBRL(o.profit)}</TD>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <TD colSpan={2}>Total</TD>
                <TD className="tabular text-right">{formatBRL(totals.approved)}</TD>
                <TD className="tabular text-right">{formatBRL(totals.received)}</TD>
                <TD className="tabular text-right">{formatBRL(totals.costs)}</TD>
                <TD className="tabular text-right">{formatBRL(totals.profit)}</TD>
              </tr>
            </TBody>
          </Table>
          </div>
          </>
        ) : <CardContent className="text-sm text-slate-500">Nenhuma OS entregue no período.</CardContent>}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Orçamentos recusados" description="Motivos informados pelos clientes." />
        {r?.refusals?.length ? (
          <ul className="divide-y divide-slate-100">
            {r.refusals.map((x, i) => (
              <li key={i} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{x.code} · v{x.version} · {formatBRL(x.total)}</p>
                  <p className="text-slate-600">{x.reason}</p>
                </div>
                <span className="text-xs text-slate-500">{formatDate(x.at)}</span>
              </li>
            ))}
          </ul>
        ) : <CardContent className="text-sm text-slate-500">Nenhuma recusa no período.</CardContent>}
      </Card>
    </>
  );
}
