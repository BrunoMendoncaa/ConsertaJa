// Permissões da área admin. A conta master (variáveis ADMIN_* da Vercel) pode tudo;
// as outras contas (tabela admin_accounts) só o que a master marcar.
// Para criar uma permissão nova: acrescente aqui e use can(session, 'chave') na página ou ação.

export const PERMISSION_GROUPS = [
  {
    title: 'Visão geral',
    items: [
      { key: 'visao_geral', label: 'Ver a visão geral', hint: 'Totais de assistências, testes, pagantes e quem precisa de atenção.' },
      { key: 'financeiro', label: 'Ver valores e pagamentos', hint: 'Receita mensal, recebido no mês, valor dos planos e cobranças do Mercado Pago.' },
    ],
  },
  {
    title: 'Assistências',
    items: [
      { key: 'assistencias_ver', label: 'Ver assistências, donos e equipe', hint: 'Lista, detalhes e contatos (telefone, e-mail, WhatsApp).' },
      { key: 'assistencias_exportar', label: 'Baixar a planilha (CSV)', requires: 'assistencias_ver' },
      { key: 'assistencias_estender_teste', label: 'Estender o Pro grátis (teste)', requires: 'assistencias_ver' },
      { key: 'assistencias_suspender', label: 'Suspender e reativar assistências', requires: 'assistencias_ver' },
      { key: 'assistencias_mercado_pago', label: 'Conferir a assinatura no Mercado Pago', requires: 'assistencias_ver' },
    ],
  },
  {
    title: 'Usuários',
    items: [
      { key: 'usuarios_ver', label: 'Ver pessoas cadastradas', hint: 'Nome, e-mail, telefone e assistências de cada pessoa.' },
    ],
  },
  {
    title: 'Site',
    items: [
      { key: 'site_ver', label: 'Ver acessos do site', hint: 'Visitas, origens, cidades e cliques da página inicial.' },
    ],
  },
];

export const PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items);
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
const BY_KEY = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p]));

export function permissionLabel(key) {
  return BY_KEY[key]?.label || key;
}

/** Só chaves conhecidas, sem repetir, na ordem da lista, e com as que cada uma exige (ex.: estender teste exige ver). */
export function normalizePermissions(list) {
  const set = new Set((Array.isArray(list) ? list : [list]).map((k) => String(k ?? '')).filter((k) => BY_KEY[k]));
  for (const k of [...set]) if (BY_KEY[k].requires) set.add(BY_KEY[k].requires);
  return PERMISSION_KEYS.filter((k) => set.has(k));
}

export function can(session, key) {
  if (!session) return false;
  if (session.master) return true;
  return Array.isArray(session.permissions) && session.permissions.includes(key);
}

// Seções do menu, na ordem. "Acessos" é só da master.
export const SECTIONS = [
  { href: '/admin', label: 'Visão geral', permission: 'visao_geral' },
  { href: '/admin/assistencias', label: 'Assistências', permission: 'assistencias_ver' },
  { href: '/admin/usuarios', label: 'Usuários', permission: 'usuarios_ver' },
  { href: '/admin/site', label: 'Site', permission: 'site_ver' },
  { href: '/admin/acessos', label: 'Acessos', permission: 'master' },
];

export function allowedSections(session) {
  return SECTIONS.filter((s) => (s.permission === 'master' ? Boolean(session?.master) : can(session, s.permission)));
}

/** Primeira página que a conta pode abrir (ou a de "sem acesso"). */
export function homeFor(session) {
  return allowedSections(session)[0]?.href || '/admin/sem-acesso';
}

export const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;
