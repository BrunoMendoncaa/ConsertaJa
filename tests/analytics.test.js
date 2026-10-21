import { describe, it, expect } from 'vitest';
import { parseUserAgent, isBot } from '@/features/analytics/ua';
import { originOf, referrerHost, sourceFromHost } from '@/features/analytics/sources';
import { buildEvent, visitorCode, isSameOrigin } from '@/features/analytics/record';
import { summarize, periodRange, daysOf } from '@/features/analytics/stats';
import { whatsappLink } from '@/lib/contact';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const IPHONE_IG = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 345.0';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

const hdrs = (extra = {}) => new Headers({ host: 'tecnofix.pro', 'user-agent': ANDROID, 'x-forwarded-for': '200.1.2.3, 10.0.0.1',
  'x-vercel-ip-country': 'BR', 'x-vercel-ip-country-region': 'SP', 'x-vercel-ip-city': 'S%C3%A3o%20Paulo', ...extra });

describe('acessos do site: navegador e origem', () => {
  it('identifica aparelho, navegador e sistema', () => {
    expect(parseUserAgent(ANDROID)).toEqual({ device: 'mobile', browser: 'Chrome', os: 'Android' });
    expect(parseUserAgent(IPHONE_IG)).toEqual({ device: 'mobile', browser: 'Instagram', os: 'iOS' });
    expect(parseUserAgent(WINDOWS)).toEqual({ device: 'desktop', browser: 'Chrome', os: 'Windows' });
    expect(parseUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1').device).toBe('tablet');
  });

  it('robôs e prévias de link não contam (inclusive o WhatsApp montando o cartão)', () => {
    expect(isBot('WhatsApp/2.23.20.0 A')).toBe(true);
    expect(isBot('WhatsApp/2.24.1.5 i')).toBe(true);
    // Navegador de verdade aberto de dentro do WhatsApp: é gente e conta.
    expect(isBot(`${ANDROID} WhatsApp/2.24.21.80`)).toBe(false);
    expect(isBot('facebookexternalhit/1.1')).toBe(true);
    expect(isBot('Googlebot/2.1')).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot(ANDROID)).toBe(false);
  });

  it('origem: campanha > site de origem > app > sem origem', () => {
    expect(originOf({ utm_source: 'whatsapp', utm_campaign: 'convite-14-dias' })).toBe('WhatsApp · convite-14-dias');
    expect(originOf({ referrer_host: 'www.google.com.br' })).toBe('Google');
    expect(originOf({ referrer_host: 'l.instagram.com' })).toBe('Instagram');
    expect(originOf({ browser: 'Facebook' })).toBe('Facebook');
    expect(originOf({})).toMatch(/^Sem origem/);
    expect(sourceFromHost('exemplo.com.br')).toBe('exemplo.com.br');
  });

  it('referrer do próprio site não é origem', () => {
    expect(referrerHost('https://tecnofix.pro/cadastro', 'tecnofix.pro')).toBeNull();
    expect(referrerHost('https://www.tecnofix.pro/', 'tecnofix.pro')).toBeNull();
    expect(referrerHost('https://l.facebook.com/x', 'tecnofix.pro')).toBe('l.facebook.com');
    expect(referrerHost('lixo', 'tecnofix.pro')).toBeNull();
  });
});

