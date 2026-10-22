// Planos e regras da assinatura do TecnoFix (usado no servidor, nas telas e na landing).
// Os mesmos números estão nas regras do banco: 14 dias de Pro grátis na conta nova
// (migration 0011), 7 dias de tolerância para pagamento atrasado e, sem assinatura,
// o plano Grátis com até 30 OS por mês (migration 0018).

import { daysFromToday } from '@/lib/dates';

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;
export const FREE_OS_LIMIT = 30;
/** A partir de quantas OS no mês o plano Grátis começa a avisar. */
export const FREE_OS_WARN_AT = 24;

export const PLANS = {
  monthly: {
    cycle: 'monthly',
    label: 'Mensal',
    amount: 49,
    months: 1,
    priceLabel: 'R$ 49/mês',
    reason: 'TecnoFix — assinatura mensal',
  },
  yearly: {
    cycle: 'yearly',
    label: 'Anual',
    amount: 490,
    months: 12,
    priceLabel: 'R$ 490/ano',
    note: '2 meses grátis',
    reason: 'TecnoFix — assinatura anual',
  },
};

/** O que o Pro tem (Meu plano e landing). */
export const PLAN_FEATURES = [
  'OS, clientes e equipamentos sem limite',
  'Orçamento com aprovação pelo celular',
  'Certificado de garantia com seu logo, peças e serviços e suas condições',
  'Equipe com técnicos e atendentes e permissões',
  'Portal do cliente só com a sua marca',
];

/** Comparação Grátis x Pro: [o quê, Grátis, Pro]. true = sim, false = não, texto = detalhe. */
export const PLAN_COMPARISON = [
  ['Ordens de serviço', `até ${FREE_OS_LIMIT} por mês`, 'sem limite'],
  ['Clientes, equipamentos e fotos', true, true],
  ['Orçamento aprovado pelo celular', true, true],
  ['Portal do cliente', 'com "feito com TecnoFix"', 'só com a sua marca'],
  ['Garantia na entrega', 'comprovante simples', 'certificado com seu logo, peças e serviços'],
  ['Caixa e relatórios', true, true],
  ['Convidar técnicos e atendentes para a equipe', false, true],
];

/** Texto curto da situação da conta (vem de billing_status no banco). */
export const ACCESS_LABELS = {
  trial: 'Pro grátis',
  active: 'Pro',
  grace: 'Pagamento pendente',
  free: 'Plano Grátis',
  blocked: 'Suspensa',
};

/** Uso do plano Grátis no mês: { used, limit, left, near, reached } (null fora do Grátis). */
export function freeUsage(billing) {
  if (!billing || billing.access !== 'free') return null;
  const limit = Number(billing.os_limit) || FREE_OS_LIMIT;
  const used = Math.max(0, Number(billing.os_month) || 0);
  return { used, limit, left: Math.max(0, limit - used), near: used >= FREE_OS_WARN_AT && used < limit, reached: used >= limit };
}

/**
 * Dias de teste que faltam, contados no calendário de Brasília: 0 = termina hoje, 1 = amanhã.
 * (O banco devolve trial_days_left em blocos de 24 horas; aqui vale a data do fim do teste.)
 */
export function trialDaysLeft(billing, now = new Date()) {
  if (!billing) return null;
  const days = billing.trial_ends_at ? daysFromToday(billing.trial_ends_at, now) : null;
  return days === null ? billing.trial_days_left ?? null : Math.max(0, days);
}
