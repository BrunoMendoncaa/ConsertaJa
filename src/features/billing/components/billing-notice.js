import Link from 'next/link';
import { TriangleAlert, Lock } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { GRACE_DAYS } from '@/lib/billing';

function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Aviso no topo do painel: teste acabando, pagamento pendente ou conta sem assinatura. */
export function BillingNotice({ billing }) {
  if (!billing) return null;
  const { access, trial_days_left: daysLeft, paid_until: paidUntil, can_manage: canManage } = billing;
  const action = canManage
    ? <Link href="/painel/plano" className="whitespace-nowrap font-semibold underline">{access === 'trial' ? 'Assinar' : 'Ver meu plano'}</Link>
    : <span className="whitespace-nowrap">Avise o responsável pela assistência.</span>;

  if (access === 'trial' && daysLeft <= 5 && !billing.has_subscription) {
    return (
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 print:hidden">
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        <span>{daysLeft <= 1 ? 'Seu teste grátis termina hoje.' : `Seu teste grátis termina em ${daysLeft} dias.`}</span>
        {action}
      </div>
    );
  }
  if (access === 'grace') {
    return (
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 print:hidden">
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        <span>O Mercado Pago ainda não confirmou a cobrança da assinatura. Regularize até {formatDate(addDays(paidUntil || billing.trial_ends_at, GRACE_DAYS))} para continuar abrindo OS.</span>
        {action}
      </div>
    );
  }
  if (access === 'blocked') {
    return (
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 print:hidden">
        <Lock className="size-4 shrink-0" aria-hidden="true" />
        <span>Sem assinatura ativa: você vê e conclui o que já existe, mas não abre OS nova.</span>
        {action}
      </div>
    );
  }
  return null;
}