describe('acessos do site: evento recebido', () => {
  const now = new Date('2026-10-19T15:00:00Z');

  it('monta a visita com cidade, aparelho e código do dia (sem guardar o IP)', () => {
    const r = buildEvent({ headers: hdrs(), body: { event: 'page_view', path: '/', session: 'abc-123', ref: 'https://www.google.com/' }, salt: 's', now });
    expect(r.ok).toBe(true);
    expect(r.row).toMatchObject({ p_event: 'page_view', p_path: '/', p_city: 'São Paulo', p_region: 'SP', p_country: 'BR',
      p_device: 'mobile', p_referrer_host: 'www.google.com', p_session: 'abc-123', p_label: null });
    expect(r.row.p_visitor).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(r.row)).not.toContain('200.1.2.3');
  });

  it('o link /14dias marca a campanha do WhatsApp', () => {
    const r = buildEvent({ headers: hdrs(), body: { event: 'page_view', path: '/14dias' }, salt: 's', now });
    expect(r.row).toMatchObject({ p_path: '/14dias', p_utm_source: 'whatsapp', p_utm_campaign: 'convite-14-dias' });
  });

  it('links do anúncio e dos grupos marcam o Facebook com campanhas separadas', () => {
    const a = buildEvent({ headers: hdrs(), body: { event: 'page_view', path: '/anuncio' }, salt: 's', now });
    const g = buildEvent({ headers: hdrs(), body: { event: 'page_view', path: '/grupos' }, salt: 's', now });
    expect(a.row).toMatchObject({ p_path: '/anuncio', p_utm_source: 'facebook', p_utm_campaign: 'anuncio' });
    expect(g.row).toMatchObject({ p_path: '/grupos', p_utm_source: 'facebook', p_utm_campaign: 'grupos' });
    expect(originOf({ utm_source: 'facebook', utm_campaign: 'grupos' })).toBe('Facebook · grupos');
  });

  it('o código do visitante muda de um dia para o outro', () => {
    const a = visitorCode({ ip: '1.1.1.1', ua: ANDROID, salt: 's', now });
    expect(visitorCode({ ip: '1.1.1.1', ua: ANDROID, salt: 's', now: new Date(now.getTime() + 3600000) })).toBe(a);
    expect(visitorCode({ ip: '1.1.1.1', ua: ANDROID, salt: 's', now: new Date(now.getTime() + 86400000) })).not.toBe(a);
    expect(visitorCode({ ip: '1.1.1.1', ua: ANDROID, salt: 'outro', now })).not.toBe(a);
  });

  it('recusa robô, outro site, página fora da lista e dados estranhos', () => {
    const base = { event: 'page_view', path: '/' };
    expect(buildEvent({ headers: hdrs({ 'user-agent': 'WhatsApp/2.23' }), body: base, salt: 's' }).ok).toBe(false);
    expect(buildEvent({ headers: hdrs({ origin: 'https://golpe.com' }), body: base, salt: 's' }).ok).toBe(false);
    expect(buildEvent({ headers: hdrs({ 'sec-fetch-site': 'cross-site' }), body: base, salt: 's' }).ok).toBe(false);
    expect(buildEvent({ headers: hdrs(), body: { ...base, path: '/painel' }, salt: 's' }).ok).toBe(false);
    expect(buildEvent({ headers: hdrs(), body: { ...base, event: 'compra' }, salt: 's' }).ok).toBe(false);
    expect(buildEvent({ headers: hdrs(), body: { event: 'cta_click', path: '/' }, salt: 's' }).ok).toBe(false);
    expect(buildEvent({ headers: hdrs(), body: { event: 'cta_click', path: '/', label: '<script>' }, salt: 's' }).ok).toBe(false);
    expect(isSameOrigin(hdrs({ origin: 'https://tecnofix.pro' }))).toBe(true);
  });
});

