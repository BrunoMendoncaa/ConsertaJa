import Link from 'next/link';
import { TriangleAlert, Lock, Sparkles } from 'lucide-react';
import { formatDate, addDaysISO } from '@/lib/dates';
import { GRACE_DAYS, FREE_OS_LIMIT, trialDaysLeft, freeUsage } from '@/lib/billing';

const TONES = {
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  red: 'border-red-200 bg-red-50 text-red-800',
  brand: 'border-brand-200 bg-brand-50 text-brand-900',
};

function Bar({ tone, Icon, children, action }) {
  return (
    <div className={`mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-2.5 text-sm print:hidden ${TONES[tone]}`}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
      {action}
    </div>
  );
}

/**
 * Aviso no topo do painel: Pro grátis acabando, plano Grátis perto do limite do mês,
 * pagamento pendente ou assistência suspensa.
 */
export function BillingNotice({ billing }) {
  if (!billing) return null;
  const { access, paid_until: paidUntil, can_manage: canManage } = billing;
  const daysLeft = trialDaysLeft(billing);
  const usage = freeUsage(billing);
  const link = (label) => (canManage
    ? <Link href="/painel/plano" className="whitespace-nowrap font-semibold underline">{label}</Link>
    : <span className="whitespace-nowrap">Avise o responsável pela assistência.</span>);

  if (access === 'trial' && daysLeft <= 5 && !billing.has_subscription) {
    const when = daysLeft === 0 ? 'termina hoje' : daysLeft === 1 ? 'termina amanhã' : `termina em ${daysLeft} dias`;
    return (
      <Bar tone="brand" Icon={Sparkles} action={link('Assinar o Pro')}>
        Seu Pro grátis {when}. Depois, a conta continua no plano Grátis, com até {FREE_OS_LIMIT} OS por mês.
      </Bar>
    );
  }
  if (usage?.reached) {
    return (
      <Bar tone="red" Icon={Lock} action={link('Assinar o Pro')}>
        Você usou as {usage.limit} OS do plano Grátis deste mês. Para abrir mais, assine o Pro (ou aguarde {formatDate(billing.month_resets_at)}).
        Tudo o que já existe continua funcionando.
      </Bar>
    );
  }
  if (usage?.near) {
    return (
      <Bar tone="amber" Icon={TriangleAlert} action={link('Conhecer o Pro')}>
        Você já usou {usage.used} de {usage.limit} OS do plano Grátis neste mês. No Pro as OS são sem limite.
      </Bar>
    );
  }
  if (access === 'grace') {
    return (
      <Bar tone="amber" Icon={TriangleAlert} action={link('Ver meu plano')}>
        O Mercado Pago ainda não confirmou a cobrança da assinatura. Regularize até {formatDate(addDaysISO(paidUntil || billing.trial_ends_at, GRACE_DAYS))} para continuar no Pro.
      </Bar>
    );
  }
  if (access === 'blocked') {
    return (
      <Bar tone="red" Icon={Lock}>
        Esta assistência está suspensa: você vê o que já existe, mas não abre OS nova. Fale com o suporte do TecnoFix.
      </Bar>
    );
  }
  return null;
}
