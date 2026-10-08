import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { requireStaff } from '@/lib/auth';
import { PrintButton } from '@/components/ui/print-button';
import { ButtonLink } from '@/components/ui/button';
import { getServiceOrder, portalLink } from '@/features/service-orders/queries';
import { logoUrl } from '@/features/tenancy/queries';
import { formatDateTime, formatDate } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { formatDocument } from '@/lib/document';
import { formatBRL } from '@/lib/money';
import { ENTRY_CHECKLIST, PRIORITIES } from '@/lib/constants';

export const metadata = { title: 'Comprovante de entrada' };

function Row({ label, children }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || '—'}</dd>
    </div>
  );
}

export default async function ReceiptPage({ params }) {
  const { id } = await params;
  const { assistance } = await requireStaff();
  const order = await getServiceOrder(id);
  if (!order) notFound();

  const link = portalLink(assistance.slug, order.access_code);
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
  const a = assistance.address || {};
  const addressLine = [a.rua && `${a.rua}${a.numero ? `, ${a.numero}` : ''}`, a.complemento, a.bairro, a.cidade && `${a.cidade}${a.uf ? `/${a.uf}` : ''}`, a.cep]
    .filter(Boolean).join(' · ');
  const logo = logoUrl(assistance.logo_path, assistance.updated_at);
  const e = order.equipment || {};

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap justify-between gap-2 print:hidden">
        <ButtonLink href={`/painel/os/${id}`} variant="ghost">← Voltar para a OS</ButtonLink>
        <PrintButton label="Imprimir comprovante" />
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none sm:p-8">
        <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-5">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={logo} alt="" className="size-14 rounded-lg object-contain" />}
            <div>
              <p className="text-lg font-semibold text-slate-900">{assistance.name}</p>
              {assistance.legal_name && <p className="text-xs text-slate-500">{assistance.legal_name}{assistance.document && ` · ${formatDocument(assistance.document)}`}</p>}
              {addressLine && <p className="text-xs text-slate-500">{addressLine}</p>}
              <p className="text-xs text-slate-500">
                {[assistance.phone && `Tel. ${assistance.phone}`, assistance.whatsapp && `WhatsApp ${assistance.whatsapp}`, assistance.email].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">Comprovante de entrada</p>
            <p className="text-xl font-semibold text-slate-900">{order.code}</p>
            <p className="text-xs text-slate-500">{formatDateTime(order.received_at)}</p>
          </div>
        </header>

        <dl className="grid gap-4 border-b border-slate-200 py-5 sm:grid-cols-2">
          <Row label="Cliente">{order.customer?.name}</Row>
          <Row label="Telefone">{formatPhone(order.customer?.phone)}</Row>
          <Row label="Equipamento">{[e.category?.name, e.brand, e.model].filter(Boolean).join(' · ')}</Row>
          <Row label="Nº de série / IMEI">{[e.serial_number, e.imei].filter(Boolean).join(' · ')}</Row>
          <Row label="Cor">{e.color}</Row>
          <Row label="Previsão">{order.estimated_completion_at ? formatDate(order.estimated_completion_at) : 'Após o diagnóstico'}</Row>
        </dl>

        <dl className="grid gap-4 border-b border-slate-200 py-5">
          <Row label="Problema relatado">{order.reported_issue}</Row>
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Acessórios entregues">{order.accessories?.length ? order.accessories.join(', ') : 'Nenhum'}</Row>
            <Row label="Condição na entrada">
              {[ENTRY_CHECKLIST.filter((c) => order.entry_condition?.[c.key]).map((c) => c.label).join(', '), order.entry_condition_notes]
                .filter(Boolean).join(' — ') || 'Sem observações'}
            </Row>
          </div>
          {order.customer_notes && <Row label="Observações">{order.customer_notes}</Row>}
          {order.priority !== 'NORMAL' && <Row label="Prioridade">{PRIORITIES[order.priority]}</Row>}
        </dl>

        <section className="flex flex-col items-center gap-5 border-b border-slate-200 py-5 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code para acompanhar a OS" className="size-36 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-slate-900">Acompanhe seu conserto pelo celular</p>
            <p className="mt-1 text-slate-600">Aponte a câmera para o QR code ou acesse:</p>
            <p className="mt-1 break-all font-medium text-slate-900">{link.replace(/^https?:\/\//, '')}</p>
            <p className="mt-2 text-slate-600">Informe o telefone cadastrado e o código de acesso:</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.25em] text-slate-900">{order.access_code}</p>
          </div>
        </section>

        <section className="space-y-2 py-5 text-xs leading-relaxed text-slate-600">
          {Number(assistance.diagnosis_fee) > 0 && (
            <p>Caso o orçamento seja recusado, será cobrada taxa de diagnóstico de {formatBRL(assistance.diagnosis_fee)}.</p>
          )}
          <p>O orçamento será enviado para aprovação antes de qualquer serviço. Validade do orçamento: {assistance.default_budget_validity_days} dias.</p>
          {assistance.warranty_policy && <p>{assistance.warranty_policy}</p>}
          {assistance.entry_terms && <p className="whitespace-pre-line">{assistance.entry_terms}</p>}
        </section>

        <footer className="grid grid-cols-2 gap-10 pt-10 text-center text-xs text-slate-500">
          <div className="border-t border-slate-400 pt-2">Assinatura do cliente</div>
          <div className="border-t border-slate-400 pt-2">{assistance.name}</div>
        </footer>
      </article>
    </div>
  );
}
