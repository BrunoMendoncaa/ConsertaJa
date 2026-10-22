import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { NewOrderWizard } from '@/features/service-orders/components/new-order-wizard';
import { getCategories, getTechnicians } from '@/features/tenancy/queries';
import { SITE_URL } from '@/lib/supabase/env';
import { getBillingStatus } from '@/features/billing/queries';
import { Card, CardContent } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { freeUsage } from '@/lib/billing';
import { formatDate } from '@/lib/dates';

export const metadata = { title: 'Nova OS' };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function NewOrderPage({ searchParams }) {
  const { supabase, assistance } = await requireStaff();
  const sp = await searchParams;
  const billing = await getBillingStatus();
  const usage = freeUsage(billing);
  if (billing?.access === 'blocked' || usage?.reached) {
    const suspended = billing.access === 'blocked';
    return (
      <>
        <PageHeader title="Nova ordem de serviço" back={{ href: '/painel/os', label: 'Ordens de serviço' }} />
        <Card className="max-w-xl">
          <CardContent className="flex gap-4 py-6">
            <Lock className="mt-0.5 size-6 shrink-0 text-red-600" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-900">
                {suspended ? 'Assistência suspensa' : `Você usou as ${usage.limit} OS do plano Grátis deste mês`}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {suspended
                  ? 'Fale com o suporte do TecnoFix. Você continua vendo, concluindo e entregando as OS que já existem.'
                  : `Com o Pro, as OS são sem limite e a garantia sai no certificado completo, com o seu logo. Ou aguarde ${formatDate(billing.month_resets_at)}, quando o limite do Grátis renova. Tudo o que já existe continua funcionando.`}
              </p>
              {!suspended && (billing.can_manage
                ? <ButtonLink href="/painel/plano" className="mt-4">Assinar o Pro</ButtonLink>
                : <p className="mt-3 text-sm text-slate-600">Peça ao responsável pela assistência para assinar o Pro.</p>)}
            </div>
          </CardContent>
        </Card>
      </>
    );
  }
  const customerId = UUID.test(sp?.cliente || '') ? sp.cliente : null;
  const equipmentParam = UUID.test(sp?.equipamento || '') ? sp.equipamento : null;

  const [categories, technicians] = await Promise.all([getCategories(), getTechnicians()]);

  let initialCustomer = null;
  let initialEquipmentList = [];
  if (customerId) {
    const [{ data: c }, { data: eq }] = await Promise.all([
      supabase.from('customers').select('id, name, phone').eq('id', customerId).is('anonymized_at', null).maybeSingle(),
      supabase.from('equipment')
        .select('id, brand, model, serial_number, imei, color, category:equipment_categories!equipment_category_fk(name)')
        .eq('customer_id', customerId).order('created_at', { ascending: false }),
    ]);
    if (c) {
      initialCustomer = c;
      initialEquipmentList = eq || [];
    }
  }
  const initialEquipmentId = initialEquipmentList.some((e) => e.id === equipmentParam) ? equipmentParam : null;

  return (
    <>
      <PageHeader
        title="Nova ordem de serviço"
        description={usage
          ? `Plano Grátis: ${usage.left === 1 ? 'resta 1 OS' : `restam ${usage.left} OS`} neste mês (de ${usage.limit}).`
          : 'Cliente, equipamento, entrada e fotos em poucos passos.'}
        back={{ href: '/painel/os', label: 'Ordens de serviço' }}
      />
      <div className="max-w-4xl">
        <NewOrderWizard
          categories={categories}
          technicians={technicians}
          assistance={{ id: assistance.id, slug: assistance.slug, name: assistance.name }}
          siteUrl={SITE_URL}
          initialCustomer={initialCustomer}
          initialEquipmentList={initialEquipmentList}
          initialEquipmentId={initialEquipmentId}
        />
      </div>
    </>
  );
}
