import { CircleCheck, ShieldCheck, Clock, TriangleAlert, Lock, CreditCard } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/constants';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { getBillingStatus } from '@/features/billing/queries';
import { startCheckout, refreshBilling, cancelSubscription } from '@/features/billing/actions';
import { isMercadoPagoConfigured } from '@/lib/mercadopago';
import { PLANS, PLAN_FEATURES, GRACE_DAYS } from '@/lib/billing';
import { formatDate } from '@/lib/dates';
import { formatBRL } from '@/lib/money';

export const metadata = { title: 'Meu plano' };

const PAYMENT_STATUS = {
  approved: ['Pago', 'text-emerald-700'],
  pending: ['Aguardando', 'text-amber-700'],
  in_process: ['Em análise', 'text-amber-700'],
  rejected: ['Recusado', 'text-red-700'],
  cancelled: ['Cancelado', 'text-slate-500'],
  refunded: ['Estornado', 'text-slate-500'],
};

function plusDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const RETURN_NOTICES = {
  confirmado: ['success', 'Pagamento confirmado! Sua assinatura está ativa.'],
  agendado: ['success', 'Assinatura confirmada! A primeira cobrança será feita no fim do teste grátis.'],
  pendente: ['info', 'Recebemos seu retorno do Mercado Pago. Assim que o pagamento for aprovado a conta é liberada (pode levar alguns minutos). Use "Verificar pagamento" para conferir.'],
  erro: ['warning', 'Não conseguimos consultar o Mercado Pago agora. Use "Verificar pagamento" em instantes.'],
};

function StatusCard({ billing }) {
  const { access, status, cycle, paid_until: paidUntil, trial_ends_at: trialEnds, trial_days_left: daysLeft, has_subscription: subscribed } = billing;
  const graceUntil = plusDays(paidUntil || trialEnds, GRACE_DAYS);
  const cycleLabel = cycle ? PLANS[cycle]?.label.toLowerCase() : null;
  const variants = {
    trial: subscribed
      ? { Icon: ShieldCheck, tone: 'border-emerald-200 bg-emerald-50 text-emerald-900', title: 'Assinatura confirmada',
          text: `Você continua no teste grátis até ${formatDate(trialEnds)}. A primeira cobrança (plano ${cycleLabel || ''}) é feita nesse dia pelo Mercado Pago.` }
      : { Icon: Clock, tone: 'border-brand-200 bg-brand-50 text-brand-900',
          title: daysLeft <= 1 ? 'Teste grátis: último dia' : `Teste grátis: faltam ${daysLeft} dias`,
          text: `Tudo liberado até ${formatDate(trialEnds)}. Se assinar agora, a primeira cobrança só acontece no fim do teste.` },
    active: status === 'canceled'
      ? { Icon: ShieldCheck, tone: 'border-slate-200 bg-slate-50 text-slate-900', title: 'Renovação cancelada',
          text: `Sua conta continua liberada até ${formatDate(paidUntil)}. Depois disso, é só assinar de novo.` }
      : { Icon: ShieldCheck, tone: 'border-emerald-200 bg-emerald-50 text-emerald-900', title: 'Assinatura ativa',
          text: `Plano ${cycleLabel || ''} pago até ${formatDate(paidUntil)}. A renovação é automática pelo Mercado Pago.` },
    grace: {
      Icon: TriangleAlert, tone: 'border-amber-200 bg-amber-50 text-amber-900', title: 'Pagamento pendente',
      text: `O Mercado Pago ainda não confirmou a cobrança. Se precisar, atualize o cartão no Mercado Pago até ${formatDate(graceUntil)} para continuar abrindo OS.`,
    },
    blocked: {
      Icon: Lock, tone: 'border-red-200 bg-red-50 text-red-900', title: 'Assinatura necessária',
      text: paidUntil
        ? `A assinatura venceu em ${formatDate(paidUntil)}. Você vê e conclui o que já existe, mas para abrir OS nova é preciso assinar.`
        : `O teste grátis terminou em ${formatDate(trialEnds)}. Você vê e conclui o que já existe, mas para abrir OS nova é preciso assinar.`,
    },
  };
  const v = variants[access] || variants.trial;
  return (
    <div className={`flex gap-4 rounded-xl border p-5 ${v.tone}`}>
      <v.Icon className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-lg font-semibold">{v.title}</p>
        <p className="mt-1 text-sm opacity-90">{v.text}</p>
      </div>
    </div>
  );
}

