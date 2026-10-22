// Páginas públicas que entram na contagem de acessos do site.
export const TRACKED_PATHS = ['/', '/14dias', '/gratis', '/anuncio', '/grupos', '/cadastro', '/entrar'];

export const PAGE_LABELS = {
  '/': 'Página inicial',
  '/14dias': 'Página inicial (link do WhatsApp)',
  '/gratis': 'Página inicial (link do WhatsApp · grátis)',
  '/anuncio': 'Página inicial (link do anúncio)',
  '/grupos': 'Página inicial (link dos grupos)',
  '/cadastro': 'Cadastro',
  '/entrar': 'Entrar',
};

// Links curtos de campanha: mostram a página inicial e marcam a origem da visita.
// Ex.: a mensagem do WhatsApp usa https://tecnofix.pro/14dias. Cada um precisa de um rewrite no next.config.mjs.
export const CAMPAIGN_PATHS = {
  '/14dias': { utm_source: 'whatsapp', utm_medium: 'mensagem', utm_campaign: 'convite-14-dias' },
  '/gratis': { utm_source: 'whatsapp', utm_medium: 'mensagem', utm_campaign: 'gratis' },
  '/anuncio': { utm_source: 'facebook', utm_medium: 'anuncio', utm_campaign: 'anuncio' },
  '/grupos': { utm_source: 'facebook', utm_medium: 'grupo', utm_campaign: 'grupos' },
};

// Nome que aparece nos botões rastreados (atributo data-track nos links da landing).
export const CTA_LABELS = {
  'topo-criar-conta': 'Topo: Criar conta grátis',
  'topo-entrar': 'Topo: Entrar',
  'hero-teste-gratis': 'Principal: Criar conta grátis',
  'hero-whatsapp': 'Principal: Tirar dúvida no WhatsApp',
  'hero-ja-tenho-conta': 'Principal: Já tenho conta',
  'meio-teste-gratis': 'Meio da página: Criar conta grátis',
  'barra-teste-gratis': 'Barra do celular: Criar conta grátis',
  'precos-gratis': 'Planos: Criar conta grátis',
  'precos-pro': 'Planos: Começar com o Pro',
  'barra-whatsapp': 'Barra do celular: WhatsApp',
  'duvidas-whatsapp': 'Perguntas: Chamar no WhatsApp',
  'rodape-teste-gratis': 'Final da página: Criar conta grátis',
};

// Botões que levam ao cadastro (contam como "clicou em teste grátis").
export const SIGNUP_CTAS = ['topo-criar-conta', 'hero-teste-gratis', 'meio-teste-gratis', 'barra-teste-gratis', 'precos-gratis', 'precos-pro', 'rodape-teste-gratis'];

// Botões que abrem o WhatsApp para tirar dúvida.
export const WHATSAPP_CTAS = ['hero-whatsapp', 'barra-whatsapp', 'duvidas-whatsapp'];

// Chave do navegador para não contar as visitas do próprio dono (ligada na área admin).
export const NO_TRACK_KEY = 'tf_nao_contar';
