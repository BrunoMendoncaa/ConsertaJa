import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Printer, FileText, KeyRound, Phone, Wrench, Plus } from 'lucide-react';
import { requireStaff, can } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ButtonLink, buttonClasses } from '@/components/ui/button';
import { StatusBadge, BudgetStatusBadge, Badge } from '@/components/ui/badge';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea, Checkbox } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { Alert } from '@/components/ui/alert';
import { StatusPanel } from '@/features/service-orders/components/status-panel';
import { Timeline } from '@/features/service-orders/components/timeline';
import { PhotoGallery } from '@/features/service-orders/components/photo-gallery';
import { PhotoUploader } from '@/features/service-orders/components/photo-uploader';
import { AccessPanel } from '@/features/service-orders/components/access-panel';
import { getServiceOrder, getPhotosWithUrls, portalLink } from '@/features/service-orders/queries';
import { updateServiceOrder, updateEntry, setUnlockCode, regenerateAccessCode } from '@/features/service-orders/actions';
import { TransactionForm } from '@/features/finance/components/transaction-form';
import { getTechnicians } from '@/features/tenancy/queries';
import { formatDate, formatDateTime, todayISO } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { formatPhone, whatsappLink } from '@/lib/phone';
import {
  PRIORITIES, ACCESSORIES, ENTRY_CHECKLIST, OUTCOMES, TECH_ROLES, MANAGER_ROLES, CASH_CATEGORIES, PAYMENT_METHODS,
} from '@/lib/constants';

export const metadata = { title: 'OS' };

function toDateInput(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ts));
}

