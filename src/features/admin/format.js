// Regras de exibição da área admin (puras, testadas em tests/admin.test.js).
import { PLANS } from '@/lib/billing';
import { daysFromToday } from '@/lib/dates';


/**
 * Situação comercial da assistência, a partir de billing_access (mesma regra do app)
 * e do status da assinatura.
 */
export const SITUATIONS = {
  trial: { label: 'Pro grátis (teste)', tone: 'blue' },
  trial_subscribed: { label: 'Pro grátis · já assinou', tone: 'teal' },
  active: { label: 'Pro pago', tone: 'emerald' },
  grace: { label: 'Pagamento pendente', tone: 'amber' },
  expired: { label: 'Plano Grátis', tone: 'orange' },
  canceled: { label: 'Grátis · cancelou o Pro', tone: 'zinc' },
  suspended: { label: 'Suspensa', tone: 'red' },
  test: { label: 'Conta de teste', tone: 'violet' },
};

/** Plano da conta de teste (escolhido na área admin). */
export const TEST_PLANS = {
  pro: { label: 'Pro', hint: 'tudo liberado' },
  free: { label: 'Grátis', hint: 'como o cliente do plano Grátis vê' },
};

export const SITUATION_FILTERS = [
  ['todas', 'Todas'],
  ['trial', 'Pro grátis'],
  ['active', 'Pro pago'],
  ['grace', 'Pagamento pendente'],
  ['expired', 'Plano Grátis'],
  ['canceled', 'Cancelaram o Pro'],
  ['suspended', 'Suspensas'],
];

export function situationKey(a) {
  if (a.subscription_status === 'suspended') return 'suspended';
  if (a.is_test) return 'test';
  if (a.access === 'active') return 'active';
  if (a.access === 'grace') return 'grace';
  if (a.access === 'trial') {
    return a.mp_preapproval_id && a.subscription_status !== 'canceled' && a.subscription_mp_status === 'authorized'
      ? 'trial_subscribed' : 'trial';
  }
  return a.subscription_status === 'canceled' ? 'canceled' : 'expired';
}

/** Login que só participa de contas de teste (fica fora da lista de usuários e das contagens). */
export function isTestUser(u) {
  const m = u.memberships || [];
  return m.length > 0 && m.every((x) => x.is_test);
}

export function situation(a) {
  const key = situationKey(a);
  return { key, ...SITUATIONS[key] };
}

/** Filtro "Em teste" inclui quem já assinou durante o teste. */
export function matchesSituation(a, filter) {
  if (!filter || filter === 'todas') return true;
  const key = situationKey(a);
  return filter === 'trial' ? key === 'trial' || key === 'trial_subscribed' : key === filter;
}

/** Dias inteiros até a data (negativo = já passou). */
/** Dias de calendário em Brasília até a data (0 = hoje, 1 = amanhã, -1 = ontem). */
export function daysUntil(date, now = Date.now()) {
  if (!date) return null;
  if (Number.isNaN(new Date(date).getTime())) return null;
  return daysFromToday(date, new Date(now));
}

/** Qual data importa agora: fim do teste, pago até ou quando venceu. */
export function dueInfo(a, now = Date.now()) {
  const key = situationKey(a);
  if (key === 'suspended') return { date: null, label: 'Suspensa', days: null };
  if (key === 'test') return { date: null, label: 'Conta de teste', days: null };
  if (key === 'trial' || key === 'trial_subscribed') {
    return { date: a.trial_ends_at, label: key === 'trial' ? 'Teste até' : '1ª cobrança', days: daysUntil(a.trial_ends_at, now) };
  }
  if (key === 'active' || key === 'grace') return { date: a.paid_until, label: 'Pago até', days: daysUntil(a.paid_until, now) };
  const ended = [a.trial_ends_at, a.paid_until].filter(Boolean).map((d) => new Date(d).getTime());
  const last = ended.length ? new Date(Math.max(...ended)).toISOString() : null;
  return { date: last, label: 'No Grátis desde', days: daysUntil(last, now) };
}

export function relativeDays(days) {
  if (days === null || days === undefined) return '';
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days === -1) return 'ontem';
  return days > 0 ? `em ${days} dias` : `há ${-days} dias`;
}

/** Valor mensal da assinatura (anual ÷ 12). Só conta quem está pagando (ativa ou pendente). */
export function monthlyValue(a) {
  const key = situationKey(a);
  if (key !== 'active' && key !== 'grace') return 0;
  const plan = PLANS[a.billing_cycle] || PLANS.monthly;
  const amount = Number(a.subscription_amount) || plan.amount;
  return Math.round((amount / plan.months) * 100) / 100;
}

export function cycleLabel(cycle) {
  return PLANS[cycle]?.label || '—';
}

/** Cadastro mínimo da loja (mesma regra do app). */
export function profileComplete(a) {
  const addr = a.address || {};
  const filled = (v) => String(v ?? '').trim().length > 0;
  return (filled(a.whatsapp) || filled(a.phone)) && ['cep', 'rua', 'numero', 'bairro', 'cidade', 'uf'].every((k) => filled(addr[k]));
}

/** Busca simples por nome, endereço do portal, dono, e-mail ou telefone (sem acento). */
export function matchesQuery(a, q) {
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const query = norm(q).trim();
  if (!query) return true;
  const digits = query.replace(/\D/g, '');
  const hay = norm([a.name, a.slug, a.owner_name, a.owner_email, a.email, a.address?.cidade].join(' '));
  if (hay.includes(query)) return true;
  if (digits.length >= 4) {
    return [a.phone, a.whatsapp, a.owner_phone, a.document].some((v) => String(v || '').replace(/\D/g, '').includes(digits));
  }
  return false;
}

/** CSV para Excel em português: separador ";", aspas quando preciso e BOM UTF-8. */
export function toCsv(header, rows) {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}