describe('acessos do site: resumo da tela Site', () => {
  const now = new Date('2026-10-19T18:00:00Z'); // 15h em São Paulo
  const range = periodRange('7', now);
  const at = (h) => new Date(now.getTime() - h * 3600000).toISOString();
  const ev = (o) => ({ event: 'page_view', path: '/', visitor: 'v1', ...o });
  const events = [
    // visita 1: WhatsApp, Bauru, celular, foi ao cadastro e clicou
    ev({ session: 's1', created_at: at(2), path: '/14dias', utm_source: 'whatsapp', utm_campaign: 'convite-14-dias', city: 'Bauru', region: 'SP', device: 'mobile' }),
    ev({ session: 's1', created_at: at(1.99), event: 'cta_click', label: 'hero-teste-gratis', utm_source: 'whatsapp' }),
    ev({ session: 's1', created_at: at(1.98), path: '/cadastro', utm_source: 'whatsapp' }),
    // visita 2: Google, computador
    ev({ session: 's2', visitor: 'v2', created_at: at(30), referrer_host: 'www.google.com', device: 'desktop', city: 'Recife', region: 'PE' }),
    ev({ session: 's2', visitor: 'v2', created_at: at(29.9), event: 'cta_click', label: 'topo-entrar' }), // não é teste grátis
    // fora do período
    ev({ session: 's3', visitor: 'v3', created_at: at(24 * 10) }),
  ];

  it('conta visitas, páginas, cliques e funil', () => {
    const r = summarize({
      events, range,
      users: [{ created_at: at(1) }, { created_at: at(24 * 30) }],
      assistances: [{ created_at: at(1) }],
      payments: [{ paid_at: at(0.5), assistance_id: 'a1' }, { paid_at: at(0.4), assistance_id: 'a1' }],
    });
    expect(r.totals).toMatchObject({ visits: 2, people: 2, pageViews: 3, ctaClicks: 1, ctaVisits: 1, signupVisits: 1, newUsers: 1, conversion: 50 });
    expect(r.funnel.map((f) => f.value)).toEqual([2, 1, 1, 1, 1]);
    expect(r.funnel[1].ofFirst).toBe(50);
    expect(r.funnel[1].ofPrev).toBe(50);
    expect(r.funnel[4].ofPrev).toBe(100);
    expect(r.origins[0]).toMatchObject({ label: 'Google', value: 1, signup: 0 });
    expect(r.origins.find((o) => o.label.startsWith('WhatsApp'))).toMatchObject({ value: 1, signup: 1 });
    expect(r.cities.map((c) => c.label).sort()).toEqual(['Bauru · SP', 'Recife · PE']);
    expect(r.devices.map((d) => d.label).sort()).toEqual(['Celular', 'Computador']);
    expect(r.recent[0]).toMatchObject({ place: 'Bauru/SP', clicked: true, pages: ['Página inicial (link do WhatsApp)', 'Cadastro'] });
  });

  it('conta quem chamou no WhatsApp e quem saiu sem clicar', () => {
    const r = summarize({
      range,
      events: [
        ev({ session: 'w1', created_at: at(3) }),
        ev({ session: 'w1', created_at: at(2.9), event: 'cta_click', label: 'hero-whatsapp' }),
        ev({ session: 'b1', visitor: 'v2', created_at: at(3) }),
        ev({ session: 'b2', visitor: 'v3', created_at: at(3) }),
        ev({ session: 'c1', visitor: 'v4', created_at: at(3) }),
        ev({ session: 'c1', visitor: 'v4', created_at: at(2.9), event: 'cta_click', label: 'barra-teste-gratis' }),
      ],
    });
    expect(r.totals).toMatchObject({ visits: 4, whatsappVisits: 1, ctaVisits: 1, bounced: 2, bounceRate: 50 });
  });

  it('visitas de fora do Brasil (robôs em data center) ficam fora dos números e aparecem à parte', () => {
    const r = summarize({
      range,
      events: [
        ev({ session: 'br1', created_at: at(5), country: 'BR', city: 'Vitória', region: 'ES', device: 'mobile' }),
        ev({ session: 'us1', visitor: 'b1', created_at: at(4), country: 'US', city: 'Council Bluffs', region: 'IA', device: 'desktop' }),
        ev({ session: 'us2', visitor: 'b2', created_at: at(3), country: 'US', city: 'Ashburn', region: 'VA', device: 'desktop' }),
        ev({ session: 'us2', visitor: 'b2', created_at: at(2.9), event: 'cta_click', label: 'hero-teste-gratis', country: 'US' }),
        ev({ session: 'tw1', visitor: 'b3', created_at: at(2), country: 'TW', city: 'Taipei', device: 'desktop' }),
        ev({ session: 'semPais', visitor: 'v9', created_at: at(1) }), // sem país (ex.: ambiente local): conta
      ],
    });
    expect(r.totals).toMatchObject({ visits: 2, people: 2, pageViews: 2, ctaClicks: 0, ctaVisits: 0 });
    expect(r.funnel[0].value).toBe(2);
    expect(r.cities.map((c) => c.label).sort()).toEqual(['Sem localização', 'Vitória · ES']);
    expect(r.cities.some((c) => /Ashburn|Council|Taipei/.test(c.label))).toBe(false);
    expect(r.foreign.visits).toBe(3);
    expect(r.foreign.events).toBe(4);
    expect(r.foreign.cities.map((c) => c.label).sort()).toEqual(['Ashburn · US', 'Council Bluffs · US', 'Taipei · TW']);
    expect(r.foreign.recent[0]).toMatchObject({ place: 'Taipei', country: 'TW', device: 'Computador' });
    expect(r.recent.every((v) => !v.country || v.country === 'BR')).toBe(true);
  });

  it('funil sem visitas registradas não mostra % sem sentido (caso real: contas antes da contagem)', () => {
    const r = summarize({ events: [], range, users: [{ created_at: at(1) }, { created_at: at(2) }], assistances: [{ created_at: at(1) }, { created_at: at(2) }] });
    expect(r.funnel.map((f) => f.value)).toEqual([0, 0, 2, 2, 0]);
    expect(r.funnel.map((f) => f.ofPrev)).toEqual([null, null, null, 100, 0]);
  });

  it('gráfico por dia tem todos os dias do período, inclusive os vazios', () => {
    const r = summarize({ events, range });
    expect(r.perDay).toHaveLength(7);
    expect(r.perDay.at(-1)).toMatchObject({ day: '2026-10-19', visits: 1 });
    expect(r.perDay.reduce((a, d) => a + d.visits, 0)).toBe(2);
    expect(r.perHour.reduce((a, b) => a + b, 0)).toBe(2);
    expect(r.perHour[13]).toBe(1); // 16h UTC = 13h em São Paulo
  });

  it('períodos começam à meia-noite de São Paulo', () => {
    expect(periodRange('hoje', now).from.toISOString()).toBe('2026-10-19T03:00:00.000Z');
    expect(daysOf(periodRange('30', now))).toHaveLength(30);
    expect(periodRange('xyz', now).key).toBe('7');
  });
});

describe('contato pelo WhatsApp', () => {
  it('monta o link com o número e a mensagem pronta', () => {
    const url = new URL(whatsappLink('Olá! Quero mais 14 dias'));
    expect(url.origin + url.pathname).toBe('https://wa.me/5511993020625');
    expect(url.searchParams.get('text')).toBe('Olá! Quero mais 14 dias');
  });
});
