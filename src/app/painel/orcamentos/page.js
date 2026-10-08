import Link from 'next/link';
import { FileText } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Table, THead, TBody, TH, TD } from '@/components/ui/table';
import { BudgetStatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatBRL } from '@/lib/money';
import { formatDate, todayISO } from '@/lib/dates';
import { DECISION_CHANNELS } from '@/lib/constants';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Orçamentos' };

const FILTERS = [
  ['aguardando', 'Aguardando cliente'],
  ['rascunhos', 'Rascunhos'],
  ['aprovados', 'Aprovados'],
  ['recusados', 'Recusados'],
  ['vencidos', 'Vencidos'],
  ['todos', 'Todos'],
];

export default async function BudgetsPage({ searchParams }) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp?.filtro) ? sp.filtro : 'aguardando';
  const today = todayISO();

  let q = supabase.from('v_budget_versions').select('*').order('created_at', { ascending: false }).limit(200);
  if (filter === 'aguardando') q = q.eq('status', 'ENVIADO').gte('valid_until', today);
  if (filter === 'rascunhos') q = q.eq('status', 'RASCUNHO');
  if (filter === 'aprovados') q = q.eq('status', 'APROVADO');
  if (filter === 'recusados') q = q.eq('status', 'RECUSADO');
  if (filter === 'vencidos') q = q.eq('status', 'ENVIADO').lt('valid_until', today);
  const { data: rows } = await q;

  const total = (rows || []).reduce((acc, r) => acc + Number(r.total || 0), 0);

  return (
    <>
      <PageHeader title="Orçamentos" description={`${rows?.length || 0} orçamento(s) · ${formatBRL(total)}`} />
      <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`?filtro=${k}`}
            className={cn('whitespace-nowrap rounded-full px-3 py-1.5 text-sm',
              filter === k ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>
            {label}
          </Link>
        ))}
      </div>
      <Card>
        {rows?.length ? (
          <Table>
            <THead><tr><TH>OS</TH><TH>Cliente</TH><TH className="hidden md:table-cell">Equipamento</TH><TH>Versão</TH><TH className="text-right">Total</TH><TH>Status</TH><TH className="hidden lg:table-cell">Data</TH></tr></THead>
            <TBody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <TD><Link href={`/painel/os/${r.service_order_id}/orcamento?versao=${r.version}`} className="font-medium text-slate-900 hover:text-brand-700">{r.service_order_code}</Link></TD>
                  <TD>{r.customer_name}</TD>
                  <TD className="hidden md:table-cell">{[r.brand, r.model].filter(Boolean).join(' ') || r.category_name}</TD>
                  <TD>v{r.version}</TD>
                  <TD className="tabular whitespace-nowrap text-right font-medium text-slate-900">{formatBRL(r.total)}</TD>
                  <TD><BudgetStatusBadge status={r.status} expired={r.is_expired} /></TD>
                  <TD className="hidden whitespace-nowrap text-xs lg:table-cell">
                    {r.decided_at ? `${DECISION_CHANNELS[r.decision_channel]} · ${formatDate(r.decided_at)}`
                      : r.sent_at ? `Enviado ${formatDate(r.sent_at)} · vence ${formatDate(r.valid_until)}` : `Criado ${formatDate(r.created_at)}`}
                  </TD>
                </tr>
              ))}
            </TBody>
          </Table>
        ) : <EmptyState icon={FileText} title="Nenhum orçamento neste filtro" />}
      </Card>
    </>
  );
}
