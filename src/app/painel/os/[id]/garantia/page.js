import { notFound } from 'next/navigation';
import { Info, Sparkles } from 'lucide-react';
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
import { getBillingStatus } from '@/features/billing/queries';

export const metadata = { title: 'Certificado de garantia' };

export default async function WarrantyPage({ params }) {
  const { id } = await params;
  const { assistance } = await requireStaff();
  const [order, billing] = await Promise.all([getServiceOrder(id), getBillingStatus()]);
  const simple = billing?.plan === 'free';
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
        <PrintButton label={isPickup ? 'Imprimir termo' : simple ? 'Imprimir comprovante' : 'Imprimir certificado'} />
      </div>

      {simple && !isPickup && (
        <div className="mb-4 flex flex-wrap items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 print:hidden">
          <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            No plano Grátis a garantia sai como comprovante simples. No <strong>Pro</strong>, o cliente recebe o certificado completo:
            com o seu logo, as peças e serviços do orçamento e as suas condições de garantia.
          </p>
          {billing?.can_manage && <ButtonLink href="/painel/plano" size="sm">Conhecer o Pro</ButtonLink>}
        </div>
      )}

      <WarrantyCertificate doc={doc} order={order} approved={approved} assistance={assistance} simple={simple}
        logo={logoUrl(assistance.logo_path, assistance.updated_at)} />
    </div>
  );
}
