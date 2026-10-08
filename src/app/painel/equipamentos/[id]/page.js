import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { EquipmentFields } from '@/features/equipment/components/equipment-fields';
import { updateEquipment } from '@/features/equipment/actions';
import { getCategories } from '@/features/tenancy/queries';
import { formatDate } from '@/lib/dates';

export const metadata = { title: 'Equipamento' };

export default async function EquipmentPage({ params }) {
  const { id } = await params;
  const { supabase } = await requireStaff();

  const [{ data: e }, { data: orders }, categories] = await Promise.all([
    supabase.from('equipment')
      .select('*, category:equipment_categories!equipment_category_fk(name), customer:customers!equipment_customer_fk(id, name, anonymized_at)')
      .eq('id', id).maybeSingle(),
    supabase.from('v_service_orders').select('id, code, status, reported_issue, received_at, delivered_at')
      .eq('equipment_id', id).order('received_at', { ascending: false }),
    getCategories(),
  ]);
  if (!e) notFound();

  const title = [e.brand, e.model].filter(Boolean).join(' ') || 'Equipamento';
  return (
    <>
      <PageHeader
        title={title}
        description={<>{e.category?.name} · Cliente <Link href={`/painel/clientes/${e.customer?.id}`} className="font-medium text-brand-700 hover:underline">{e.customer?.name}</Link></>}
        back={{ href: '/painel/equipamentos', label: 'Equipamentos' }}
        actions={!e.customer?.anonymized_at && (
          <ButtonLink href={`/painel/os/nova?cliente=${e.customer_id}&equipamento=${e.id}`}><Plus className="size-4" aria-hidden="true" /> Nova OS</ButtonLink>
        )}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Dados do equipamento" />
          <CardContent>
            <ActionForm action={updateEquipment.bind(null, e.id)} className="space-y-4">
              <EquipmentFields equipment={e} categories={categories} />
              <SubmitButton pendingText="Salvando...">Salvar</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Histórico de OS" description={`${orders?.length || 0} passagem(ns) pela assistência`} />
          {orders?.length ? (
            <ul className="divide-y divide-slate-100">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/painel/os/${o.id}`} className="block px-5 py-3 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{o.code}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{o.reported_issue}</p>
                    <p className="mt-1 text-xs text-slate-400">Entrada {formatDate(o.received_at)}{o.delivered_at && ` · Entrega ${formatDate(o.delivered_at)}`}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <CardContent className="text-sm text-slate-500">Nenhuma OS para este equipamento.</CardContent>}
        </Card>
      </div>
    </>
  );
}
