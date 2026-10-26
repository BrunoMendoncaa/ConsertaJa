import 'server-only';
import { can, canApp } from './permissions';
import { listAssistances, siteEventsSince, AdminSetupError, SiteSetupError } from './queries';
import { situationKey, monthlyValue } from './format';
import { summarize, periodRange } from '@/features/analytics/stats';
import { formatBRL } from '@/lib/money';

const DAY = 86400000;

/**
 * Números de cada aplicação na tela inicial da central. Cada um devolve
 * { stats: [{ label, value, hint?, tone? }], note? } só com o que a conta pode ver.
 * Aplicação em outro sistema: o resumo pode buscar uma API dela (com uma chave no .env).
 */
const LOADERS = {
  async tecnofix(session) {
    const seeNumbers = can(session, 'visao_geral') || can(session, 'assistencias_ver');
    const seeSite = can(session, 'site_ver');
    if (!seeNumbers && !seeSite) return { stats: [], note: 'Sua conta não vê os números desta aplicação.' };

    const range = periodRange('7');
    const [assistances, events] = await Promise.all([
      seeNumbers ? listAssistances() : [],
      seeSite ? siteEventsSince(range.from.toISOString()).catch((err) => { if (err instanceof SiteSetupError) return null; throw err; }) : null,
    ]);

    const stats = [];
    if (seeNumbers) {
      const keys = assistances.map(situationKey);
      const count = (...k) => keys.filter((x) => k.includes(x)).length;
      const now = Date.now();
      const created7 = assistances.filter((a) => now - new Date(a.created_at).getTime() <= 7 * DAY).length;
      stats.push({ label: 'Assistências', value: assistances.length, hint: `${created7} novas em 7 dias` });
      stats.push({ label: 'Pro pagantes', value: count('active'), tone: 'positive', hint: count('grace') ? `${count('grace')} com pagamento pendente` : 'Assinatura em dia' });
      stats.push({ label: 'Pro grátis (teste)', value: count('trial', 'trial_subscribed'), hint: 'Nos 14 dias de Pro' });
      stats.push({ label: 'Plano Grátis', value: count('expired', 'canceled') });
      if (can(session, 'financeiro')) {
        const mrr = assistances.reduce((sum, a) => sum + monthlyValue(a), 0);
        stats.push({ label: 'Receita mensal', value: formatBRL(mrr), tone: 'positive', hint: 'Assinaturas pagando' });
      }
    }
    if (seeSite && events) {
      const totals = summarize({ events, range }).totals;
      stats.push({ label: 'Visitas no site', value: totals.visits, hint: 'Últimos 7 dias' });
    }
    return { stats };
  },
};

/** Resumo de uma aplicação para a conta (null se ela não entra na aplicação). */
export async function appSummary(session, appKey) {
  if (!canApp(session, appKey)) return null;
  const load = LOADERS[appKey];
  if (!load) return { stats: [], note: 'Os números desta aplicação ainda não estão ligados à central.' };
  try {
    return await load(session);
  } catch (err) {
    if (err instanceof AdminSetupError) return { stats: [], note: err.message };
    throw err;
  }
}
