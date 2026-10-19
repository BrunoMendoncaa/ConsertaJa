const TZ = 'America/Sao_Paulo';

const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** Datas "YYYY-MM-DD" (sem hora) não podem passar por new Date() sem cuidado com fuso. */
function toDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00-03:00`);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value) {
  const d = toDate(value);
  return d ? dateFmt.format(d) : '—';
}

export function formatDateTime(value) {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : '—';
}

/** Hoje no fuso de São Paulo, como "YYYY-MM-DD". */
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

// Tudo em horário de Brasília, mesmo com o servidor em UTC (a Vercel roda em UTC e não deixa trocar o TZ).
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

/** Dia de calendário em Brasília de uma data/hora, como "YYYY-MM-DD". */
export function dayBR(value) {
  const d = toDate(value);
  return d ? ymdFmt.format(d) : null;
}

/** "08:26" em Brasília. */
export function formatTime(value) {
  const d = toDate(value);
  return d ? timeFmt.format(d) : '—';
}

/**
 * Dias de calendário (Brasília) de hoje até a data: 0 = hoje, 1 = amanhã, -1 = ontem.
 * Conta pela data e não por blocos de 24 horas: algo que vence amanhã às 10h é "amanhã",
 * mesmo visto hoje às 22h.
 */
export function daysFromToday(value, now = new Date()) {
  const a = dayBR(value);
  const b = dayBR(now);
  if (!a || !b) return null;
  const utc = (s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((utc(a) - utc(b)) / 86400000);
}

/** Soma dias corridos a uma data/hora (24h cada; Brasília não tem horário de verão desde 2019). */
export function addDaysISO(value, days) {
  const d = toDate(value);
  return d ? new Date(d.getTime() + days * 86400000).toISOString() : null;
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Converte o filtro de período (?periodo=hoje|semana|mes|personalizado&de=&ate=)
 * em datas inclusivas { from, to, key }.
 */
export function resolvePeriod(searchParams = {}) {
  const today = todayISO();
  const key = searchParams.periodo || 'mes';
  if (key === 'hoje') return { key, from: today, to: today };
  if (key === 'semana') return { key, from: addDays(today, -6), to: today };
  if (key === 'personalizado') {
    const valid = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
    let from = valid(searchParams.de) ? searchParams.de : addDays(today, -29);
    let to = valid(searchParams.ate) ? searchParams.ate : today;
    if (from > to) [from, to] = [to, from];
    return { key, from, to };
  }
  return { key: 'mes', from: `${today.slice(0, 7)}-01`, to: today };
}

/** "2026-10-08" → "08/10" */
export function shortDay(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
