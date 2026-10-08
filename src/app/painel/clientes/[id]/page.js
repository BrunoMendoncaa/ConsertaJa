import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus, Phone, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { requireStaff, can } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ButtonLink, buttonClasses } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Toggle } from '@/components/ui/toggle';
import { Alert } from '@/components/ui/alert';
import { CustomerFields } from '@/features/customers/components/customer-fields';
import { EquipmentFields } from '@/features/equipment/components/equipment-fields';
import { updateCustomer, deleteOrAnonymizeCustomer, revokePortalAccess } from '@/features/customers/actions';
import { createEquipment } from '@/features/equipment/actions';
import { getCategories } from '@/features/tenancy/queries';
import { formatPhone, whatsappLink } from '@/lib/phone';
import { formatDocument } from '@/lib/document';
import { formatDate } from '@/lib/dates';
import { MANAGER_ROLES } from '@/lib/constants';

export const metadata = { title: 'Cliente' };

export default async function CustomerPage({ params }) {
  const { id } = await params;
  const ctx = await requireStaff();
  const { supabase } = ctx;

  const [{ data: customer }, { data: equipment }, { data: orders }, categories] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).maybeSingle(),
    supabase.from('equipment')
      .select('id, brand, model, serial_number, imei, color, category:equipment_categories!equipment_category_fk(name)')
      .eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('v_service_orders').select('id, code, status, brand, model, category_name, received_at')
      .eq('customer_id', id).order('received_at', { ascending: false }),
    getCategories(),
  ]);
  if (!customer) notFound();

  const address = customer.address || {};
  const addressLine = [address.rua, address.numero, address.complemento, address.bairro, address.cidade, address.uf]
    .filter(Boolean).join(', ');
  const anonymized = Boolean(customer.anonymized_at);

  return (
    <>
      <PageHeader
        title={customer.name}
        description={`Cliente desde ${formatDate(customer.created_at)}`}
        back={{ href: '/painel/clientes', label: 'Clientes' }}
        actions={!anonymized && (
          <ButtonLink href={`/painel/os/nova?cliente=${customer.id}`}><Plus className="size-4" aria-hidden="true" /> Nova OS</ButtonLink>
        )}
      />

      {anonymized && <Alert variant="info" className="mb-6">Os dados pessoais deste cliente foram removidos (LGPD). O histórico de OS foi mantido.</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader title="Contato" />
            <CardContent className="space-y-3 text-sm">
              {customer.phone && (
                <p className="flex items-center gap-2 text-slate-700">
                  <Phone className="size-4 text-slate-400" aria-hidden="true" /> {formatPhone(customer.phone)}
                  <a href={whatsappLink(customer.phone)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-emerald-700 hover:underline">WhatsApp</a>
                </p>
              )}
              {customer.phone_secondary && <p className="pl-6 text-slate-600">{formatPhone(customer.phone_secondary)}</p>}
              {customer.email && <p className="flex items-center gap-2 text-slate-700"><Mail className="size-4 text-slate-400" aria-hidden="true" /> {customer.email}</p>}
              {addressLine && <p className="flex items-start gap-2 text-slate-700"><MapPin className="mt-0.5 size-4 text-slate-400" aria-hidden="true" /> {addressLine}</p>}
              {customer.document && <p className="text-slate-600">CPF/CNPJ: {formatDocument(customer.document)}</p>}
              {customer.notes && <p className="rounded-lg bg-slate-50 p-3 text-slate-600">{customer.notes}</p>}
            </CardContent>
          </Card>

          {!anonymized && (
            <Card>
              <CardHeader title="Acesso ao portal" />
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p className="flex gap-2"><ShieldCheck className="size-4 shrink-0 text-emerald-600" aria-hidden="true" /> O cliente entra com este telefone e o código de acesso de qualquer OS ativa.</p>
                <ActionForm action={revokePortalAccess.bind(null, customer.id)} confirm="Encerrar todos os acessos deste cliente ao portal?">
                  <SubmitButton variant="outline" size="sm">Encerrar acessos ao portal</SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          )}

          {can(ctx, MANAGER_ROLES) && !anonymized && (
            <Card>
              <CardHeader title="Privacidade" />
              <CardContent className="text-sm text-slate-600">
                <p className="mb-3">
                  {orders?.length
                    ? 'Como há OS no histórico, os dados pessoais serão removidos e o histórico ficará sem identificação.'
                    : 'Sem OS no histórico: o cliente e seus equipamentos serão excluídos.'}
                </p>
                <ActionForm action={deleteOrAnonymizeCustomer.bind(null, customer.id)} confirm="Esta ação não pode ser desfeita. Continuar?">
                  <SubmitButton variant="danger" size="sm">{orders?.length ? 'Anonimizar cliente' : 'Excluir cliente'}</SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Ordens de serviço" description={`${orders?.length || 0} OS`} />
            {orders?.length ? (
              <ul className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/painel/os/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
                      <div>
                        <p className="font-medium text-slate-900">{o.code}</p>
                        <p className="text-sm text-slate-500">{[o.category_name, o.brand, o.model].filter(Boolean).join(' · ')} · {formatDate(o.received_at)}</p>
                      </div>
                      <StatusBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <CardContent className="text-sm text-slate-500">Nenhuma OS ainda.</CardContent>}
          </Card>

          <Card>
            <CardHeader title="Equipamentos" description={`${equipment?.length || 0} cadastrado(s)`} />
            <ul className="divide-y divide-slate-100">
              {equipment?.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div>
                    <Link href={`/painel/equipamentos/${e.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {[e.brand, e.model].filter(Boolean).join(' ') || 'Equipamento'}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {[e.category?.name, e.color, e.serial_number && `Série ${e.serial_number}`, e.imei && `IMEI ${e.imei}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {!anonymized && <Link href={`/painel/os/nova?cliente=${customer.id}&equipamento=${e.id}`} className="text-sm font-medium text-brand-700 hover:underline">Abrir OS</Link>}
                </li>
              ))}
            </ul>
            {!anonymized && (
              <CardContent className="border-t border-slate-100">
                <Toggle label={<><Plus className="size-4" aria-hidden="true" /> Adicionar equipamento</>} buttonClassName={buttonClasses({ variant: 'outline', size: 'sm' })}>
                  <ActionForm action={createEquipment.bind(null, customer.id)} resetOnSuccess className="space-y-4">
                    <EquipmentFields categories={categories} />
                    <SubmitButton pendingText="Salvando...">Salvar equipamento</SubmitButton>
                  </ActionForm>
                </Toggle>
              </CardContent>
            )}
          </Card>

          {!anonymized && (
            <Card>
              <CardHeader title="Editar cadastro" />
              <CardContent>
                <Toggle label="Editar dados do cliente" buttonClassName={buttonClasses({ variant: 'outline', size: 'sm' })}>
                  <ActionForm action={updateCustomer.bind(null, customer.id)} className="space-y-4">
                    <CustomerFields customer={customer} />
                    <SubmitButton pendingText="Salvando...">Salvar alterações</SubmitButton>
                  </ActionForm>
                </Toggle>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
