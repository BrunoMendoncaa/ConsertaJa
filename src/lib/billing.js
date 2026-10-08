// Planos e regras da assinatura do Conserta Já (usado no servidor, nas telas e na landing).
// Os mesmos números estão nas regras do banco (migration 0011): 14 dias de teste
// e 7 dias de tolerância para pagamento atrasado.

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;

export const PLANS = {
  monthly: {
    cycle: 'monthly',
    label: 'Mensal',
    amount: 49,
    months: 1,
    priceLabel: 'R$ 49/mês',
    reason: 'Conserta Já — assinatura mensal',
  },
  yearly: {
    cycle: 'yearly',
    label: 'Anual',
    amount: 490,
    months: 12,
    priceLabel: 'R$ 490/ano',
    note: '2 meses grátis',
    reason: 'Conserta Já — assinatura anual',
  },
};

export const PLAN_FEATURES = [
  'OS, clientes e equipamentos ilimitados',
  'Orçamento com aprovação pelo celular',
  'Portal do cliente e certificado de garantia',
  'Caixa, relatórios e equipe com permissões',
];

/** Texto curto da situação da conta (vem de billing_status no banco). */
export const ACCESS_LABELS = {
  trial: 'Teste grátis',
  active: 'Assinatura ativa',
  grace: 'Pagamento pendente',
  blocked: 'Assinatura necessária',
};
