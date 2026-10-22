import { notFound } from 'next/navigation';
import { ExternalLink, CircleCheck, CircleAlert, FlaskConical, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Table, THead, TH, TBody, TD } from '@/components/ui/table';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { getAssistanceDetail, AdminSetupError } from '@/features/admin/queries';
import { extendTrial, suspendAssistance, reactivateAssistance, syncWithMercadoPago } from '@/features/admin/actions';
import { setTestPlan, markAsTest, unmarkTest, resetTestPassword, deleteTestAccount } from '@/features/admin/test-account-actions';
import { PlanChoice } from '@/features/admin/components/plan-choice';
import { situationKey, dueInfo, relativeDays, monthlyValue, cycleLabel, profileComplete, TEST_PLANS } from '@/features/admin/format';
import { SituationBadge, OwnerContact, SetupNotice, ACTION_LABELS, actionDetail } from '@/features/admin/components/bits';
import { ROLES } from '@/lib/constants';
import { SITE_URL } from '@/lib/supabase/env';
import { formatBRL } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { formatDocument } from '@/lib/document';
import { requireAdmin } from '@/features/admin/session';
import { can } from '@/features/admin/permissions';

export const metadata = { title: 'Assistência' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MP_STATUS = { pending: 'Checkout iniciado', authorized: 'Autorizada', paused: 'Pausada', cancelled: 'Cancelada' };
const PAY_STATUS = { approved: 'Aprovado', rejected: 'Recusado', pending: 'Pendente', in_process: 'Em análise', cancelled: 'Cancelado', refunded: 'Estornado' };

function Item({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{children ?? '—'}</dd>
    </div>
  );
}

const NOTICES = {
  teste: 'Marcada como conta de teste. Ela saiu dos números, das listas de assistências e da planilha, e agora pode ser excluída.',
  real: 'Voltou a contar como assistência, com as regras normais de plano.',
};

export default async function AdminAssistancePage({ params, searchParams }) {
  const session = await requireAdmin('assistencias_ver');
  const money = can(session, 'financeiro');
  let canExtend = can(session, 'assistencias_estender_teste');
  let canSuspend = can(session, 'assistencias_suspender');
  let canSync = can(session, 'assistencias_mercado_pago');
  const { id } = await params;
  const notice = NOTICES[(await searchParams)?.aviso] || null;
  if (!UUID_RE.test(id)) notFound();
  let detail;
  try {
    detail = await getAssistanceDetail(id);
  } catch (err) {
    if (err instanceof AdminSetupError) return <><PageHeader title="Assistência" /><SetupNotice message={err.message} /></>;
    throw err;
  }
  if (!detail) notFound();
  const { assistance: a, members, onlyHere, subscriptions, payments, audit } = detail;
  const isTest = Boolean(a.is_test);
  // Conta de teste não tem teste grátis, cobrança nem suspensão: só o plano escolhido na área admin.
  if (isTest) canExtend = canSync = canSuspend = false;
  const hasLiveSubscription = Boolean(a.mp_preapproval_id) && a.subscription_status !== 'canceled';
  const key = situationKey(a);
  const due = dueInfo(a);
  const portal = `${SITE_URL}/a/${a.slug}`;
  const addr = a.address || {};
  const addressText = [addr.rua && `${addr.rua}, ${addr.numero || 's/n'}`, addr.complemento, addr.bairro, addr.cidade && `${addr.cidade}/${addr.uf || ''}`, addr.cep]
    .filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        title={a.name}
        description={<span className="flex flex-wrap items-center gap-2"><SituationBadge assistance={a} /> /{a.slug} · criada em {formatDate(a.created_at)}</span>}
        back={isTest ? { href: '/admin/acessos?tipo=aplicacao', label: 'Contas de teste' } : { href: '/admin/assistencias', label: 'Assistências' }}
        actions={
          <a href={portal} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50">
            <ExternalLink className="size-4" aria-hidden="true" /> Abrir portal
          </a>
        }
      />

      {notice && <Alert variant="success" className="mb-6">{notice}</Alert>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          {isTest ? (
            <Card>
              <CardHeader title="Conta de teste" description="Não conta como assistência: fica fora dos números, das listas e da planilha. Não tem cobrança." />
              <CardContent>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Item label="Situação"><SituationBadge assistance={a} /></Item>
                  <Item label="Plano">{TEST_PLANS[a.test_plan]?.label || a.test_plan}<span className="block font-normal text-slate-500">{TEST_PLANS[a.test_plan]?.hint}</span></Item>
                  <Item label="Login"><span className="break-all">{a.owner_email || '—'}</span></Item>
                </dl>
              </CardContent>
            </Card>
          ) : (
          <Card>
            <CardHeader title="Plano e assinatura" />
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Item label="Situação"><SituationBadge assistance={a} /></Item>
                <Item label={due.label}>{due.date ? <>{formatDate(due.date)} <span className="font-normal text-slate-500">({relativeDays(due.days)})</span></> : '—'}</Item>
                <Item label="Plano">{cycleLabel(a.billing_cycle)}{money && monthlyValue(a) > 0 && <span className="font-normal text-slate-500"> · {formatBRL(monthlyValue(a))}/mês</span>}</Item>
                <Item label="Teste grátis até">{formatDate(a.trial_ends_at)}</Item>
                <Item label="Pago até">{formatDate(a.paid_until)}</Item>
                <Item label="Pagamento pendente desde">{a.past_due_since ? formatDate(a.past_due_since) : '—'}</Item>
                <Item label="Assinatura no Mercado Pago">{a.mp_preapproval_id ? `${MP_STATUS[a.subscription_mp_status] || a.subscription_mp_status || '—'}` : 'Não assinou'}</Item>
                {money && <Item label="Valor da assinatura">{a.subscription_amount ? formatBRL(a.subscription_amount) : '—'}</Item>}
                <Item label="Última conferência no MP">{a.billing_synced_at ? formatDateTime(a.billing_synced_at) : '—'}</Item>
              </dl>
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader title="Uso" />
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Item label="OS nos últimos 30 dias">{a.orders_30d}</Item>
                <Item label="OS no total">{a.orders}</Item>
                <Item label="OS em aberto">{a.open_orders}</Item>
                <Item label="Clientes">{a.customers}</Item>
                <Item label="Equipe ativa">{a.active_members} de {a.members}</Item>
                <Item label="Última OS">{a.last_order_at ? formatDateTime(a.last_order_at) : 'Nenhuma'}</Item>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Equipe" description={`${members.length} pessoa(s)`} />
            <ul className="divide-y divide-slate-100">
              {members.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className={`font-medium ${m.active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{m.full_name || m.email}</p>
                    {isTest && !onlyHere.includes(m.user_id) && <p className="text-xs text-amber-700">Também participa de outra assistência</p>}
                    <p className="text-xs text-slate-500">{m.email}{m.phone ? ` · ${formatPhone(m.phone)}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <Badge tone={m.role === 'owner' ? 'indigo' : 'slate'}>{ROLES[m.role]}</Badge>
                    <p className="mt-1 text-xs text-slate-500">último acesso: {m.last_sign_in_at ? formatDateTime(m.last_sign_in_at) : 'nunca'}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {money && !isTest && <Card>
            <CardHeader title="Pagamentos" description="Cobranças da assinatura no Mercado Pago." />
            {payments.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <THead><tr><TH>Data</TH><TH>Situação</TH><TH className="text-right">Valor</TH></tr></THead>
                  <TBody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <TD>{formatDateTime(p.paid_at || p.created_at)}</TD>
                        <TD><Badge tone={p.status === 'approved' ? 'emerald' : p.status === 'rejected' ? 'red' : 'slate'}>{PAY_STATUS[p.status] || p.status}</Badge></TD>
                        <TD className="tabular text-right font-medium">{formatBRL(p.amount)}</TD>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            ) : <CardContent className="text-sm text-slate-500">Nenhum pagamento ainda.</CardContent>}
            {subscriptions.length > 0 && (
              <CardContent className="border-t border-slate-100 text-xs text-slate-500">
                <p className="mb-1 font-medium text-slate-700">Assinaturas criadas</p>
                <ul className="space-y-0.5">
                  {subscriptions.map((s) => (
                    <li key={s.id}>
                      {formatDateTime(s.created_at)} · {cycleLabel(s.cycle)} · {formatBRL(s.amount)} · {MP_STATUS[s.status] || s.status}
                      {s.provider_id === a.mp_preapproval_id && <span className="ml-1 font-medium text-slate-700">(vigente)</span>}
                      <span className="block font-mono text-[11px] text-slate-400">{s.provider_id} · {s.payer_email}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>}
        </div>

        <aside className="space-y-6">
          {session.master && isTest && <TestAccountCard a={a} members={members} onlyHere={onlyHere} />}

          {(canExtend || canSync || canSuspend) && <Card>
            <CardHeader title="Ações" />
            <CardContent className="space-y-6 [&>*+*]:border-t [&>*+*]:border-slate-100 [&>*+*]:pt-5">
              {canExtend && <ActionForm action={extendTrial} className="space-y-3">
                <input type="hidden" name="assistance_id" value={a.id} />
                <p className="text-sm font-medium text-slate-900">Estender o Pro grátis (teste)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Mais" name="days">
                    <Select id="days" name="days" defaultValue="7">
                      {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} dias</option>)}
                    </Select>
                  </Field>
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-slate-700">Pro grátis até</p>
                    <p className="flex h-10 items-center text-sm text-slate-600">{formatDate(a.trial_ends_at)}</p>
                  </div>
                </div>
                <Field label="Observação (opcional)" name="note">
                  <Input id="note" name="note" placeholder="Ex.: combinado por WhatsApp" maxLength={200} />
                </Field>
                <SubmitButton size="sm" pendingText="Salvando...">Estender Pro grátis</SubmitButton>
                {a.mp_preapproval_id && <p className="text-xs text-slate-500">A data da cobrança já agendada no Mercado Pago não muda.</p>}
              </ActionForm>}

              {canSync && <div>
                <ActionForm action={syncWithMercadoPago} className="space-y-2">
                  <input type="hidden" name="assistance_id" value={a.id} />
                  <p className="text-sm font-medium text-slate-900">Mercado Pago</p>
                  <p className="text-xs text-slate-500">Consulta a assinatura agora e atualiza a situação.</p>
                  <SubmitButton size="sm" variant="outline" pendingText="Consultando...">Conferir no Mercado Pago</SubmitButton>
                </ActionForm>
              </div>}

              {canSuspend && <div>
                {key === 'suspended' ? (
                  <ActionForm action={reactivateAssistance} className="space-y-2" confirm={`Reativar ${a.name}?`}>
                    <input type="hidden" name="assistance_id" value={a.id} />
                    <p className="text-sm font-medium text-slate-900">Assistência suspensa</p>
                    <p className="text-xs text-slate-500">Reativar devolve o acesso da equipe e o portal dos clientes.</p>
                    <SubmitButton size="sm" variant="success" pendingText="Reativando...">Reativar</SubmitButton>
                  </ActionForm>
                ) : (
                  <ActionForm action={suspendAssistance} className="space-y-2" confirm={`Suspender ${a.name}? A equipe não abre OS nova e o portal dos clientes sai do ar.`}>
                    <input type="hidden" name="assistance_id" value={a.id} />
                    <p className="text-sm font-medium text-slate-900">Suspender</p>
                    <p className="text-xs text-slate-500">Bloqueia OS novas e convites e tira o portal dos clientes do ar. A assinatura no Mercado Pago continua; cancele lá se for o caso.</p>
                    <Field label="Motivo" name="reason" required>
                      <Textarea id="reason" name="reason" rows={2} maxLength={300} />
                    </Field>
                    <SubmitButton size="sm" variant="danger" pendingText="Suspendendo...">Suspender assistência</SubmitButton>
                  </ActionForm>
                )}
              </div>}
            </CardContent>
          </Card>}

          {session.master && !isTest && (
            <Card>
              <CardHeader title={<span className="inline-flex items-center gap-2"><FlaskConical className="size-4 text-violet-600" aria-hidden="true" /> Conta de teste?</span>} />
              <CardContent>
                {hasLiveSubscription ? (
                  <p className="text-sm text-slate-600">Esta assistência tem assinatura no Mercado Pago. Para marcar como teste, cancele a assinatura antes.</p>
                ) : (
                  <ActionForm action={markAsTest} className="space-y-3"
                    confirm={`Marcar ${a.name} como conta de teste? Ela sai dos números e das listas de assistências e passa a poder ser excluída.`}>
                    <input type="hidden" name="assistance_id" value={a.id} />
                    <p className="text-xs text-slate-500">Se esta conta foi criada por você para testar, marque aqui. Ela deixa de contar como assistência, passa para Acessos → Aplicação e pode ser excluída.</p>
                    <PlanChoice idPrefix="marcar" defaultValue="pro" compact />
                    <SubmitButton size="sm" variant="outline" pendingText="Marcando...">Marcar como conta de teste</SubmitButton>
                  </ActionForm>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader title="Dono e loja" />
            <CardContent>
              <dl className="space-y-3">
                <Item label="Dono">{a.owner_name || '—'}<span className="block font-normal text-slate-500">{a.owner_email}</span><OwnerContact assistance={a} message={`Olá, ${(a.owner_name || '').split(' ')[0]}! Aqui é do TecnoFix.`} /></Item>
                <Item label="Último acesso do dono">{a.owner_last_sign_in ? formatDateTime(a.owner_last_sign_in) : 'nunca'}</Item>
                <Item label="CNPJ/CPF">{a.document ? formatDocument(a.document) : '—'}</Item>
                <Item label="WhatsApp / telefone da loja">{[a.whatsapp, a.phone].filter(Boolean).map(formatPhone).join(' · ') || '—'}</Item>
                <Item label="E-mail da loja">{a.email || '—'}</Item>
                <Item label="Endereço">{addressText || '—'}</Item>
                <Item label="Cadastro da loja">
                  {profileComplete(a)
                    ? <span className="inline-flex items-center gap-1 text-emerald-700"><CircleCheck className="size-4" aria-hidden="true" /> Completo</span>
                    : <span className="inline-flex items-center gap-1 text-amber-700"><CircleAlert className="size-4" aria-hidden="true" /> Incompleto</span>}
                  {!a.has_logo && <span className="block font-normal text-slate-500">sem logo</span>}
                </Item>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Histórico de ações admin" />
            <ul className="divide-y divide-slate-100 text-sm">
              {audit.map((r) => (
                <li key={r.id} className="px-5 py-2.5">
                  <p className="text-slate-900">{ACTION_LABELS[r.action] || r.action}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(r.created_at)} · {r.admin_username}{actionDetail(r) && ` · ${actionDetail(r)}`}</p>
                </li>
              ))}
              {!audit.length && <li className="px-5 py-3 text-slate-500">Nenhuma ação ainda.</li>}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}

/** Cartão da conta de teste (só a master): plano, senha do login, voltar a contar e excluir. */
function TestAccountCard({ a, members, onlyHere }) {
  const deletable = members.filter((m) => onlyHere.includes(m.user_id));
  const owner = members.find((m) => m.role === 'owner' && onlyHere.includes(m.user_id));
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><FlaskConical className="size-4 text-violet-600" aria-hidden="true" /> Conta de teste</span>} />
      <CardContent className="space-y-6 [&>*+*]:border-t [&>*+*]:border-slate-100 [&>*+*]:pt-5">
        <ActionForm action={setTestPlan} className="space-y-3">
          <input type="hidden" name="assistance_id" value={a.id} />
          <PlanChoice idPrefix="plano-teste" defaultValue={a.test_plan || 'pro'} compact />
          <SubmitButton size="sm" pendingText="Salvando...">Salvar plano</SubmitButton>
        </ActionForm>

        {owner && (
          <ActionForm action={resetTestPassword} resetOnSuccess className="space-y-3">
            <input type="hidden" name="assistance_id" value={a.id} />
            <input type="hidden" name="user_id" value={owner.user_id} />
            <p className="text-sm font-medium text-slate-900">Senha do login</p>
            <p className="-mt-2 text-xs text-slate-500">{owner.email}</p>
            <Field label="Nova senha" name="password" hint="Mínimo de 8 caracteres.">
              <Input id="password" name="password" type="password" maxLength={72} autoComplete="new-password" />
            </Field>
            <SubmitButton size="sm" variant="outline" pendingText="Trocando...">Trocar senha</SubmitButton>
          </ActionForm>
        )}

        <ActionForm action={unmarkTest} className="space-y-2" confirm={`${a.name} volta a contar como assistência, com as regras normais de plano. Continuar?`}>
          <input type="hidden" name="assistance_id" value={a.id} />
          <p className="text-sm font-medium text-slate-900">Não é teste?</p>
          <p className="text-xs text-slate-500">Volta para a lista de assistências e para os números. O plano passa a seguir as regras normais (sem teste grátis novo).</p>
          <SubmitButton size="sm" variant="outline" pendingText="Salvando...">Voltar a contar como assistência</SubmitButton>
        </ActionForm>

        <ActionForm action={deleteTestAccount} className="space-y-3"
          confirm={`Excluir ${a.name} para sempre? Não dá para desfazer.`}>
          <input type="hidden" name="assistance_id" value={a.id} />
          <p className="inline-flex items-center gap-2 text-sm font-medium text-red-700"><Trash2 className="size-4" aria-hidden="true" /> Excluir conta de teste</p>
          <p className="text-xs text-slate-500">
            Apaga a assistência com OS, orçamentos, clientes, caixa, fotos e logo.
            {deletable.length
              ? <> Também apaga {deletable.length === 1 ? 'o login' : 'os logins'} {deletable.map((m) => m.email).join(', ')}, que só {deletable.length === 1 ? 'existe' : 'existem'} nesta conta.</>
              : ' Nenhum login é apagado (todos participam de outra assistência).'}
          </p>
          <Field label={`Digite "${a.name}" para confirmar`} name="confirm_name">
            <Input id="confirm_name" name="confirm_name" maxLength={160} autoComplete="off" />
          </Field>
          <SubmitButton size="sm" variant="danger" pendingText="Excluindo...">Excluir para sempre</SubmitButton>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
