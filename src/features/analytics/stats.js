import { originOf } from './sources';
import { PAGE_LABELS, CTA_LABELS, SIGNUP_CTAS, WHATSAPP_CTAS } from './constants';

// Números da tela "Site" (área admin) a partir dos eventos gravados em site_events.
// Funções puras: recebem as linhas e devolvem o resumo (testado em tests/analytics.test.js).

const TZ = 'America/Sao_Paulo';
const DAY = 86400000;

export const PERIODS = [
  ['hoje', 'Hoje', 1],
  ['7', '7 dias', 7],
  ['30', '30 dias', 30],
  ['90', '90 dias', 90],
];

const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const hourOf = (d) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d));

/** Início do período (meia-noite em São Paulo, que não tem horário de verão desde 2019). */
export function periodRange(key, now = new Date()) {
  const p = PERIODS.find(([k]) => k === key) || PERIODS[1];
  const today = ymd(now);
  const start = new Date(new Date(`${today}T00:00:00-03:00`).getTime() - (p[2] - 1) * DAY);
  return { key: p[0], label: p[1], days: p[2], from: start, to: now };
}

/** Lista de dias (AAAA-MM-DD) do período, em ordem. */
export function daysOf(range) {
  const out = [];
  for (let i = 0; i < range.days; i++) out.push(ymd(new Date(range.from.getTime() + i * DAY + 3 * 3600000)));
  return out;
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, n);

/**
 * events: linhas de site_events (created_at, event, path, label, visitor, session, ...)
 * users / assistances: listas da área admin (com created_at); payments: pagamentos aprovados (paid_at, assistance_id)
 */
