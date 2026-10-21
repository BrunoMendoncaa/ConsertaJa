import Link from 'next/link';
import { Search, Download, CircleCheck, CircleAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Table, THead, TH, TBody, TD } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { listAssistances, AdminSetupError } from '@/features/admin/queries';
import {
  SITUATION_FILTERS, matchesSituation, matchesQuery, dueInfo, monthlyValue, cycleLabel, profileComplete,
} from '@/features/admin/format';
import { SituationBadge, DueCell, OwnerContact, SetupNotice } from '@/features/admin/components/bits';
import { formatBRL } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { Building2 } from 'lucide-react';
import { requireAdmin } from '@/features/admin/session';
import { can } from '@/features/admin/permissions';

export const metadata = { title: 'Assistências' };

const SORTS = [
  ['vencimento', 'Vencimento mais próximo'],
  ['recentes', 'Mais recentes'],
  ['uso', 'Mais OS em 30 dias'],
  ['nome', 'Nome'],
];

function sortRows(rows, sort) {
  const r = [...rows];
  if (sort === 'recentes') return r.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (sort === 'uso') return r.sort((a, b) => b.orders_30d - a.orders_30d || b.orders - a.orders);
  if (sort === 'nome') return r.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  // vencimento: sem data por último
  return r.sort((a, b) => (dueInfo(a).days ?? 1e9) - (dueInfo(b).days ?? 1e9));
}

export default async function AdminAssistancesPage({ searchParams }) {
  const session = await requireAdmin('assistencias_ver');
  const money = can(session, 'financeiro');
  const canExport = can(session, 'assistencias_exportar');
  const sp = await searchParams;
  const filter = SITUATION_FILTERS.some(([k]) => k === sp?.situacao) ? sp.situacao : 'todas';
  const q = typeof sp?.q === 'string' ? sp.q.slice(0, 80) : '';
  const sort = SORTS.some(([k]) => k === sp?.ordem) ? sp.ordem : 'vencimento';

  let all;
  try {
    all = await listAssistances();
  } catch (err) {
    if (err instanceof AdminSetupError) return <><PageHeader title="Assistências" /><SetupNotice message={err.message} /></>;
    throw err;
  }
  const rows = sortRows(all.filter((a) => matchesSituation(a, filter) && matchesQuery(a, q)), sort);
  const counts = Object.fromEntries(SITUATION_FILTERS.map(([k]) => [k, all.filter((a) => matchesSituation(a, k)).length]));
  const qs = (extra) => {
    const p = new URLSearchParams({ situacao: filter, ...(q ? { q } : {}), ordem: sort, ...extra });
    return `?${p.toString()}`;
  };
  const csvHref = `/admin/exportar?${new URLSearchParams({ situacao: filter, ...(q ? { q } : {}), ordem: sort }).toString()}`;

  return (
    <>
      <PageHeader
        title="Assistências"
        description={`${rows.length} de ${all.length}`}
        actions={canExport ? <ButtonLink href={csvHref} variant="outline" prefetch={false}><Download className="size-4" aria-hidden="true" /> Baixar planilha (CSV)</ButtonLink> : null}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {SITUATION_FILTERS.map(([k, label]) => (
          <Link key={k} href={qs({ situacao: k })}
            className={cn('rounded-full px-3 py-1.5 text-sm', k === filter ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>
            {label} <span className="tabular opacity-70">{counts[k]}</span>
          </Link>
        ))}
      </div>

      <form className="mb-6 flex flex-wrap gap-2" role="search">
        <input type="hidden" name="situacao" value={filter} />
        <label htmlFor="q" className="sr-only">Buscar</label>
        <Input id="q" name="q" defaultValue={q} placeholder="Nome, dono, e-mail, telefone, CNPJ ou cidade" className="min-w-0 basis-full sm:max-w-md sm:flex-1 sm:basis-auto" />
        <label htmlFor="ordem" className="sr-only">Ordenar</label>
        <Select id="ordem" name="ordem" defaultValue={sort} className="w-auto">
          {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </Select>
        <Button type="submit" variant="outline"><Search className="size-4" aria-hidden="true" /> Buscar</Button>
      </form>

      <Card>
        {rows.length ? (
          <>
            {/* Celular: cartões */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {rows.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/assistencias/${a.id}`} className="block px-4 py-3 active:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">{a.name}</span>
                        <span className="block truncate text-xs text-slate-500">{a.owner_name || '—'} · {a.owner_email}</span>
                      </span>
                      <SituationBadge assistance={a} />
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3 text-sm">
                      <span className="text-xs text-slate-500">{a.orders_30d} OS em 30 dias · {a.orders} no total</span>
                      <DueCell assistance={a} compact />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden lg:block">
              <Table>
                <THead>
                  <tr><TH>Assistência</TH><TH>Dono</TH><TH>Situação</TH><TH>Vencimento</TH><TH>Plano</TH><TH className="text-right">OS 30d / total</TH><TH>Cadastro</TH></tr>
                </THead>
                <TBody>
                  {rows.map((a) => (
                    <tr key={a.id} className="align-top">
                      <TD>
                        <Link href={`/admin/assistencias/${a.id}`} className="font-medium text-slate-900 hover:text-brand-700">{a.name}</Link>
                        <p className="text-xs text-slate-500">/{a.slug} · criada em {formatDate(a.created_at)}</p>
                      </TD>
                      <TD>
                        <p className="text-slate-900">{a.owner_name || '—'}</p>
                        <p className="text-xs text-slate-500">{a.owner_email}</p>
                        <OwnerContact assistance={a} />
                      </TD>
                      <TD><SituationBadge assistance={a} /></TD>
                      <TD><DueCell assistance={a} /></TD>
                      <TD>
                        <p className="text-slate-900">{cycleLabel(a.billing_cycle)}</p>
                        {money && monthlyValue(a) > 0 && <p className="text-xs text-slate-500">{formatBRL(monthlyValue(a))}/mês</p>}
                      </TD>
                      <TD className="tabular text-right">
                        <span className="font-medium text-slate-900">{a.orders_30d}</span> <span className="text-slate-400">/ {a.orders}</span>
                        <p className="text-xs text-slate-500">{a.last_order_at ? `última ${formatDate(a.last_order_at)}` : 'nenhuma OS'}</p>
                      </TD>
                      <TD>
                        {profileComplete(a)
                          ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CircleCheck className="size-3.5" aria-hidden="true" /> Completo</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-amber-700"><CircleAlert className="size-3.5" aria-hidden="true" /> Incompleto</span>}
                      </TD>
                    </tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </>
        ) : <EmptyState icon={Building2} title="Nenhuma assistência neste filtro" description="Ajuste a busca ou escolha outra situação." />}
      </Card>
    </>
  );
}
