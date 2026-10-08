import { ShieldCheck, PackageCheck } from 'lucide-react';
import { warrantyTerms, LEGAL_WARRANTY_NOTE } from '@/features/service-orders/warranty';
import { assistanceAddressLine, assistanceContactLine } from '@/features/tenancy/format';
import { formatDate } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { formatDocument } from '@/lib/document';
import { formatBRL } from '@/lib/money';
import { OUTCOMES } from '@/lib/constants';

const KIND_LABEL = { SERVICO: 'Serviço', PECA: 'Peça' };
const PICKUP_REASON = {
  NAO_REPARADO_RECUSADO: 'O orçamento do reparo foi recusado',
  NAO_REPARADO_INVIAVEL: 'O reparo se mostrou inviável',
};
const qty = (q) => Number(q || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

function Row({ label, children, className }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || '—'}</dd>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;
}

/**
 * Certificado de garantia (ou termo de retirada, se o equipamento voltou sem reparo).
 * Documento A4 para imprimir ou salvar em PDF na retirada.
 * @param {{ doc: object, order: object, approved: object|null, assistance: object, logo: string|null }} props
 */
export function WarrantyCertificate({ doc, order, approved, assistance, logo }) {
  const isCertificate = doc.kind === 'certificate';
  const isPickup = doc.kind === 'pickup';
  const title = isPickup ? 'Termo de retirada' : 'Certificado de garantia';
  const items = approved?.snapshot?.items || [];
  const e = order.equipment || {};
  const c = order.customer || {};
  const addressLine = assistanceAddressLine(assistance.address);
  const contactLine = assistanceContactLine(assistance);
  const city = assistance.address?.cidade;
  const terms = warrantyTerms(assistance.warranty_policy);
  const accessories = order.accessories?.length ? order.accessories.join(', ') : 'nenhum';

  return (
    <article className="print-compact rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none sm:p-8">
      {/* Assistência */}
      <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img src={logo} alt="" className="size-14 rounded-lg object-contain" />}
          <div>
            <p className="text-lg font-semibold text-slate-900">{assistance.name}</p>
            {(assistance.legal_name || assistance.document) && (
              <p className="text-xs text-slate-500">
                {[assistance.legal_name, assistance.document && `CNPJ/CPF ${formatDocument(assistance.document)}`].filter(Boolean).join(' · ')}
              </p>
            )}
            {addressLine && <p className="text-xs text-slate-500">{addressLine}</p>}
            {contactLine && <p className="text-xs text-slate-500">{contactLine}</p>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
          <p className="text-xl font-semibold text-slate-900">{order.code}</p>
          <p className="text-xs text-slate-500">Retirada em {formatDate(order.delivered_at)}</p>
        </div>
      </header>

      {/* Destaque: prazo da garantia */}
      <section className="py-4">
        {isCertificate && (
          <div className="flex items-center gap-4 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-5 py-4 print:bg-white">
            <ShieldCheck className="size-10 shrink-0 text-emerald-700" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Certificado de garantia</p>
              <p className="text-2xl font-bold text-slate-900">{doc.days} dias de garantia</p>
              <p className="text-sm text-slate-700">
                Válida de <strong>{formatDate(doc.startsAt)}</strong> até <strong>{formatDate(doc.endsAt)}</strong>
              </p>
            </div>
          </div>
        )}
        {doc.kind === 'no_warranty' && (
          <div className="flex items-center gap-4 rounded-xl border-2 border-slate-400 px-5 py-4">
            <PackageCheck className="size-10 shrink-0 text-slate-600" aria-hidden="true" />
            <div>
              <p className="text-lg font-bold text-slate-900">Serviço sem garantia contratual</p>
              <p className="text-sm text-slate-700">O orçamento aprovado não previa prazo de garantia. Vale a garantia legal do Código de Defesa do Consumidor.</p>
            </div>
          </div>
        )}
        {isPickup && (
          <div className="flex items-center gap-4 rounded-xl border-2 border-slate-400 px-5 py-4">
            <PackageCheck className="size-10 shrink-0 text-slate-600" aria-hidden="true" />
            <div>
              <p className="text-lg font-bold text-slate-900">Equipamento devolvido sem reparo</p>
              <p className="text-sm text-slate-700">{PICKUP_REASON[order.outcome] || OUTCOMES[order.outcome]}. Como nenhum reparo foi executado, não há garantia de serviço.</p>
            </div>
          </div>
        )}
      </section>

      {/* Cliente e equipamento */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-200 py-4 sm:grid-cols-3">
        <Row label="Cliente">{c.name}</Row>
        <Row label="Telefone">{c.phone ? formatPhone(c.phone) : null}</Row>
        {c.document && <Row label="CPF/CNPJ">{formatDocument(c.document)}</Row>}
        <Row label="Equipamento">{[e.category?.name, e.brand, e.model].filter(Boolean).join(' · ')}</Row>
        <Row label="Nº de série / IMEI">{[e.serial_number, e.imei && `IMEI ${e.imei}`].filter(Boolean).join(' · ')}</Row>
        <Row label="Cor">{e.color}</Row>
        <Row label="Entrada">{formatDate(order.received_at)}</Row>
      </dl>

      {/* O que foi feito */}
      <section className="space-y-4 border-b border-slate-200 py-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Row label="Problema relatado">{order.reported_issue}</Row>
          <Row label="Defeito constatado">{order.diagnosis}</Row>
          {!isPickup && <Row label="Serviço realizado" className="sm:col-span-2">{order.solution}</Row>}
        </dl>

        {!isPickup && items.length > 0 && (
          <div>
            <SectionTitle>Serviços e peças (orçamento aprovado, versão {approved.version})</SectionTitle>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">Tipo</th>
                  <th className="py-1.5 pr-2 font-medium">Descrição</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Qtd.</th>
                  <th className="py-1.5 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-600">{KIND_LABEL[it.kind] || it.kind}</td>
                    <td className="py-1.5 pr-2 text-slate-900">{it.description}</td>
                    <td className="tabular py-1.5 pr-2 text-right">{qty(it.quantity)}</td>
                    <td className="tabular py-1.5 text-right">{formatBRL(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={3} className="pt-2 text-right">Total</td>
                  <td className="tabular pt-2 text-right">{formatBRL(approved.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Condições */}
      {!isPickup && (
        <section className="border-b border-slate-200 py-4">
          <SectionTitle>Condições da garantia</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-700">
            {terms.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-slate-600">{LEGAL_WARRANTY_NOTE}</p>
        </section>
      )}

      {/* Declaração de retirada + assinaturas: nunca separados entre páginas */}
      <div className="break-inside-avoid">
        <section className="py-4 text-sm leading-relaxed text-slate-700">
          <p>
            Declaro que retirei o equipamento descrito acima
            {isPickup ? ' no estado em que se encontrava, sem reparo,' : ', testado e em funcionamento,'}
            {' '}com os acessórios entregues na entrada: <strong>{accessories}</strong>.
          </p>
          <p className="mt-3 text-slate-500">{[city, formatDate(order.delivered_at)].filter(Boolean).join(', ')}</p>
        </section>

        <footer className="grid grid-cols-2 gap-10 pt-10 text-center text-xs text-slate-500">
          <div className="border-t border-slate-400 pt-2">{c.name || 'Cliente'}</div>
          <div className="border-t border-slate-400 pt-2">{assistance.name}</div>
        </footer>
      </div>
    </article>
  );
}
