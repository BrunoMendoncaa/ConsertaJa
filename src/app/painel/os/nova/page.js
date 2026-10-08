import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { NewOrderWizard } from '@/features/service-orders/components/new-order-wizard';
import { getCategories, getTechnicians } from '@/features/tenancy/queries';
import { SITE_URL } from '@/lib/supabase/env';

export const metadata = { title: 'Nova OS' };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function NewOrderPage({ searchParams }) {
  const { supabase, assistance } = await requireStaff();
  const sp = await searchParams;
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
      <PageHeader title="Nova ordem de serviço" description="Cliente, equipamento, entrada e fotos em poucos passos." back={{ href: '/painel/os', label: 'Ordens de serviço' }} />
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