export function summarize({ events = [], users = [], assistances = [], payments = [], range }) {
  const inRange = (iso) => {
    const t = new Date(iso).getTime();
    return t >= range.from.getTime() && t <= range.to.getTime();
  };
  let evs = events.filter((e) => inRange(e.created_at)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Visita = sessão da aba (código aleatório). Sem ele, cai no visitante do dia.
  const sessions = new Map();
  for (const e of evs) {
    const key = e.session || `v:${e.visitor}`;
    let s = sessions.get(key);
    if (!s) {
      s = { key, first: e, start: e.created_at, last: e.created_at, pages: [], clicks: [], views: 0 };
      sessions.set(key, s);
    }
    s.last = e.created_at;
    if (e.event === 'page_view') {
      s.views += 1;
      if (s.pages[s.pages.length - 1] !== e.path) s.pages.push(e.path);
    } else if (e.event === 'cta_click') {
      s.clicks.push(e.label);
    }
  }
  // Visita de fora do Brasil: quase sempre robô em data center (Google, Amazon, Facebook conferindo
  // links) que abre a página num navegador de verdade. Fica fora dos números e aparece à parte.
  const isForeign = (s) => Boolean(s.first.country) && String(s.first.country).toUpperCase() !== 'BR';
  const allVisits = [...sessions.values()].filter((s) => s.views > 0);
  const foreign = allVisits.filter(isForeign);
  const visits = allVisits.filter((s) => !isForeign(s));
  const foreignKeys = new Set([...sessions.values()].filter(isForeign).map((s) => s.key));
  const evsAll = evs;
  evs = evs.filter((e) => !foreignKeys.has(e.session || `v:${e.visitor}`));
  const reachedSignup = (s) => s.pages.includes('/cadastro');

  const days = daysOf(range);
  const perDayMap = new Map(days.map((d) => [d, { visits: 0, pageViews: 0 }]));
  for (const s of visits) {
    const d = perDayMap.get(ymd(new Date(s.start)));
    if (d) d.visits += 1;
  }
  for (const e of evs) {
    if (e.event !== 'page_view') continue;
    const d = perDayMap.get(ymd(new Date(e.created_at)));
    if (d) d.pageViews += 1;
  }

  const perHour = Array.from({ length: 24 }, () => 0);
  for (const s of visits) perHour[hourOf(new Date(s.start))] += 1;

  const origins = new Map();
  const cities = new Map();
  const devices = new Map();
  for (const s of visits) {
    const o = originOf(s.first);
    const cur = origins.get(o) || { visits: 0, signup: 0 };
    cur.visits += 1;
    if (reachedSignup(s)) cur.signup += 1;
    origins.set(o, cur);
    const place = s.first.city ? `${s.first.city}${s.first.region ? ` · ${s.first.region}` : ''}` : 'Sem localização';
    cities.set(place, (cities.get(place) || 0) + 1);
    const dev = { mobile: 'Celular', tablet: 'Tablet', desktop: 'Computador' }[s.first.device] || 'Outro';
    devices.set(dev, (devices.get(dev) || 0) + 1);
  }

  const pages = new Map();
  for (const e of evs) if (e.event === 'page_view') pages.set(e.path, (pages.get(e.path) || 0) + 1);
  const ctas = new Map();
  for (const e of evs) if (e.event === 'cta_click') ctas.set(e.label, (ctas.get(e.label) || 0) + 1);

  const foreignCities = new Map();
  for (const s of foreign) {
    const place = s.first.city ? `${s.first.city} · ${s.first.country}` : s.first.country;
    foreignCities.set(place, (foreignCities.get(place) || 0) + 1);
  }

  const newUsers = users.filter((u) => inRange(u.created_at)).length;
  const newAssistances = assistances.filter((a) => inRange(a.created_at)).length;
  const paying = new Set(payments.filter((p) => inRange(p.paid_at)).map((p) => p.assistance_id)).size;
  const signupVisits = visits.filter(reachedSignup).length;

  const funnel = [
    { label: 'Visitas no site', value: visits.length },
    { label: 'Abriram o cadastro', value: signupVisits },
    { label: 'Criaram conta', value: newUsers },
    { label: 'Criaram a assistência', value: newAssistances },
    { label: 'Assinaram', value: paying },
  ].map((step, i, all) => {
    const prev = i ? all[i - 1].value : null;
    // % da etapa anterior só quando faz sentido: etapa anterior com gente e sem passar de 100%
    // (contas criadas antes de a contagem começar podem superar as visitas registradas).
    return { ...step, ofFirst: pct(step.value, all[0].value), ofPrev: i && prev > 0 && step.value <= prev ? pct(step.value, prev) : null };
  });

  return {
    totals: {
      visits: visits.length,
      people: new Set(evs.map((e) => e.visitor)).size,
      pageViews: evs.filter((e) => e.event === 'page_view').length,
      ctaClicks: evs.filter((e) => e.event === 'cta_click' && SIGNUP_CTAS.includes(e.label)).length,
      ctaVisits: visits.filter((s) => s.clicks.some((l) => SIGNUP_CTAS.includes(l))).length,
      // Chamaram no WhatsApp para tirar dúvida (também é lead).
      whatsappVisits: visits.filter((s) => s.clicks.some((l) => WHATSAPP_CTAS.includes(l))).length,
      // Saíram sem clicar em nada e sem abrir outra página do site.
      bounced: visits.filter((s) => !s.clicks.length && s.pages.length === 1).length,
      bounceRate: pct(visits.filter((s) => !s.clicks.length && s.pages.length === 1).length, visits.length),
      signupVisits,
      newUsers,
      conversion: pct(newUsers, visits.length),
    },
    perDay: days.map((d) => ({ day: d, ...perDayMap.get(d) })),
    perHour,
    origins: top(new Map([...origins].map(([k, v]) => [k, v.visits])), 8)
      .map(([label, value]) => ({ label, value, signup: origins.get(label).signup })),
    cities: top(cities, 8).map(([label, value]) => ({ label, value })),
    devices: top(devices, 4).map(([label, value]) => ({ label, value })),
    pages: top(pages, 6).map(([path, value]) => ({ label: PAGE_LABELS[path] || path, path, value })),
    ctas: top(ctas, 6).map(([key, value]) => ({ label: CTA_LABELS[key] || key, value })),
    funnel,
    recent: visits.slice(-15).reverse().map(visitRow),
    foreign: {
      visits: foreign.length,
      events: evsAll.length - evs.length,
      cities: top(foreignCities, 8).map(([label, value]) => ({ label, value })),
      recent: foreign.slice(-30).reverse().map(visitRow),
    },
  };
}

function visitRow(s) {
  return {
    key: s.key,
    start: s.start,
    origin: originOf(s.first),
    place: s.first.city ? `${s.first.city}${s.first.region ? `/${s.first.region}` : ''}` : null,
    country: s.first.country || null,
    device: { mobile: 'Celular', tablet: 'Tablet', desktop: 'Computador' }[s.first.device] || 'Outro',
    browser: s.first.browser,
    pages: s.pages.map((p) => PAGE_LABELS[p] || p),
    clicked: s.clicks.some((l) => SIGNUP_CTAS.includes(l)),
  };
}
