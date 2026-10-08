import Link from 'next/link';
import { ClipboardList, Plus, Search, Clock } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink, Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { AutoSubmitSelect } from '@/components/ui/auto-submit-select';
import { Table, THead, TBody, TH, TD } from '@/components/ui/table';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { OS_STATUS, OS_STATUS_ORDER, OPEN_STATUSES, PRIORITIES } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { getTechnicians } from '@/features/tenancy/queries';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Ordens de serviço' };
const PAGE_SIZE = 40;

export default async function OrdersPage({ searchParams }) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const status = typeof sp?.status === 'string' ? sp.status : 'abertas';
  const q = typeof sp?.q === 'string' ? sp.q.trim() : '';
  const tech = typeof sp?.tecnico === 'string' ? sp.tecnico : '';
  const page = Math.max(1, Number(sp?.pagina) || 1);

  let query = supabase.from('v_service_orders').select('*', { count: 'exact' })
    .order('received_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status === 'abertas') query = query.in('status', OPEN_STATUSES);
  else if (status === 'atrasadas') query = query.not('status', 'in', '(PRONTO,ENTREGUE,CANCELADO)').lt('estimated_completion_at', new Date().toISOString());
  else if (OS_STATUS[status]) query = query.eq('status', status);

  if (/^[0-9a-f-]{36}$/i.test(tech)) query = query.eq('technician_id', tech);

  if (q) {
    const safe = q.replace(/[^\p{L}\p{N}\s.'-]/gu, ' ').trim();
    const digits = q.replace(/\D/g, '');
    const f = [];
    if (safe) f.push(`code.ilike.%${safe}%`, `customer_name.ilike.%${safe}%`, `brand.ilike.%${safe}%`, `model.ilike.%${safe}%`);
    if (digits.length >= 4) f.push(`customer_phone_e164.ilike.%${digits}%`, `imei.ilike.%${digits}%`, `serial_number.ilike.%${digits}%`);
    if (f.length) query = query.or(f.join(','));
  }

  const [{ data: orders, count }, technicians] = await Promise.all([query, getTechnicians()]);
  const pages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  const tabs = [
    ['abertas', 'Abertas'], ['atrasadas', 'Atrasadas'],
    ...OS_STATUS_ORDER.map((s) => [s, OS_STATUS[s].label]), ['todas', 'Todas'],
  ];
  const qs = (patch) => {
    const params = new URLSearchParams({ status, ...(q && { q }), ...(tech && { tecnico: tech }), ...patch });
    return `?${params.toString()}`;
  };
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Ordens de serviço"
        description={`${count ?? 0} OS`}
        actions={<ButtonLink href="/painel/os/nova"><Plus className="size-4" aria-hidden="true" /> Nova OS</ButtonLink>}
      />

      {/* Telas maiores: atalhos por status. No celular, o status vira um campo do filtro abaixo. */}
      <div className="mb-4 hidden flex-wrap gap-1.5 sm:flex">
        {tabs.map(([key, label]) => (
          <Link key={key} href={qs({ status: key, pagina: '1' })}
            className={cn('whitespace-nowrap rounded-full px-3 py-1.5 text-sm',
              status === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>
            {label}
          </Link>
        ))}
      </div>

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap" role="search">
        <AutoSubmitSelect name="status" defaultValue={status} aria-label="Status" className="sm:hidden">
          {tabs.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </AutoSubmitSelect>
        <Input name="q" defaultValue={q} placeholder="Nº da OS, cliente, telefone, modelo, IMEI" className="sm:max-w-md sm:flex-1" />
        <Select name="tecnico" defaultValue={tech} className="sm:w-48">
          <option value="">Todos os técnicos</option>
          {technicians.map((t) => <option key={t.user_id} value={t.user_id}>{t.full_name || t.email}</option>)}
        </Select>
        <Button type="submit" variant="outline"><Search className="size-4" aria-hidden="true" /> Filtrar</Button>
      </form>

      <Card>
        {orders?.length ? (
          <>
          {/* Celular: cartões */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {orders.map((o) => {
              const late = o.estimated_completion_at && !['PRONTO', 'ENTREGUE', 'CANCELADO'].includes(o.status) && new Date(o.estimated_completion_at).getTime() < now;
              return (
                <li key={o.id}>
                  <Link href={`/painel/os/${o.id}`} className="block px-4 py-3 active:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{o.code}</p>
                        <p className="truncate text-sm text-slate-700">{o.customer_name}</p>
                        <p className="truncate text-xs text-slate-500">{[o.category_name, o.brand, o.model].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge status={o.status} />
                        {late && <span className="flex items-center gap-1 text-xs text-red-600"><Clock className="size-3" aria-hidden="true" /> Atrasada</span>}
                        {['ALTA', 'URGENTE'].includes(o.priority) && <Badge tone={o.priority === 'URGENTE' ? 'red' : 'orange'}>{PRIORITIES[o.priority]}</Badge>}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Entrada {formatDate(o.received_at)}{o.technician_name && ` · ${o.technician_name}`}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="hidden md:block">
          <Table>
            <THead>
              <tr><TH>OS</TH><TH>Cliente</TH><TH className="hidden md:table-cell">Equipamento</TH><TH>Status</TH><TH className="hidden lg:table-cell">Técnico</TH><TH className="hidden sm:table-cell">Entrada</TH></tr>
            </THead>
            <TBody>
              {orders.map((o) => {
                const late = o.estimated_completion_at && !['PRONTO', 'ENTREGUE', 'CANCELADO'].includes(o.status) && new Date(o.estimated_completion_at).getTime() < now;
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <TD className="whitespace-nowrap">
                      <Link href={`/painel/os/${o.id}`} className="font-medium text-slate-900 hover:text-brand-700">{o.code}</Link>
                      {o.priority !== 'NORMAL' && o.priority !== 'BAIXA' && (
                        <Badge tone={o.priority === 'URGENTE' ? 'red' : 'orange'} className="ml-2">{PRIORITIES[o.priority]}</Badge>
                      )}
                    </TD>
                    <TD>
                      <p className="text-slate-900">{o.customer_name}</p>
                      <p className="text-xs text-slate-500">{formatPhone(o.customer_phone)}</p>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <p>{[o.brand, o.model].filter(Boolean).join(' ') || '—'}</p>
                      <p className="text-xs text-slate-500">{o.category_name}</p>
                    </TD>
                    <TD>
                      <StatusBadge status={o.status} />
                      {late && <p className="mt-1 flex items-center gap-1 text-xs text-red-600"><Clock className="size-3" aria-hidden="true" /> Atrasada</p>}
                    </TD>
                    <TD className="hidden lg:table-cell">{o.technician_name || '—'}</TD>
                    <TD className="hidden whitespace-nowrap sm:table-cell">{formatDate(o.received_at)}</TD>
                  </tr>
                );
              })}
            </TBody>
          </Table>
          </div>
          </>
        ) : (
          <EmptyState icon={ClipboardList} title="Nenhuma OS encontrada" description="Ajuste os filtros ou abra uma nova OS."
            action={<ButtonLink href="/painel/os/nova" variant="outline">Abrir OS</ButtonLink>} />
        )}
      </Card>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>Página {page} de {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <ButtonLink variant="outline" size="sm" href={qs({ pagina: String(page - 1) })}>Anterior</ButtonLink>}
            {page < pages && <ButtonLink variant="outline" size="sm" href={qs({ pagina: String(page + 1) })}>Próxima</ButtonLink>}
          </div>
        </div>
      )}
    </>
  );
}
