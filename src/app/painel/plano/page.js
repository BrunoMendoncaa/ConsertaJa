import { CircleCheck, ShieldCheck, Clock, TriangleAlert, Lock, CreditCard, Gauge, Minus, FlaskConical } from 'lucide-react';
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
import { PLANS, PLAN_COMPARISON, GRACE_DAYS, FREE_OS_LIMIT, trialDaysLeft, freeUsage } from '@/lib/billing';
import { formatDate, addDaysISO } from '@/lib/dates';
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


const RETURN_NOTICES = {
  confirmado: ['success', 'Pagamento confirmado! Sua assinatura está ativa.'],
  agendado: ['success', 'Assinatura confirmada! A primeira cobrança será feita no fim do seu Pro grátis.'],
  pendente: ['info', 'Recebemos seu retorno do Mercado Pago. Assim que o pagamento for aprovado a conta é liberada (pode levar alguns minutos). Use "Verificar pagamento" para conferir.'],
  erro: ['warning', 'Não conseguimos consultar o Mercado Pago agora. Use "Verificar pagamento" em instantes.'],
};

function StatusCard({ billing }) {
  const { access, status, cycle, paid_until: paidUntil, trial_ends_at: trialEnds, has_subscription: subscribed } = billing;
  const daysLeft = trialDaysLeft(billing);
  const graceUntil = addDaysISO(paidUntil || trialEnds, GRACE_DAYS);
  const cycleLabel = cycle ? PLANS[cycle]?.label.toLowerCase() : null;
  const usage = freeUsage(billing);
  const variants = {
    trial: subscribed
      ? { Icon: ShieldCheck, tone: 'border-emerald-200 bg-emerald-50 text-emerald-900', title: 'Assinatura do Pro confirmada',
          text: `Você continua no Pro grátis até ${formatDate(trialEnds)}. A primeira cobrança (plano ${cycleLabel || ''}) é feita nesse dia pelo Mercado Pago.` }
      : { Icon: Clock, tone: 'border-brand-200 bg-brand-50 text-brand-900',
          title: daysLeft === 0 ? 'Pro grátis: último dia' : daysLeft === 1 ? 'Pro grátis: termina amanhã' : `Pro grátis: faltam ${daysLeft} dias`,
          text: `Tudo liberado até ${formatDate(trialEnds)}. Depois, a conta continua no plano Grátis (até ${FREE_OS_LIMIT} OS por mês, garantia em comprovante simples). Se assinar agora, a primeira cobrança só acontece no fim do Pro grátis.` },
    free: usage && {
      Icon: Gauge, tone: usage.reached ? 'border-red-200 bg-red-50 text-red-900' : usage.near ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-900',
      title: `Plano Grátis: ${usage.used} de ${usage.limit} OS usadas neste mês`,
      text: usage.reached
        ? `O limite do mês acabou. Assine o Pro para abrir OS sem limite agora, ou aguarde ${formatDate(billing.month_resets_at)}. Tudo o que já existe continua funcionando.`
        : `O limite renova em ${formatDate(billing.month_resets_at)}. No Pro, as OS são sem limite e a garantia sai no certificado completo, com o seu logo.`,
      meter: usage,
    },
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
      Icon: Lock, tone: 'border-red-200 bg-red-50 text-red-900', title: 'Assistência suspensa',
      text: 'Fale com o suporte do TecnoFix. Você vê e conclui o que já existe, mas não abre OS nova.',
    },
  };
  // Conta de teste do TecnoFix: o plano é escolhido na área admin e não tem cobrança.
  const test = billing.is_test && {
    Icon: FlaskConical, tone: 'border-violet-200 bg-violet-50 text-violet-900',
    title: `Conta de teste · plano ${billing.test_plan === 'free' ? 'Grátis' : 'Pro'}`,
    text: billing.test_plan === 'free'
      ? `Esta conta é de teste do TecnoFix e mostra o plano Grátis como o cliente vê (${usage ? `${usage.used} de ${usage.limit} OS neste mês` : `até ${FREE_OS_LIMIT} OS por mês`}). O plano é trocado na área admin; não tem assinatura nem cobrança.`
      : 'Esta conta é de teste do TecnoFix, com o Pro liberado. O plano é trocado na área admin; não tem assinatura nem cobrança.',
    meter: billing.test_plan === 'free' ? usage : null,
  };
  const v = test || variants[access] || variants.trial;
  return (
    <div className={`flex gap-4 rounded-xl border p-5 ${v.tone}`}>
      <v.Icon className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold">{v.title}</p>
        {v.meter && (
          <div className="mt-2 h-2 w-full max-w-sm overflow-hidden rounded-full bg-slate-200" role="meter" aria-valuemin={0} aria-valuemax={v.meter.limit} aria-valuenow={v.meter.used} aria-label="OS usadas no mês">
            <div className={`h-full rounded-full ${v.meter.reached ? 'bg-red-500' : v.meter.near ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${Math.min(100, (v.meter.used / v.meter.limit) * 100)}%` }} />
          </div>
        )}
        <p className="mt-2 text-sm opacity-90">{v.text}</p>
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
  const showSubscribe = !billing.is_test && (billing.access === 'free' || billing.access === 'grace'
    || (billing.access === 'trial' && !billing.has_subscription));
  const pendingCheckout = !billing.is_test && subs?.[0]?.status === 'pending';

  return (
    <>
      <PageHeader title="Meu plano" description="Plano Grátis ou Pro para a sua assistência." />

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          {returnNotice && <Alert variant={returnNotice[0]}>{returnNotice[1]}</Alert>}
          <StatusCard billing={billing} />

          {showSubscribe && (
            <Card>
              <CardHeader title="Assinar o Pro" description="OS sem limite, certificado com o seu logo e equipe. Pagamento seguro pelo Mercado Pago, sem fidelidade." />
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

          {role === 'owner' && billing.has_subscription && billing.status !== 'canceled' && ['trial', 'active', 'grace'].includes(billing.access) && (
            <details className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-600">Cancelar a renovação</summary>
              <p className="mt-2 text-sm text-slate-600">O Pro continua até o fim do período já pago. Depois, a conta volta ao plano Grátis (até {FREE_OS_LIMIT} OS por mês); nada é apagado.</p>
              <ActionForm action={cancelSubscription} className="mt-3" confirm="Cancelar a renovação da assinatura?">
                <SubmitButton variant="danger" size="sm" pendingText="Cancelando...">Cancelar renovação</SubmitButton>
              </ActionForm>
            </details>
          )}
        </div>

        <Card className="h-fit xl:col-span-2">
          <CardHeader title="Grátis x Pro" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2 font-medium"><span className="sr-only">Recurso</span></th>
                  <th className="px-2 py-2 text-center font-medium">Grátis</th>
                  <th className="px-5 py-2 text-center font-medium text-brand-700">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PLAN_COMPARISON.map(([what, free, pro]) => (
                  <tr key={what} className="align-top">
                    <td className="px-5 py-2.5 text-slate-700">{what}</td>
                    {[free, pro].map((v, i) => (
                      <td key={i} className={`py-2.5 text-center text-xs ${i ? 'px-5 font-medium text-slate-900' : 'px-2 text-slate-600'}`}>
                        {v === true ? <CircleCheck className="mx-auto size-4 text-emerald-600" aria-label="sim" />
                          : v === false ? <Minus className="mx-auto size-4 text-slate-300" aria-label="não" />
                            : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CardContent className="border-t border-slate-100 text-xs text-slate-500">
            Pro: {PLANS.monthly.priceLabel} ou {PLANS.yearly.priceLabel} ({PLANS.yearly.note}). Sem fidelidade; cancele quando quiser e use até o fim do período pago.
          </CardContent>
        </Card>
      </div>
    </>
  );
}
