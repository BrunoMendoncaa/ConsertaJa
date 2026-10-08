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
