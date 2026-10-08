import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { requireStaff, can } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Table, THead, TBody, TH, TD } from '@/components/ui/table';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PeriodFilter } from '@/components/ui/period-filter';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Input } from '@/components/ui/input';
import { TransactionForm } from '@/features/finance/components/transaction-form';
import { voidCashTransaction } from '@/features/finance/actions';
import { formatBRL } from '@/lib/money';
import { formatDate, resolvePeriod } from '@/lib/dates';
import { CASH_CATEGORIES, PAYMENT_METHODS, MANAGER_ROLES, TECH_ROLES } from '@/lib/constants';

export const metadata = { title: 'Caixa' };

export default async function CashPage({ searchParams }) {
  const ctx = await requireStaff();
  const { supabase, role } = ctx;
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const isManager = can(ctx, MANAGER_ROLES);

  const start = `${period.from}T00:00:00-03:00`;
  const endDate = new Date(`${period.to}T12:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = `${endDate.toISOString().slice(0, 10)}T00:00:00-03:00`;

  const [{ data: txs }, summaryRes, { data: receivables }, { data: suppliers }] = await Promise.all([
    supabase.from('v_cash_transactions').select('*').gte('occurred_at', start).lt('occurred_at', end)
      .order('occurred_at', { ascending: false }).limit(300),
    isManager ? supabase.rpc('dashboard_summary', { p_from: period.from, p_to: period.to }) : Promise.resolve({ data: null }),
    isManager
      ? supabase.from('v_service_order_financials').select('service_order_id, code, customer_name, status, approved_total, received, balance_due')
        .gt('balance_due', 0).neq('status', 'CANCELADO').order('balance_due', { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    can(ctx, TECH_ROLES) ? supabase.from('suppliers').select('id, name').eq('active', true).order('name') : Promise.resolve({ data: [] }),
  ]);
  const f = summaryRes.data?.finance;

  return (
    <>
      <PageHeader
        title={isManager ? 'Caixa' : 'Meus lançamentos'}
        description={isManager ? 'Entradas e saídas reais. Previsto e a receber vêm dos orçamentos.' : 'Recebimentos e compras que você registrou.'}
      />

      <div className="mb-6"><PeriodFilter period={period} /></div>

      {isManager && f && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Entradas" value={formatBRL(f.inflow)} tone="positive" />
          <StatCard label="Saídas" value={formatBRL(f.outflow)} tone="negative" />
          <StatCard label="Saldo do período" value={formatBRL(f.balance)} tone={f.balance >= 0 ? 'default' : 'negative'} />
          <StatCard label="Previsto" value={formatBRL(f.forecast)} hint="Orçamentos aguardando o cliente" />
          <StatCard label="A receber" value={formatBRL(f.receivable)} hint="Aprovado e ainda não pago" tone="warning" />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Lançamentos" description={`${formatDate(period.from)} a ${formatDate(period.to)}`} />
            {txs?.length ? (
              <Table>
                <THead><tr><TH>Data</TH><TH>Descrição</TH><TH className="hidden md:table-cell">Forma</TH><TH className="text-right">Valor</TH>{isManager && <TH />}</tr></THead>
                <TBody>
                  {txs.map((t) => (
                    <tr key={t.id} className={t.voided_at ? 'opacity-50' : ''}>
                      <TD className="whitespace-nowrap">{formatDate(t.occurred_at)}</TD>
                      <TD>
                        <p className={`text-slate-900 ${t.voided_at ? 'line-through' : ''}`}>{t.description}</p>
                        <p className="text-xs text-slate-500">
                          {CASH_CATEGORIES[t.category].label}
                          {t.service_order_code && <> · <Link href={`/painel/os/${t.service_order_id}`} className="hover:underline">{t.service_order_code}</Link></>}
                          {t.supplier_name && ` · ${t.supplier_name}`}
                          {t.created_by_name && ` · ${t.created_by_name}`}
                        </p>
                        {t.voided_at && <p className="text-xs text-red-600">Anulado: {t.void_reason}</p>}
                      </TD>
                      <TD className="hidden md:table-cell">{PAYMENT_METHODS[t.payment_method]}</TD>
                      <TD className={`tabular whitespace-nowrap text-right font-medium ${t.direction === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {t.direction === 'IN' ? '+' : '−'} {formatBRL(t.amount)}
                      </TD>
                      {isManager && (
                        <TD className="text-right">
                          {!t.voided_at && (
                            <details className="inline-block text-left">
                              <summary className="cursor-pointer text-xs text-slate-500 hover:text-red-600">Anular</summary>
                              <ActionForm action={voidCashTransaction.bind(null, t.id)} className="mt-2 flex w-56 gap-1">
                                <Input name="reason" placeholder="Motivo" className="h-8" />
                                <SubmitButton variant="danger" size="sm">OK</SubmitButton>
                              </ActionForm>
                            </details>
                          )}
                        </TD>
                      )}
                    </tr>
                  ))}
                </TBody>
              </Table>
            ) : <EmptyState icon={Wallet} title="Nenhum lançamento no período" />}
          </Card>

          {isManager && (
            <Card>
              <CardHeader title="A receber por OS" description="Orçamentos aprovados com saldo em aberto." />
              {receivables?.length ? (
                <Table>
                  <THead><tr><TH>OS</TH><TH>Cliente</TH><TH className="text-right">Aprovado</TH><TH className="text-right">Recebido</TH><TH className="text-right">Em aberto</TH></tr></THead>
                  <TBody>
                    {receivables.map((r) => (
                      <tr key={r.service_order_id}>
                        <TD><Link href={`/painel/os/${r.service_order_id}`} className="font-medium text-slate-900 hover:text-brand-700">{r.code}</Link></TD>
                        <TD>{r.customer_name}</TD>
                        <TD className="tabular text-right">{formatBRL(r.approved_total)}</TD>
                        <TD className="tabular text-right">{formatBRL(r.received)}</TD>
                        <TD className="tabular text-right font-semibold text-amber-700">{formatBRL(r.balance_due)}</TD>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              ) : <CardContent className="text-sm text-slate-500">Nada a receber.</CardContent>}
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader title="Novo lançamento" />
          <CardContent>
            <TransactionForm role={role} suppliers={suppliers || []} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