export default async function OrderPage({ params }) {
  const { id } = await params;
  const ctx = await requireStaff();
  const { supabase, assistance, role } = ctx;

  const order = await getServiceOrder(id);
  if (!order) notFound();

  const [{ data: history }, photos, { data: budgets }, { data: secret }, { data: balance }, { data: txs }, technicians, { data: suppliers }] =
    await Promise.all([
      supabase.from('service_order_status_history')
        .select('id, from_status, to_status, note, changed_via, created_at, author:profiles!service_order_status_history_changed_by_fkey(full_name)')
        .eq('service_order_id', id).order('created_at'),
      getPhotosWithUrls(id),
      supabase.from('budget_versions')
        .select('id, version, status, total, sent_at, valid_until, decided_at, decision_channel')
        .eq('service_order_id', id).order('version', { ascending: false }),
      supabase.from('service_order_secrets').select('unlock_code').eq('service_order_id', id).maybeSingle(),
      supabase.rpc('service_order_balance', { p_service_order_id: id }),
      supabase.from('cash_transactions')
        .select('id, direction, category, amount, payment_method, description, occurred_at, voided_at')
        .eq('service_order_id', id).order('occurred_at', { ascending: false }),
      getTechnicians(),
      can(ctx, TECH_ROLES) ? supabase.from('suppliers').select('id, name').eq('active', true).order('name') : Promise.resolve({ data: [] }),
    ]);

  const isTech = can(ctx, TECH_ROLES);
  const closed = ['ENTREGUE', 'CANCELADO'].includes(order.status);
  const link = portalLink(assistance.slug, order.access_code);
  const equipmentName = [order.equipment?.brand, order.equipment?.model].filter(Boolean).join(' ') || order.equipment?.category?.name;
  const firstName = (order.customer?.name || '').split(' ')[0];
  const message = `Olá, ${firstName}! Acompanhe a OS ${order.code} (${equipmentName}) na ${assistance.name}: ${link} — use o telefone cadastrado e o código ${order.access_code}.`;
  const events = (history || []).map((h) => ({ ...h, author: h.author?.full_name }));
  const latestBudget = budgets?.[0];
  const today = todayISO();

  return (
    <>
      <PageHeader
        title={order.code}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            {order.priority !== 'NORMAL' && <Badge tone={order.priority === 'URGENTE' ? 'red' : order.priority === 'ALTA' ? 'orange' : 'slate'}>Prioridade {PRIORITIES[order.priority].toLowerCase()}</Badge>}
            {order.outcome && <span className="text-slate-500">{OUTCOMES[order.outcome]}</span>}
          </span>
        }
        back={{ href: '/painel/os', label: 'Ordens de serviço' }}
        actions={
          <>
            <ButtonLink href={`/painel/os/${id}/comprovante`} variant="outline" target="_blank"><Printer className="size-4" aria-hidden="true" /> Comprovante</ButtonLink>
            <ButtonLink href={`/painel/os/${id}/orcamento`}><FileText className="size-4" aria-hidden="true" /> Orçamento</ButtonLink>
          </>
        }
      />

      {order.status === 'CANCELADO' && order.cancel_reason && (
        <Alert variant="warning" className="mb-6" title="OS cancelada">{order.cancel_reason}</Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Cliente e equipamento */}
          <Card>
            <CardContent className="grid gap-6 py-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cliente</p>
                <Link href={`/painel/clientes/${order.customer?.id}`} className="mt-1 block text-base font-semibold text-slate-900 hover:text-brand-700">{order.customer?.name}</Link>
                {order.customer?.phone && (
                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="size-4 text-slate-400" aria-hidden="true" /> {formatPhone(order.customer.phone)}
                    <a href={whatsappLink(order.customer.phone)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-emerald-700 hover:underline">WhatsApp</a>
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Equipamento</p>
                <Link href={`/painel/equipamentos/${order.equipment?.id}`} className="mt-1 block text-base font-semibold text-slate-900 hover:text-brand-700">{equipmentName}</Link>
                <p className="mt-1 text-sm text-slate-600">
                  {[order.equipment?.category?.name, order.equipment?.color, order.equipment?.serial_number && `Série ${order.equipment.serial_number}`, order.equipment?.imei && `IMEI ${order.equipment.imei}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:col-span-2 sm:grid-cols-4">
                <div><p className="text-slate-500">Entrada</p><p className="font-medium text-slate-900">{formatDate(order.received_at)}</p></div>
                <div><p className="text-slate-500">Previsão</p><p className="font-medium text-slate-900">{formatDate(order.estimated_completion_at)}</p></div>
                <div><p className="text-slate-500">Conclusão</p><p className="font-medium text-slate-900">{formatDate(order.completed_at)}</p></div>
                <div><p className="text-slate-500">{order.warranty_until ? 'Garantia até' : 'Entrega'}</p><p className="font-medium text-slate-900">{order.warranty_until ? formatDate(order.warranty_until) : formatDate(order.delivered_at)}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Entrada */}
          <Card>
            <CardHeader title="Entrada do equipamento" />
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-slate-700">Problema relatado</p>
                <p className="mt-1 whitespace-pre-line text-slate-900">{order.reported_issue}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-medium text-slate-700">Acessórios</p>
                  <p className="mt-1 text-slate-900">{order.accessories?.length ? order.accessories.join(', ') : 'Nenhum'}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-700">Condição</p>
                  <p className="mt-1 text-slate-900">
                    {ENTRY_CHECKLIST.filter((c) => order.entry_condition?.[c.key]).map((c) => c.label).join(', ') || 'Sem marcações'}
                  </p>
                </div>
              </div>
              {order.entry_condition_notes && <p className="rounded-lg bg-slate-50 p-3 text-slate-700">{order.entry_condition_notes}</p>}
              {!closed && (
                <Toggle label="Editar entrada" buttonClassName={buttonClasses({ variant: 'outline', size: 'sm' })}>
                  <ActionForm action={updateEntry.bind(null, id)} className="space-y-4 rounded-lg border border-slate-200 p-4">
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium text-slate-700">Acessórios</legend>
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {ACCESSORIES.map((a) => <Checkbox key={a} name="accessories" value={a} label={a} defaultChecked={order.accessories?.includes(a)} />)}
                      </div>
                      <Input className="mt-3" name="accessories_other" placeholder="Outros (separe por vírgula)"
                        defaultValue={(order.accessories || []).filter((a) => !ACCESSORIES.includes(a)).join(', ')} />
                    </fieldset>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium text-slate-700">Condição</legend>
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {ENTRY_CHECKLIST.map((c) => <Checkbox key={c.key} name="condition" value={c.key} label={c.label} defaultChecked={Boolean(order.entry_condition?.[c.key])} />)}
                      </div>
                    </fieldset>
                    <Field label="Detalhes do estado físico" name="entry_condition_notes">
                      <Textarea id="entry_condition_notes" name="entry_condition_notes" defaultValue={order.entry_condition_notes || ''} />
                    </Field>
                    <SubmitButton size="sm">Salvar entrada</SubmitButton>
                  </ActionForm>
                </Toggle>
              )}
            </CardContent>
          </Card>

          {/* Diagnóstico e solução */}
          <Card>
            <CardHeader title="Diagnóstico e solução" description="O diagnóstico aparece no orçamento enviado ao cliente." />
            <CardContent>
              <ActionForm action={updateServiceOrder.bind(null, id)} className="grid gap-4 sm:grid-cols-2">
                <Field label="Problema relatado" name="reported_issue" className="sm:col-span-2">
                  <Textarea id="reported_issue" name="reported_issue" rows={2} defaultValue={order.reported_issue} disabled={closed} />
                </Field>
                <Field label="Diagnóstico técnico" name="diagnosis" className="sm:col-span-2">
                  <Textarea id="diagnosis" name="diagnosis" rows={3} defaultValue={order.diagnosis || ''} disabled={closed || !isTech} />
                </Field>
                <Field label="Solução aplicada" name="solution" className="sm:col-span-2">
                  <Textarea id="solution" name="solution" rows={2} defaultValue={order.solution || ''} disabled={closed || !isTech} />
                </Field>
                <Field label="Técnico responsável" name="technician_id">
                  <Select id="technician_id" name="technician_id" defaultValue={order.technician_id || ''} disabled={closed}>
                    <option value="">A definir</option>
                    {technicians.map((t) => <option key={t.user_id} value={t.user_id}>{t.full_name || t.email}</option>)}
                  </Select>
                </Field>
                <Field label="Prioridade" name="priority">
                  <Select id="priority" name="priority" defaultValue={order.priority} disabled={closed}>
                    {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </Field>
                <Field label="Previsão de conclusão" name="estimated_completion_at">
                  <Input id="estimated_completion_at" name="estimated_completion_at" type="date" defaultValue={toDateInput(order.estimated_completion_at)} disabled={closed} />
                </Field>
                <Field label="Observações para o cliente" name="customer_notes">
                  <Input id="customer_notes" name="customer_notes" defaultValue={order.customer_notes || ''} disabled={closed} />
                </Field>
                <Field label="Observações internas" name="internal_notes" hint="Nunca aparecem para o cliente." className="sm:col-span-2">
                  <Textarea id="internal_notes" name="internal_notes" rows={2} defaultValue={order.internal_notes || ''} />
                </Field>
                <div className="sm:col-span-2"><SubmitButton pendingText="Salvando...">Salvar</SubmitButton></div>
              </ActionForm>
            </CardContent>
          </Card>

          {/* Fotos */}
          <Card>
            <CardHeader title="Fotos" description={`${photos.length} foto(s) · privadas, visíveis no portal só se marcadas`} />
            <CardContent className="space-y-5">
              <PhotoGallery photos={photos} serviceOrderId={id} canDelete={can(ctx, MANAGER_ROLES)} />
              {!closed && (
                <PhotoUploader
                  assistanceId={assistance.id}
                  serviceOrderId={id}
                  defaultStage={order.status === 'PRONTO' ? 'SAIDA' : ['RECEBIDO'].includes(order.status) ? 'ENTRADA' : 'DIAGNOSTICO'}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader title="Status" />
            <CardContent className="space-y-6">
              {!closed ? <StatusPanel order={order} role={role} balance={balance} /> : (
                <p className="text-sm text-slate-500">OS {order.status === 'ENTREGUE' ? 'entregue' : 'cancelada'}. Nenhuma ação pendente.</p>
              )}
              <div>
                <p className="mb-3 text-sm font-medium text-slate-700">Linha do tempo</p>
                <Timeline events={events} />
              </div>
            </CardContent>
          </Card>

          {/* Orçamento */}
          <Card>
            <CardHeader title="Orçamento" actions={<ButtonLink href={`/painel/os/${id}/orcamento`} size="sm" variant="outline">Abrir</ButtonLink>} />
            <CardContent>
              {budgets?.length ? (
                <ul className="space-y-2">
                  {budgets.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-slate-700">Versão {b.version}</span>
                      <span className="tabular font-medium text-slate-900">{formatBRL(b.total)}</span>
                      <BudgetStatusBadge status={b.status} expired={b.status === 'ENVIADO' && b.valid_until < today} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-500">
                  <p>Nenhum orçamento ainda.</p>
                  {isTech && !closed && order.status !== 'PRONTO' && (
                    <ButtonLink href={`/painel/os/${id}/orcamento`} size="sm" className="mt-3"><Plus className="size-4" aria-hidden="true" /> Montar orçamento</ButtonLink>
                  )}
                </div>
              )}
              {latestBudget?.status === 'ENVIADO' && (
                <p className="mt-3 text-xs text-slate-500">Enviado em {formatDateTime(latestBudget.sent_at)} · válido até {formatDate(latestBudget.valid_until)}</p>
              )}
            </CardContent>
          </Card>

          {/* Financeiro da OS */}
          <Card>
            <CardHeader title="Pagamento" />
            <CardContent className="space-y-4">
              {balance && (
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-slate-500">Aprovado</dt><dd className="tabular font-semibold text-slate-900">{formatBRL(balance.approved_total)}</dd></div>
                  <div><dt className="text-slate-500">Recebido</dt><dd className="tabular font-semibold text-emerald-700">{formatBRL(balance.received)}</dd></div>
                  <div><dt className="text-slate-500">Em aberto</dt><dd className={`tabular font-semibold ${balance.balance_due > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{formatBRL(balance.balance_due)}</dd></div>
                </dl>
              )}
              {txs?.length > 0 && (
                <ul className="divide-y divide-slate-100 text-sm">
                  {txs.map((t) => (
                    <li key={t.id} className={`flex items-center justify-between gap-2 py-2 ${t.voided_at ? 'opacity-50 line-through' : ''}`}>
                      <span className="min-w-0">
                        <span className="block truncate text-slate-800">{t.description}</span>
                        <span className="text-xs text-slate-500">{CASH_CATEGORIES[t.category].label} · {PAYMENT_METHODS[t.payment_method]} · {formatDate(t.occurred_at)}</span>
                      </span>
                      <span className={`tabular whitespace-nowrap font-medium ${t.direction === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {t.direction === 'IN' ? '+' : '−'} {formatBRL(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {order.status !== 'CANCELADO' && (
                <Toggle label={<><Plus className="size-4" aria-hidden="true" /> Registrar pagamento ou compra</>} buttonClassName={buttonClasses({ variant: 'outline', size: 'sm' })}>
                  <TransactionForm
                    role={role}
                    serviceOrderId={id}
                    suppliers={suppliers || []}
                    defaultAmount={balance?.balance_due > 0 ? balance.balance_due : undefined}
                    defaultDescription={`Pagamento ${order.code}`}
                  />
                </Toggle>
              )}
            </CardContent>
          </Card>

          {/* Acesso do cliente */}
          <Card>
            <CardHeader title="Acompanhamento do cliente" />
            <CardContent className="space-y-4">
              <AccessPanel link={link} accessCode={order.access_code} whatsappHref={whatsappLink(order.customer?.phone, message)} receiptHref={`/painel/os/${id}/comprovante`} />
              <ActionForm action={regenerateAccessCode.bind(null, id)} confirm="Gerar um novo código? O comprovante impresso deixará de valer para novos acessos.">
                <SubmitButton variant="link" size="sm" className="text-xs">Gerar novo código</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>

          {/* Senha de desbloqueio */}
          {!closed && (
            <Card>
              <CardHeader title="Senha de desbloqueio" />
              <CardContent className="space-y-3 text-sm">
                {isTech ? (
                  secret ? (
                    <p className="flex items-center gap-2 font-mono text-base text-slate-900"><KeyRound className="size-4 text-slate-400" aria-hidden="true" /> {secret.unlock_code}</p>
                  ) : <p className="text-slate-500">Não informada.</p>
                ) : <p className="text-slate-500">Visível só para técnicos.</p>}
                <ActionForm action={setUnlockCode.bind(null, id)} className="flex gap-2">
                  <Input name="unlock_code" placeholder={isTech && secret ? 'Alterar (vazio remove)' : 'Senha, PIN ou padrão'} autoComplete="off" />
                  <SubmitButton variant="outline" size="md">Salvar</SubmitButton>
                </ActionForm>
                <p className="flex items-center gap-1 text-xs text-slate-500"><Wrench className="size-3" aria-hidden="true" /> Apagada automaticamente na entrega ou no cancelamento.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
