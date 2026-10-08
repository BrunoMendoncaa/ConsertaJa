import { notFound } from 'next/navigation';
import { Info } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PrintButton } from '@/components/ui/print-button';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getServiceOrder } from '@/features/service-orders/queries';
import { warrantyDocument } from '@/features/service-orders/warranty';
import { WarrantyCertificate } from '@/features/service-orders/components/warranty-certificate';
import { logoUrl } from '@/features/tenancy/queries';
import { OS_STATUS } from '@/lib/constants';

export const metadata = { title: 'Certificado de garantia' };

export default async function WarrantyPage({ params }) {
  const { id } = await params;
  const { assistance } = await requireStaff();
  const order = await getServiceOrder(id);
  if (!order) notFound();

  const supabase = await createClient();
  const { data: approved } = await supabase
    .from('budget_versions')
    .select('id, version, warranty_days, total, snapshot, decided_at')
    .eq('service_order_id', id)
    .eq('status', 'APROVADO')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const doc = warrantyDocument(order, approved);

  // Ainda não entregue: o documento só existe depois que a retirada é registrada.
  if (!doc) {
    return (
      <div className="mx-auto max-w-xl">
        <ButtonLink href={`/painel/os/${id}`} variant="ghost" className="mb-4">← Voltar para a OS</ButtonLink>
        <Card>
          <CardContent className="flex gap-3 py-6">
            <Info className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
            <div className="text-sm text-slate-700">
              <p className="font-semibold text-slate-900">O certificado sai na entrega</p>
              <p className="mt-1">
                {order.status === 'CANCELADO'
                  ? 'Esta OS foi cancelada, então não há certificado de garantia.'
                  : `Quando o equipamento estiver pronto, registre a entrega na OS (status "Entregue"). O prazo da garantia começa nesse dia e o certificado fica disponível para imprimir. Status atual: ${OS_STATUS[order.status]?.label.toLowerCase()}.`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPickup = doc.kind === 'pickup';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap justify-between gap-2 print:hidden">
        <ButtonLink href={`/painel/os/${id}`} variant="ghost">← Voltar para a OS</ButtonLink>
        <PrintButton label={isPickup ? 'Imprimir termo' : 'Imprimir certificado'} />
      </div>

      <WarrantyCertificate doc={doc} order={order} approved={approved} assistance={assistance} logo={logoUrl(assistance.logo_path, assistance.updated_at)} />
    </div>
  );
}
