import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, Plus, Send, Trash2, Pencil, Copy } from 'lucide-react';
import { requireStaff, can } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { BudgetStatusBadge, StatusBadge } from '@/components/ui/badge';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { PrintButton } from '@/components/ui/print-button';
import { AccessPanel } from '@/features/service-orders/components/access-panel';
import { BudgetDocument } from '@/features/budgets/components/budget-document';
import { ItemFields } from '@/features/budgets/components/item-fields';
import { buildDraftDoc } from '@/features/budgets/draft-doc';
import {
  openDraft, addItem, updateItem, deleteItem, updateDraftHeader, sendBudget, staffDecide,
} from '@/features/budgets/actions';
import { getServiceOrder, portalLink } from '@/features/service-orders/queries';
import { logoUrl } from '@/features/tenancy/queries';
import { formatBRL, moneyInputValue } from '@/lib/money';
import { formatDate, formatDateTime, todayISO } from '@/lib/dates';
import { whatsappLink } from '@/lib/phone';
import { ITEM_KINDS, TECH_ROLES, DECISION_CHANNELS } from '@/lib/constants';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Orçamento' };

const qtyFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

export default async function BudgetPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireStaff();
  const { supabase, assistance } = ctx;
  const isTech = can(ctx, TECH_ROLES);

  const order = await getServiceOrder(id);
  if (!order) notFound();

  const { data: versions } = await supabase
    .from('budget_versions').select('*').eq('service_order_id', id).order('version', { ascending: false });

  const requested = Number(sp?.versao);
  const draft = versions?.find((v) => v.status === 'RASCUNHO');
  const selected = versions?.find((v) => v.version === requested) || draft || versions?.[0];

  const { data: items } = selected
    ? await supabase.from('budget_items').select('*').eq('budget_version_id', selected.id).order('position').order('created_at')
    : { data: [] };

  const canBudget = !['PRONTO', 'ENTREGUE', 'CANCELADO'].includes(order.status);
  const logo = logoUrl(assistance.logo_path, assistance.updated_at);
  const isDraft = selected?.status === 'RASCUNHO';
  const editable = isDraft && isTech;
  const doc = selected ? (isDraft ? buildDraftDoc({ assistance, order, version: selected, items: items || [] }) : selected.snapshot) : null;
  const expired = selected?.status === 'ENVIADO' && selected.valid_until < todayISO();

  const link = portalLink(assistance.slug, order.access_code);
  const firstName = (order.customer?.name || '').split(' ')[0];
  const sendMsg = selected
    ? `Olá, ${firstName}! O orçamento da OS ${order.code} está pronto: ${formatBRL(selected.total)}. Veja os detalhes e aprove por aqui: ${link} (telefone cadastrado + código ${order.access_code}).`
    : '';

  return (
    <>
      <div className="print:hidden">
      <PageHeader
        title={`Orçamento · ${order.code}`}
        description={<span className="flex flex-wrap items-center gap-2">{order.customer?.name} · <StatusBadge status={order.status} /></span>}
        back={{ href: `/painel/os/${id}`, label: 'Voltar para a OS' }}
        actions={selected && <PrintButton label="Imprimir orçamento" />}
      />
      </div>

      {!versions?.length ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Nenhum orçamento para esta OS"
            description={canBudget ? 'Monte o orçamento com peças e serviços. O banco calcula os totais e congela a versão no envio.' : 'Esta OS não aceita mais orçamento.'}
            action={isTech && canBudget && (
              <ActionForm action={openDraft.bind(null, id)}>
                <SubmitButton><Plus className="size-4" aria-hidden="true" /> Montar orçamento</SubmitButton>
              </ActionForm>
            )}
          />
        </Card>
      ) : (
        <>
          {/* Versões */}
          <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
            {versions.map((v) => (
              <Link key={v.id} href={`?versao=${v.version}`}
                className={cn('inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                  v.id === selected.id ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                Versão {v.version}
                <span className="tabular text-slate-500">{formatBRL(v.total)}</span>
                <BudgetStatusBadge status={v.status} expired={v.status === 'ENVIADO' && v.valid_until < todayISO()} />
              </Link>
            ))}
            {isTech && canBudget && !draft && (
              <ActionForm action={openDraft.bind(null, id)}
                confirm={versions[0]?.status === 'ENVIADO' ? 'A versão enviada será substituída e o cliente não poderá mais aprová-la. Continuar?' : undefined}>
                <SubmitButton variant="outline" size="sm"><Copy className="size-4" aria-hidden="true" /> Nova versão</SubmitButton>
              </ActionForm>
            )}
          </div>

          {editable && (
            <div className="mb-8 grid gap-6 print:hidden xl:grid-cols-3">
              <div className="space-y-6 xl:col-span-2">
                <Card>
                  <CardHeader title="Itens" description="Peças e serviços. Subtotais e total são calculados pelo banco." />
                  {items?.length ? (
                    <ul className="divide-y divide-slate-100">
                      {items.map((i) => (
                        <li key={i.id} className="px-5 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium uppercase text-slate-500">{ITEM_KINDS[i.kind]}</p>
                              <p className="font-medium text-slate-900">{i.description}</p>
                              <p className="tabular text-xs text-slate-500">
                                {qtyFmt.format(i.quantity)} × {formatBRL(i.unit_price)}{Number(i.discount_amount) > 0 && ` − ${formatBRL(i.discount_amount)}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="tabular mr-2 font-semibold text-slate-900">{formatBRL(i.subtotal)}</span>
                              <ActionForm action={deleteItem.bind(null, i.id, id)}>
                                <SubmitButton variant="ghost" size="sm" aria-label="Remover item" className="text-red-600"><Trash2 className="size-4" aria-hidden="true" /></SubmitButton>
                              </ActionForm>
                            </div>
                          </div>
                          <div className="mt-2">
                            <Toggle label={<><Pencil className="size-3.5" aria-hidden="true" /> Editar</>} buttonClassName="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                              <ActionForm action={updateItem.bind(null, i.id, id)} className="mt-2 space-y-3 rounded-lg border border-slate-200 p-3">
                                <ItemFields item={i} idPrefix={i.id} />
                                <SubmitButton size="sm">Salvar item</SubmitButton>
                              </ActionForm>
                            </Toggle>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <CardContent className="text-sm text-slate-500">Nenhum item ainda. Adicione o primeiro abaixo.</CardContent>}
                  <CardContent className="border-t border-slate-100 bg-slate-50/50">
                    <p className="mb-3 text-sm font-medium text-slate-700">Adicionar item</p>
                    <ActionForm action={addItem.bind(null, selected.id, id)} resetOnSuccess className="space-y-3">
                      <ItemFields />
                      <SubmitButton size="sm"><Plus className="size-4" aria-hidden="true" /> Adicionar</SubmitButton>
                    </ActionForm>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader title="Condições" />
                  <CardContent>
                    <ActionForm action={updateDraftHeader.bind(null, selected.id, id)} className="grid gap-4 sm:grid-cols-2">
                      <Field label="Desconto no total (R$)" name="discount_amount">
                        <Input id="discount_amount" name="discount_amount" inputMode="decimal" defaultValue={Number(selected.discount_amount) ? moneyInputValue(selected.discount_amount) : ''} placeholder="0,00" />
                      </Field>
                      <Field label="Acréscimo (R$)" name="surcharge_amount">
                        <Input id="surcharge_amount" name="surcharge_amount" inputMode="decimal" defaultValue={Number(selected.surcharge_amount) ? moneyInputValue(selected.surcharge_amount) : ''} placeholder="0,00" />
                      </Field>
                      <Field label="Garantia (dias)" name="warranty_days">
                        <Input id="warranty_days" name="warranty_days" type="number" min="0" max="3650" defaultValue={selected.warranty_days ?? ''} />
                      </Field>
                      <Field label="Condições de pagamento" name="payment_terms" className="sm:col-span-2">
                        <Input id="payment_terms" name="payment_terms" defaultValue={selected.payment_terms || ''} placeholder="PIX, cartão em até 3x ou dinheiro" />
                      </Field>
                      <Field label="Observações técnicas (cliente vê)" name="technical_notes" className="sm:col-span-2">
                        <Textarea id="technical_notes" name="technical_notes" rows={2} defaultValue={selected.technical_notes || ''} />
                      </Field>
                      <Field label="Observações para o cliente" name="customer_notes" className="sm:col-span-2">
                        <Textarea id="customer_notes" name="customer_notes" rows={2} defaultValue={selected.customer_notes || ''} />
                      </Field>
                      <Field label="Observações internas (nunca vão ao cliente)" name="internal_notes" className="sm:col-span-2">
                        <Textarea id="internal_notes" name="internal_notes" rows={2} defaultValue={selected.internal_notes || ''} />
                      </Field>
                      <div className="sm:col-span-2"><SubmitButton pendingText="Salvando...">Salvar condições</SubmitButton></div>
                    </ActionForm>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader title="Resumo" />
                  <CardContent>
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><dt className="text-slate-600">Itens</dt><dd className="tabular">{formatBRL(selected.items_subtotal)}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-600">Desconto</dt><dd className="tabular">− {formatBRL(selected.discount_amount)}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-600">Acréscimo</dt><dd className="tabular">+ {formatBRL(selected.surcharge_amount)}</dd></div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular">{formatBRL(selected.total)}</dd></div>
                    </dl>
                    {!order.diagnosis && (
                      <Alert variant="warning" className="mt-4">
                        O diagnóstico ainda está vazio. <Link href={`/painel/os/${id}`} className="font-medium underline">Preencha na OS</Link> para ele aparecer no orçamento.
                      </Alert>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader title="Enviar ao cliente" description="Ao enviar, esta versão fica congelada e não pode mais ser editada." />
                  <CardContent>
                    <ActionForm action={sendBudget.bind(null, selected.id, id)} className="space-y-3" confirm="Enviar este orçamento? Depois de enviado, mudanças exigem uma nova versão.">
                      <Field label="Prazo do conserto (dias)" name="estimated_days" required hint="Quantos dias após a aprovação o aparelho fica pronto.">
                        <Input id="estimated_days" name="estimated_days" type="number" min="1" max="365" required defaultValue={selected.estimated_days ?? ''} placeholder="Ex.: 3" />
                      </Field>
                      <Field label="Validade da proposta (dias)" name="valid_days" hint={`Até quando o cliente pode aprovar. Em branco: ${assistance.default_budget_validity_days} dias.`}>
                        <Input id="valid_days" name="valid_days" type="number" min="1" max="90" placeholder={String(assistance.default_budget_validity_days)} />
                      </Field>
                      <SubmitButton className="w-full" pendingText="Enviando..."><Send className="size-4" aria-hidden="true" /> Enviar orçamento</SubmitButton>
                    </ActionForm>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {isDraft && !isTech && (
            <Alert variant="info" className="mb-6 print:hidden">O técnico ainda está montando este orçamento.</Alert>
          )}

          {selected.status === 'ENVIADO' && (
            <div className="mb-6 grid gap-6 print:hidden lg:grid-cols-2">
              <Card>
                <CardHeader title={expired ? 'Orçamento vencido' : 'Aguardando o cliente'}
                  description={`Enviado em ${formatDateTime(selected.sent_at)} · válido até ${formatDate(selected.valid_until)}`} />
                <CardContent>
                  {expired
                    ? <p className="text-sm text-slate-600">A validade passou. Crie uma nova versão para reenviar.</p>
                    : <AccessPanel link={link} accessCode={order.access_code} whatsappHref={whatsappLink(order.customer?.phone, sendMsg)} />}
                </CardContent>
              </Card>
              {!expired && (
                <Card>
                  <CardHeader title="Registrar decisão do cliente" description="Quando o cliente responder no balcão, por telefone ou WhatsApp." />
                  <CardContent>
                    <ActionForm action={staffDecide.bind(null, selected.id, id)} className="space-y-3">
                      <Field label="Decisão" name="decision">
                        <Select id="decision" name="decision" defaultValue="APROVADO">
                          <option value="APROVADO">Aprovou o orçamento</option>
                          <option value="RECUSADO">Recusou o orçamento</option>
                        </Select>
                      </Field>
                      <Field label="Como o cliente decidiu" name="channel">
                        <Select id="channel" name="channel" defaultValue="BALCAO">
                          <option value="BALCAO">No balcão</option>
                          <option value="TELEFONE">Por telefone</option>
                          <option value="WHATSAPP">Por WhatsApp</option>
                        </Select>
                      </Field>
                      <Field label="Motivo (obrigatório na recusa)" name="reason">
                        <Textarea id="reason" name="reason" rows={2} />
                      </Field>
                      <SubmitButton pendingText="Registrando...">Registrar decisão</SubmitButton>
                    </ActionForm>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {['APROVADO', 'RECUSADO'].includes(selected.status) && (
            <Alert variant={selected.status === 'APROVADO' ? 'success' : 'warning'} className="mb-6 print:hidden"
              title={selected.status === 'APROVADO' ? 'Orçamento aprovado' : 'Orçamento recusado'}>
              {DECISION_CHANNELS[selected.decision_channel]} em {formatDateTime(selected.decided_at)}
              {selected.decision_ip && ` · IP ${selected.decision_ip}`}
              {selected.refusal_reason && <><br />Motivo: {selected.refusal_reason}</>}
              {selected.content_hash && <span className="mt-1 block font-mono text-[11px] opacity-70">Hash do documento: {selected.content_hash.slice(0, 16)}…</span>}
            </Alert>
          )}

          {selected.status === 'SUBSTITUIDO' && (
            <Alert variant="info" className="mb-6 print:hidden">Esta versão foi substituída por uma mais nova antes da decisão do cliente.</Alert>
          )}

          {doc && (
            <div id="documento">
              {isDraft && <p className="mb-2 text-sm font-medium text-slate-500 print:hidden">Pré-visualização do que o cliente verá</p>}
              <BudgetDocument doc={doc} logoUrl={logo} brandColor={assistance.brand_color} draft={isDraft} />
            </div>
          )}

          {selected.internal_notes && !isDraft && (
            <p className="mt-4 text-xs text-slate-500 print:hidden">Observação interna: {selected.internal_notes}</p>
          )}
          <div className="mt-6 print:hidden">
            <Link href={`/painel/os/${id}`} className={buttonClasses({ variant: 'ghost' })}>← Voltar para a OS</Link>
          </div>
        </>
      )}
    </>
  );
}
