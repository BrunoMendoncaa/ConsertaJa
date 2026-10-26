// Aplicações acompanhadas pela área admin (a central). Hoje só o TecnoFix.
//
// Para acrescentar uma aplicação:
// 1. Uma entrada nova em APPS (key única, minúsculas; o endereço fica /admin/<key>).
// 2. As permissões dela em permissionGroups (chaves únicas, de preferência começando pela key).
// 3. As páginas em src/app/admin/(painel)/<key>/ e o resumo da tela inicial em app-summaries.js
//    (se a aplicação estiver em outro sistema, o resumo pode vir de uma API dela).
// Os acessos criados pela master dizem em quais aplicações cada pessoa entra.

export const APPS = [
  {
    key: 'tecnofix',
    name: 'TecnoFix',
    tagline: 'Sistema para assistência técnica',
    site: 'https://tecnofix.pro',
    base: '/admin/tecnofix',
    testAccounts: true,
    sections: [
      { path: '', label: 'Visão geral', permission: 'visao_geral' },
      { path: '/assistencias', label: 'Assistências', permission: 'assistencias_ver' },
      { path: '/usuarios', label: 'Usuários', permission: 'usuarios_ver' },
      { path: '/site', label: 'Site', permission: 'site_ver' },
    ],
    permissionGroups: [
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
    ],
  },
];

export const APP_KEYS = APPS.map((a) => a.key);
const BY_KEY = Object.fromEntries(APPS.map((a) => [a.key, a]));

export function getApp(key) {
  return BY_KEY[key] || null;
}

/** Endereço dentro da aplicação: appPath('tecnofix', '/assistencias') = /admin/tecnofix/assistencias */
export function appPath(key, path = '') {
  return `${getApp(key)?.base || '/admin'}${path}`;
}

/** Aplicação do endereço atual (para o menu do topo), ou null na tela inicial e em Acessos. */
export function appFromPath(pathname) {
  return APPS.find((a) => pathname === a.base || pathname.startsWith(`${a.base}/`)) || null;
}

/** Só chaves de aplicações conhecidas, sem repetir, na ordem da lista. */
export function normalizeApps(list) {
  const set = new Set((Array.isArray(list) ? list : [list]).map((k) => String(k ?? '')));
  return APP_KEYS.filter((k) => set.has(k));
}