export default async function PlanPage({ searchParams }) {
  const { supabase, assistance, user, role } = await requireStaff(MANAGER_ROLES);
  const sp = await searchParams;
  const configured = isMercadoPagoConfigured();

  // Volta do Mercado Pago: a rota /painel/plano/retorno já conferiu na API e informa o resultado.
  const returnNotice = RETURN_NOTICES[sp?.pagamento] || null;

  const billing = await getBillingStatus();
  const [{ data: payments }, { data: subs }] = await Promise.all([
    supabase.from('billing_payments').select('id, amount, status, paid_at, created_at').order('created_at', { ascending: false }).limit(24),
    supabase.from('billing_subscriptions').select('id, status, cycle, created_at').order('created_at', { ascending: false }).limit(1),
  ]);

  if (!billing) {
    return (
      <>
        <PageHeader title="Meu plano" />
        <Alert variant="warning">O banco ainda não tem a atualização de assinatura (migration 0011). Aplique-a para ver o plano.</Alert>
      </>
    );
  }

  const isActive = billing.access === 'active' && billing.status !== 'canceled';
  // Não oferece assinar de novo enquanto já há período pago ou assinatura aguardando a 1ª cobrança.
  const showSubscribe = billing.access === 'blocked' || billing.access === 'grace'
    || (billing.access === 'trial' && !billing.has_subscription);
  const pendingCheckout = subs?.[0]?.status === 'pending';

  return (
    <>
      <PageHeader title="Meu plano" description="Assinatura do Conserta Já para a sua assistência." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {returnNotice && <Alert variant={returnNotice[0]}>{returnNotice[1]}</Alert>}
          <StatusCard billing={billing} />

          {showSubscribe && (
            <Card>
              <CardHeader title="Assinar o Conserta Já" description="Plano único, com tudo liberado. Pagamento seguro pelo Mercado Pago." />
              <CardContent>
                {!configured ? (
                  <Alert variant="warning">O pagamento ainda não foi configurado neste ambiente (MP_ACCESS_TOKEN).</Alert>
                ) : (
                  <ActionForm action={startCheckout} className="space-y-5">
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium text-slate-700">Como prefere pagar?</legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {Object.values(PLANS).map((p) => (
                          <label key={p.cycle}
                            className="relative flex cursor-pointer flex-col rounded-xl border border-slate-300 p-4 has-[:checked]:border-brand-600 has-[:checked]:ring-2 has-[:checked]:ring-brand-600/20">
                            <input type="radio" name="cycle" value={p.cycle} defaultChecked={p.cycle === 'monthly'} className="sr-only" />
                            <span className="text-sm font-medium text-slate-600">{p.label}</span>
                            <span className="mt-1 text-2xl font-bold text-slate-900">{formatBRL(p.amount)}<span className="text-sm font-medium text-slate-500">/{p.cycle === 'yearly' ? 'ano' : 'mês'}</span></span>
                            {p.note && <span className="mt-2 inline-flex w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">{p.note}</span>}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <Field label="E-mail da sua conta no Mercado Pago" name="payer_email"
                      hint="O Mercado Pago confere esse e-mail na hora do pagamento. Se você usa outro e-mail lá, troque aqui.">
                      <Input id="payer_email" name="payer_email" type="email" required defaultValue={user.email} autoComplete="email" />
                    </Field>
                    <div className="flex flex-wrap items-center gap-3">
                      <SubmitButton pendingText="Abrindo o Mercado Pago..."><CreditCard className="size-4" aria-hidden="true" /> Assinar com Mercado Pago</SubmitButton>
                      <span className="text-xs text-slate-500">Você será levado ao site do Mercado Pago e volta para cá no fim.</span>
                    </div>
                  </ActionForm>
                )}
              </CardContent>
            </Card>
          )}

          {configured && (pendingCheckout || billing.has_subscription) && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <p className="text-sm text-slate-600">
                  {pendingCheckout && !isActive ? 'Já pagou no Mercado Pago? Confira se o pagamento foi aprovado.' : 'A confirmação do Mercado Pago chega sozinha. Se precisar, confira agora.'}
                </p>
                <ActionForm action={refreshBilling} className="flex flex-wrap items-center gap-3">
                  <SubmitButton variant="outline" pendingText="Consultando...">Verificar pagamento</SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader title="Pagamentos" />
            {payments?.length ? (
              <ul className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const [label, cls] = PAYMENT_STATUS[p.status] || [p.status, 'text-slate-600'];
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span className="text-slate-700">{formatDate(p.paid_at || p.created_at)}</span>
                      <span className={`font-medium ${cls}`}>{label}</span>
                      <span className="tabular font-semibold text-slate-900">{formatBRL(p.amount)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <CardContent className="text-sm text-slate-500">Nenhum pagamento ainda.</CardContent>}
          </Card>

          {role === 'owner' && billing.has_subscription && billing.status !== 'canceled' && billing.access !== 'blocked' && (
            <details className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-600">Cancelar a renovação</summary>
              <p className="mt-2 text-sm text-slate-600">A conta continua liberada até o fim do período já pago. Depois, você ainda vê tudo, mas não abre OS nova.</p>
              <ActionForm action={cancelSubscription} className="mt-3" confirm="Cancelar a renovação da assinatura?">
                <SubmitButton variant="danger" size="sm" pendingText="Cancelando...">Cancelar renovação</SubmitButton>
              </ActionForm>
            </details>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader title="O que está incluído" />
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-700">
              {PLAN_FEATURES.map((f) => (
                <li key={f} className="flex gap-2"><CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />{f}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">Sem fidelidade. Cancele quando quiser e use até o fim do período pago.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
