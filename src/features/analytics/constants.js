// Páginas públicas que entram na contagem de acessos do site.
export const TRACKED_PATHS = ['/', '/14dias', '/cadastro', '/entrar'];

export const PAGE_LABELS = {
  '/': 'Página inicial',
  '/14dias': 'Página inicial (link da campanha)',
  '/cadastro': 'Cadastro',
  '/entrar': 'Entrar',
};

// Links curtos de campanha: mostram a página inicial e marcam a origem da visita.
// Ex.: a mensagem do WhatsApp usa https://tecnofix.pro/14dias
export const CAMPAIGN_PATHS = {
  '/14dias': { utm_source: 'whatsapp', utm_medium: 'mensagem', utm_campaign: 'convite-14-dias' },
};

// Nome que aparece nos botões rastreados (atributo data-track nos links da landing).
export const CTA_LABELS = {
  'topo-criar-conta': 'Topo: Criar conta grátis',
  'topo-entrar': 'Topo: Entrar',
  'hero-teste-gratis': 'Principal: Começar teste grátis',
  'hero-ja-tenho-conta': 'Principal: Já tenho conta',
  'rodape-teste-gratis': 'Final da página: Começar teste',
};

// Botões que levam ao cadastro (contam como "clicou em teste grátis").
export const SIGNUP_CTAS = ['topo-criar-conta', 'hero-teste-gratis', 'rodape-teste-gratis'];

// Chave do navegador para não contar as visitas do próprio dono (ligada na área admin).
export const NO_TRACK_KEY = 'tf_nao_contar';
