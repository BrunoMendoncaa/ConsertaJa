import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { PrintButton } from '@/components/ui/print-button';
import { WarrantyCertificate } from '@/features/service-orders/components/warranty-certificate';
import { warrantyDocument } from '@/features/service-orders/warranty';
import { portalCall } from '@/features/portal/queries';
import { logoUrl } from '@/features/tenancy/queries';

export const metadata = { title: 'Certificado de garantia', robots: { index: false } };

/**
 * Certificado de garantia (ou termo de retirada) visto pelo cliente.
 * Os dados vêm de portal_get_warranty, que só devolve OS ENTREGUE do cliente
 * da sessão; qualquer outro código vira "não encontrada".
 */
export default async function PortalWarrantyPage({ params }) {
  const { slug, code } = await params;
  const osCode = decodeURIComponent(code);
  const res = await portalCall(slug, 'portal_get_warranty', { p_code: osCode });
  if (res.expired) redirect(`/a/${slug}?expirada=1`);
  if (!res.data) notFound();

  const { assistance, order, approved } = res.data;
  const doc = warrantyDocument(order, approved);
  if (!doc) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/a/${slug}/os/${order.code}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ChevronLeft className="size-4" aria-hidden="true" /> Voltar para a OS
        </Link>
        <PrintButton label="Imprimir ou salvar PDF" />
      </div>
      <WarrantyCertificate doc={doc} order={order} approved={approved} assistance={assistance} logo={logoUrl(assistance.logo_path)} />
    </div>
  );
}
