import { formatBRL } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { formatDocument } from '@/lib/document';
import { ITEM_KINDS } from '@/lib/constants';
import { cn } from '@/lib/cn';

const qtyFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

function addressLine(a = {}) {
  return [a.rua && `${a.rua}${a.numero ? `, ${a.numero}` : ''}`, a.complemento, a.bairro, a.cidade && `${a.cidade}${a.uf ? `/${a.uf}` : ''}`]
    .filter(Boolean).join(' · ');
}

/**
 * A proposta comercial. Renderiza sempre a partir de um "snapshot" (o documento
 * congelado no envio); para rascunhos, a página monta um snapshot provisório.
 */
export function BudgetDocument({ doc, logoUrl, brandColor, draft = false, className }) {
  const s = doc;
  const a = s.assistance || {};
  const t = s.totals || {};
  const terms = s.terms || {};
  const accent = brandColor || a.brand_color || '#1d4ed8';
  const hasItemDiscount = (s.items || []).some((i) => Number(i.discount_amount) > 0);

  return (
    <article className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none', className)}>
      <div className="h-1.5" style={{ backgroundColor: accent }} />
      <div className="p-5 sm:p-8">
        {/* Cabeçalho */}
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {logoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt="" className="size-14 rounded-lg object-contain" />
            )}
            <div>
              <p className="text-lg font-semibold text-slate-900">{a.name}</p>
              {(a.legal_name || a.document) && (
                <p className="text-xs text-slate-500">{[a.legal_name, a.document && formatDocument(a.document)].filter(Boolean).join(' · ')}</p>
              )}
              {addressLine(a.address) && <p className="text-xs text-slate-500">{addressLine(a.address)}</p>}
              <p className="text-xs text-slate-500">
                {[a.phone && `Tel. ${a.phone}`, a.whatsapp && `WhatsApp ${a.whatsapp}`, a.email].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: accent }}>
              Orçamento{draft && ' · rascunho'}
            </p>
            <p className="text-xl font-semibold text-slate-900">{s.service_order?.code}</p>
            <p className="text-xs text-slate-500">Versão {s.version} · emitido em {formatDate(s.issued_at)}</p>
            {s.valid_until && <p className="text-xs text-slate-500">Válido até {formatDate(s.valid_until)}</p>}
          </div>
        </header>

        {/* Cliente e equipamento */}
        <section className="grid gap-4 border-b border-slate-200 py-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Cliente</p>
            <p className="mt-0.5 font-medium text-slate-900">{s.customer?.name}</p>
            {s.customer?.phone && <p className="text-sm text-slate-600">{formatPhone(s.customer.phone)}</p>}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Equipamento</p>
            <p className="mt-0.5 font-medium text-slate-900">
              {[s.equipment?.brand, s.equipment?.model].filter(Boolean).join(' ') || s.equipment?.category}
            </p>
            <p className="text-sm text-slate-600">
              {[s.equipment?.category, s.equipment?.color, s.equipment?.serial_number && `Série ${s.equipment.serial_number}`, s.equipment?.imei && `IMEI ${s.equipment.imei}`]
                .filter(Boolean).join(' · ')}
            </p>
          </div>
        </section>

        {/* Problema e diagnóstico */}
        <section className="grid gap-4 border-b border-slate-200 py-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Problema relatado</p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{s.service_order?.reported_issue}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Diagnóstico técnico</p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{s.service_order?.diagnosis || '—'}</p>
          </div>
        </section>

        {/* Itens */}
        <section className="py-5">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">Itens do orçamento</p>

          {/* Mobile: cartões */}
          <ul className="space-y-2 sm:hidden">
            {(s.items || []).map((i, idx) => (
              <li key={idx} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-medium uppercase text-slate-500">{ITEM_KINDS[i.kind]}</span>
                    <p className="text-sm font-medium text-slate-900">{i.description}</p>
                  </div>
                  <p className="tabular whitespace-nowrap text-sm font-semibold text-slate-900">{formatBRL(i.subtotal)}</p>
                </div>
                <p className="tabular mt-1 text-xs text-slate-500">
                  {qtyFmt.format(i.quantity)} × {formatBRL(i.unit_price)}
                  {Number(i.discount_amount) > 0 && ` − desconto ${formatBRL(i.discount_amount)}`}
                </p>
              </li>
            ))}
          </ul>

          {/* Desktop/impressão: tabela */}
          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 font-medium">Descrição</th>
                <th className="py-2 pr-3 text-right font-medium">Qtd</th>
                <th className="py-2 pr-3 text-right font-medium">Unitário</th>
                {hasItemDiscount && <th className="py-2 pr-3 text-right font-medium">Desconto</th>}
                <th className="py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(s.items || []).map((i, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 pr-3 text-slate-500">{ITEM_KINDS[i.kind]}</td>
                  <td className="py-2.5 pr-3 text-slate-900">{i.description}</td>
                  <td className="tabular py-2.5 pr-3 text-right">{qtyFmt.format(i.quantity)}</td>
                  <td className="tabular py-2.5 pr-3 text-right">{formatBRL(i.unit_price)}</td>
                  {hasItemDiscount && <td className="tabular py-2.5 pr-3 text-right">{Number(i.discount_amount) > 0 ? `− ${formatBRL(i.discount_amount)}` : '—'}</td>}
                  <td className="tabular py-2.5 text-right font-medium text-slate-900">{formatBRL(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(s.items || []).length && <p className="text-sm text-slate-500">Nenhum item.</p>}

          {/* Totais */}
          <div className="mt-5 flex justify-end">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd className="tabular">{formatBRL(t.items_subtotal)}</dd></div>
              {Number(t.discount_amount) > 0 && (
                <div className="flex justify-between text-emerald-700"><dt>Desconto</dt><dd className="tabular">− {formatBRL(t.discount_amount)}</dd></div>
              )}
              {Number(t.surcharge_amount) > 0 && (
                <div className="flex justify-between"><dt className="text-slate-600">Acréscimo</dt><dd className="tabular">+ {formatBRL(t.surcharge_amount)}</dd></div>
              )}
              <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
                <dt className="font-semibold text-slate-900">Total</dt>
                <dd className="tabular text-2xl font-semibold text-slate-900">{formatBRL(t.total)}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Condições */}
        <section className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-slate-500">Prazo estimado</p><p className="font-medium text-slate-900">{terms.estimated_days ? `${terms.estimated_days} dia(s) após a aprovação` : '—'}</p></div>
          <div><p className="text-xs text-slate-500">Garantia do serviço</p><p className="font-medium text-slate-900">{terms.warranty_days ? `${terms.warranty_days} dias` : 'Sem garantia'}</p></div>
          <div><p className="text-xs text-slate-500">Validade</p><p className="font-medium text-slate-900">{s.valid_until ? formatDate(s.valid_until) : 'Definida no envio'}</p></div>
          {terms.payment_terms && <div className="sm:col-span-3"><p className="text-xs text-slate-500">Condições de pagamento</p><p className="text-slate-900">{terms.payment_terms}</p></div>}
          {terms.technical_notes && <div className="sm:col-span-3"><p className="text-xs text-slate-500">Observações técnicas</p><p className="whitespace-pre-line text-slate-900">{terms.technical_notes}</p></div>}
          {terms.customer_notes && <div className="sm:col-span-3"><p className="text-xs text-slate-500">Observações</p><p className="whitespace-pre-line text-slate-900">{terms.customer_notes}</p></div>}
        </section>

        {a.warranty_policy && <p className="mt-4 text-xs leading-relaxed text-slate-500">{a.warranty_policy}</p>}
      </div>
    </article>
  );
}
