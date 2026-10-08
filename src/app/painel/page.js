import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { PeriodFilter } from '@/components/ui/period-filter';
import { CashFlowChart } from '@/features/dashboard/components/cash-flow-chart';
import { OS_STATUS, OPEN_STATUSES } from '@/lib/constants';
import { formatBRL } from '@/lib/money';
import { formatDate, formatDateTime, resolvePeriod } from '@/lib/dates';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage({ searchParams }) {
  const ctx = await requireStaff();
  const { supabase, assistance, profile } = ctx;
  const sp = await searchParams;
  const period = resolvePeriod(sp);

  const [{ data: summary, error }, { data: recent }] = await Promise.all([
    supabase.rpc('dashboard_summary', { p_from: period.from, p_to: period.to }),
    supabase.from('v_service_orders').select('id, code, status, customer_name, brand, model, updated_at')
      .order('updated_at', { ascending: false }).limit(8),
  ]);

  const os = summary?.os || {};
  const budgets = summary?.budgets || {};
  const f = summary?.finance;
  const byStatus = os.by_status || {};
  const maxStatus = Math.max(1, ...Object.values(byStatus));
  const decided = (budgets.approved_in_period || 0) + (budgets.refused_in_period || 0);
  const approvalRate = decided ? Math.round(((budgets.approved_in_period || 0) / decided) * 100) : null;

  return (
    <>
      <PageHeader
        title={`Olá, ${(profile?.full_name || '').split(' ')[0] || 'bem-vindo'}!`}
        description={assistance.name}
        actions={<ButtonLink href="/painel/os/nova"><Plus className="size-4" aria-hidden="true" /> Nova OS</ButtonLink>}
      />

      {sp?.aviso === 'sem-permissao' && <Alert variant="warning" className="mb-6">Você não tem permissão para acessar aquela página.</Alert>}
      {error && <Alert variant="error" className="mb-6">Não foi possível carregar os indicadores agora.</Alert>}

      <div className="mb-6"><PeriodFilter period={period} /></div>

      <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="OS abertas" value={os.open ?? 0} hint="Agora" />
        <StatCard label="Atrasadas" value={os.overdue ?? 0} hint="Previsão vencida" tone={os.overdue ? 'negative' : 'default'} />
        <StatCard label="Aguardando cliente" value={budgets.pending ?? 0} hint="Orçamentos em aberto" tone={budgets.pending ? 'warning' : 'default'} />
        <StatCard label="Entraram" value={os.opened_in_period ?? 0} hint="No período" />
        <StatCard label="Concluídas" value={os.completed_in_period ?? 0} hint="No período" />
        <StatCard label="Entregues" value={os.delivered_in_period ?? 0} hint="No período" />
      </section>

      {f && (
        <section className="mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Entradas" value={formatBRL(f.inflow)} tone="positive" />
            <StatCard label="Saídas" value={formatBRL(f.outflow)} tone="negative" />
            <StatCard label="Saldo do período" value={formatBRL(f.balance)} tone={Number(f.balance) >= 0 ? 'default' : 'negative'} />
            <StatCard label="Faturamento" value={formatBRL(f.revenue)} hint="Recebimentos de OS e taxas" />
            <StatCard label="Previsto" value={formatBRL(f.forecast)} hint="Orçamentos enviados" />
            <StatCard label="A receber" value={formatBRL(f.receivable)} hint="Aprovado, ainda não pago" tone="warning" />
            <StatCard label="Ticket médio" value={formatBRL(f.average_ticket)} hint="OS reparadas e entregues" />
            <StatCard label="Aprovação de orçamentos" value={approvalRate === null ? '—' : `${approvalRate}%`}
              hint={`${budgets.approved_in_period || 0} aprovados · ${budgets.refused_in_period || 0} recusados`} />
          </div>
          <Card>
            <CardHeader title="Fluxo de caixa" description={`${formatDate(period.from)} a ${formatDate(period.to)}`}
              actions={<Link href={`/painel/caixa?periodo=${period.key}&de=${period.from}&ate=${period.to}`} className="text-sm font-medium text-brand-700 hover:underline">Abrir caixa</Link>} />
            <CardContent><CashFlowChart daily={f.daily} /></CardContent>
          </Card>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="OS por status" description="Ordens em andamento agora" />
          <CardContent>
            <ul className="space-y-2.5">
              {OPEN_STATUSES.map((s) => (
                <li key={s}>
                  <Link href={`/painel/os?status=${s}`} className="group grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-3 text-sm">
                    <span className="truncate text-slate-700 group-hover:text-slate-900">{OS_STATUS[s].label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-brand-500" style={{ width: `${((byStatus[s] || 0) / maxStatus) * 100}%` }} />
                    </span>
                    <span className="tabular text-right font-medium text-slate-900">{byStatus[s] || 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Movimentação recente" actions={<Link href="/painel/os" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">Todas <ArrowRight className="size-3.5" aria-hidden="true" /></Link>} />
          {recent?.length ? (
            <ul className="divide-y divide-slate-100">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/painel/os/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{o.code} · <span className="font-normal text-slate-600">{o.customer_name}</span></p>
                      <p className="truncate text-xs text-slate-500">{[o.brand, o.model].filter(Boolean).join(' ')} · {formatDateTime(o.updated_at)}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardContent className="text-sm text-slate-500">
              Nenhuma OS ainda. <Link href="/painel/os/nova" className="font-medium text-brand-700 hover:underline">Abra a primeira</Link>.
            </CardContent>
          )}
        </Card>
      </div>
    </>
  );
}
