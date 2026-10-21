import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Table, THead, TH, TBody, TD } from '@/components/ui/table';
import {
  listAssistances, listUsers, approvedPaymentsSince, recentAdminActions, siteEventsSince, AdminSetupError, SiteSetupError,
} from '@/features/admin/queries';
import { summarize, periodRange } from '@/features/analytics/stats';
import { fmtNum } from '@/features/analytics/components/charts';
import { situationKey, dueInfo, monthlyValue } from '@/features/admin/format';
import { SituationBadge, DueCell, OwnerContact, SetupNotice, ACTION_LABELS, actionDetail } from '@/features/admin/components/bits';
import { formatBRL } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/dates';
import { requireAdmin } from '@/features/admin/session';
import { can, homeFor } from '@/features/admin/permissions';

export const metadata = { title: 'Visão geral' };

const DAY = 86400000;

/** Primeiro dia do mês corrente no fuso de São Paulo, em ISO. */
function monthStartISO() {
  const ym = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date());
  return new Date(`${ym}-01T00:00:00-03:00`).toISOString();
}

export default async function AdminOverviewPage() {
  const session = await requireAdmin();
  if (!can(session, 'visao_geral')) redirect(homeFor(session));
  const money = can(session, 'financeiro');
  const seeAssistances = can(session, 'assistencias_ver');
  const seeSite = can(session, 'site_ver');

  let assistances, users, payments, actions;
  try {
    [assistances, users, payments, actions] = await Promise.all([
      listAssistances(), listUsers(), money ? approvedPaymentsSince(monthStartISO()) : [],
      recentAdminActions(6, session.master ? null : session.username),
    ]);
  } catch (err) {
    if (err instanceof AdminSetupError) return <><PageHeader title="Visão geral" /><SetupNotice message={err.message} /></>;
    throw err;
  }

  // Resumo do site nos últimos 7 dias (se a contagem de acessos já estiver ativa).
  let site = null;
  if (seeSite) try {
    const range = periodRange('7');
    site = summarize({ events: await siteEventsSince(range.from.toISOString()), users, assistances, range }).totals;
  } catch (err) {
    if (!(err instanceof SiteSetupError)) throw err;
  }

  const now = Date.now();
  const count = (k) => assistances.filter((a) => situationKey(a) === k).length;
  const mrr = assistances.reduce((sum, a) => sum + monthlyValue(a), 0);
  const received = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const created = (days) => assistances.filter((a) => now - new Date(a.created_at).getTime() <= days * DAY).length;
  const withoutAssistance = users.filter((u) => !u.memberships?.length).length;
  const subscribedInTrial = count('trial_subscribed');

  // Precisam de atenção: teste acabando sem assinar, pagamento pendente, teste encerrado há pouco.
  const attention = assistances
    .map((a) => ({ a, key: situationKey(a), due: dueInfo(a, now) }))
    .filter(({ key, due }) =>
      (key === 'trial' && due.days !== null && due.days <= 5)
      || key === 'grace'
      || (key === 'expired' && due.days !== null && due.days >= -14))
    .sort((x, y) => (x.due.days ?? 0) - (y.due.days ?? 0))
    .slice(0, 12);
  const newest = assistances.slice(0, 6);

  return (
    <>
      <PageHeader title="Visão geral" description={`Atualizado em ${formatDateTime(new Date())}`} />

      <section aria-labelledby="h-assist" className="mb-6">
        <h2 id="h-assist" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Assistências</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total" value={assistances.length} hint={`${created(7)} nos últimos 7 dias`} />
          <StatCard label="Em teste" value={count('trial') + subscribedInTrial} hint={subscribedInTrial ? `${subscribedInTrial} já assinaram` : 'Ainda não assinaram'} />
          <StatCard label="Pagantes" value={count('active')} tone="positive" hint="Assinatura em dia" />
          <StatCard label="Pagamento pendente" value={count('grace')} tone={count('grace') ? 'warning' : 'default'} hint="Dentro da tolerância" />
          <StatCard label="Teste encerrado" value={count('expired') + count('canceled')} hint={`${count('canceled')} cancelada(s)`} />
          <StatCard label="Suspensas" value={count('suspended')} tone={count('suspended') ? 'negative' : 'default'} hint="Bloqueadas por você" />
        </div>
      </section>

      <section aria-labelledby="h-rec" className="mb-8">
        <h2 id="h-rec" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{money ? 'Receita e crescimento' : 'Crescimento'}</h2>
        <div className={`grid grid-cols-2 gap-4 ${money ? 'md:grid-cols-4' : ''}`}>
          {money && <StatCard label="Receita mensal recorrente" value={formatBRL(mrr)} tone="positive" hint="Assinaturas pagando (anual ÷ 12)" />}
          {money && <StatCard label="Recebido no mês" value={formatBRL(received)} hint={`${payments.length} pagamento(s) aprovado(s)`} />}
          <StatCard label="Novas em 30 dias" value={created(30)} hint={`${created(7)} nos últimos 7 dias`} />
          <StatCard label="Pessoas cadastradas" value={users.length} hint={`${withoutAssistance} sem assistência`} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        {seeAssistances && <Card className="h-fit xl:col-span-2">
          <CardHeader title="Precisam de atenção" description="Teste acabando sem assinar, pagamento pendente e testes encerrados nos últimos 14 dias." />
          {attention.length ? (
            <>
              <ul className="divide-y divide-slate-100 md:hidden">
                {attention.map(({ a }) => (
                  <li key={a.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/admin/assistencias/${a.id}`} className="font-medium text-slate-900 hover:text-brand-700">{a.name}</Link>
                      <SituationBadge assistance={a} />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">{a.owner_name || a.owner_email}</span>
                      <DueCell assistance={a} compact />
                    </div>
                    <OwnerContact assistance={a} message={`Olá, ${(a.owner_name || '').split(' ')[0]}! Aqui é do TecnoFix.`} />
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <Table>
                  <THead><tr><TH>Assistência</TH><TH>Situação</TH><TH>Vencimento</TH><TH>Contato</TH></tr></THead>
                  <TBody>
                    {attention.map(({ a }) => (
                      <tr key={a.id}>
                        <TD>
                          <Link href={`/admin/assistencias/${a.id}`} className="font-medium text-slate-900 hover:text-brand-700">{a.name}</Link>
                          <p className="text-xs text-slate-500">{a.owner_name || '—'} · {a.orders_30d} OS em 30 dias</p>
                        </TD>
                        <TD><SituationBadge assistance={a} /></TD>
                        <TD><DueCell assistance={a} /></TD>
                        <TD><OwnerContact assistance={a} message={`Olá, ${(a.owner_name || '').split(' ')[0]}! Aqui é do TecnoFix.`} /></TD>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            </>
          ) : <CardContent className="text-sm text-slate-500">Nada pendente agora.</CardContent>}
        </Card>}

        <div className={`space-y-6 ${seeAssistances ? '' : 'xl:col-span-3 xl:grid xl:grid-cols-3 xl:gap-6 xl:space-y-0'}`}>
          {seeSite && <Card>
            <CardHeader title="Site · últimos 7 dias" actions={<Link href="/admin/site" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">Ver acessos <ArrowRight className="size-4" aria-hidden="true" /></Link>} />
            {site ? (
              <dl className="grid grid-cols-3 divide-x divide-slate-100 text-center">
                {[['Visitas', site.visits], ['Clicaram em teste', site.ctaVisits], ['Novas contas', site.newUsers]].map(([k, v]) => (
                  <div key={k} className="px-2 py-4">
                    <dt className="text-xs text-slate-500">{k}</dt>
                    <dd className="tabular mt-1 text-xl font-semibold text-slate-900">{fmtNum(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : <CardContent className="text-sm text-slate-500">Contagem de acessos ainda não ativada (migration 0016).</CardContent>}
          </Card>}

          {seeAssistances && <Card>
            <CardHeader title="Últimas assistências" actions={<Link href="/admin/assistencias" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">Todas <ArrowRight className="size-4" aria-hidden="true" /></Link>} />
            <ul className="divide-y divide-slate-100">
              {newest.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/assistencias/${a.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{a.name}</span>
                      <span className="block text-xs text-slate-500">criada em {formatDate(a.created_at)} · {a.orders} OS</span>
                    </span>
                    <SituationBadge assistance={a} />
                  </Link>
                </li>
              ))}
              {!newest.length && <li className="px-5 py-3 text-sm text-slate-500">Nenhuma assistência ainda.</li>}
            </ul>
          </Card>}

          <Card>
            <CardHeader title={session.master ? 'Últimas ações na área admin' : 'Suas últimas ações'} />
            <ul className="divide-y divide-slate-100 text-sm">
              {actions.map((r) => (
                <li key={r.id} className="px-5 py-2.5">
                  <p className="text-slate-900">
                    {ACTION_LABELS[r.action] || r.action}
                    {r.assistance_id && seeAssistances && <> · <Link href={`/admin/assistencias/${r.assistance_id}`} className="text-brand-700 hover:underline">abrir</Link></>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(r.created_at)}{session.master && ` · ${r.admin_username}`}{actionDetail(r) && ` · ${actionDetail(r)}`}
                  </p>
                </li>
              ))}
              {!actions.length && <li className="px-5 py-3 text-slate-500">Nenhuma ação ainda.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
