import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Alert } from '@/components/ui/alert';
import { Table, THead, TH, TBody, TD } from '@/components/ui/table';
import {
  listAssistances, listUsers, approvedPaymentsSince, siteEventsSince, AdminSetupError, SiteSetupError,
} from '@/features/admin/queries';
import { SetupNotice } from '@/features/admin/components/bits';
import { summarize, periodRange, PERIODS } from '@/features/analytics/stats';
import { ColumnChart, BarList, Funnel, fmtNum } from '@/features/analytics/components/charts';
import { NoTrackToggle } from '@/features/analytics/components/no-track-toggle';
import { formatDateTime } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { requireAdmin } from '@/features/admin/session';

export const metadata = { title: 'Site' };

const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dayTick = (ymd) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const dayName = (ymd) => WEEKDAY[new Date(`${ymd}T12:00:00-03:00`).getUTCDay()];
const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;

export default async function AdminSitePage({ searchParams }) {
  await requireAdmin('site_ver');
  const sp = await searchParams;
  const range = periodRange(typeof sp?.periodo === 'string' ? sp.periodo : '7');

  let events, users, assistances, payments;
  try {
    [events, users, assistances, payments] = await Promise.all([
      siteEventsSince(range.from.toISOString()), listUsers(), listAssistances(), approvedPaymentsSince(range.from.toISOString()),
    ]);
  } catch (err) {
    if (err instanceof SiteSetupError) {
      return (
        <>
          <PageHeader title="Site" />
          <Alert variant="warning" title="Falta ativar a contagem de acessos">
            {err.message} Abra o SQL Editor do Supabase, cole o arquivo
            <code className="mx-1 font-mono text-xs">supabase/migrations/20261019120000_acessos_site.sql</code>
            e clique em Run. A contagem começa a partir daí.
          </Alert>
        </>
      );
    }
    if (err instanceof AdminSetupError) return <><PageHeader title="Site" /><SetupNotice message={err.message} /></>;
    throw err;
  }

  const r = summarize({ events, users, assistances, payments, range });
  const t = r.totals;
  const today = range.days === 1;

  const dayData = r.perDay.map((d) => ({
    key: d.day, tick: dayTick(d.day), value: d.visits,
    tip: `${dayName(d.day)}, ${dayTick(d.day)}: ${plural(d.visits, 'visita', 'visitas')} · ${plural(d.pageViews, 'página', 'páginas')}`,
  }));
  const hourData = r.perHour.map((v, h) => ({ key: h, tick: `${h}h`, value: v, tip: `${h}h às ${h}h59: ${plural(v, 'visita', 'visitas')}` }));

  return (
    <>
      <PageHeader
        title="Site"
        description="Visitas da página inicial e do cadastro (tecnofix.pro)"
        actions={(
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período">
            {PERIODS.map(([k, label]) => (
              <Link key={k} href={`?periodo=${k}`} aria-current={k === range.key ? 'page' : undefined}
                className={cn('rounded-full px-3 py-1.5 text-sm', k === range.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>
                {label}
              </Link>
            ))}
          </div>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Visitas" value={fmtNum(t.visits)} hint={t.visits ? `${t.bounceRate.toLocaleString('pt-BR')}% saíram sem clicar em nada` : plural(t.pageViews, 'página vista', 'páginas vistas')} />
        <StatCard label="Visitantes" value={fmtNum(t.people)} hint="Pessoas diferentes, contadas por dia" />
        <StatCard label="Clicaram em teste grátis" value={fmtNum(t.ctaVisits)} hint={`${plural(t.ctaClicks, 'clique', 'cliques')} · ${fmtNum(t.whatsappVisits)} no WhatsApp`} />
        <StatCard label="Abriram o cadastro" value={fmtNum(t.signupVisits)} hint={t.visits ? `${Math.round((t.signupVisits / t.visits) * 100)}% das visitas` : '—'} />
        <StatCard label="Novas contas" value={fmtNum(t.newUsers)} tone={t.newUsers ? 'positive' : 'default'} hint="Criadas no período" />
        <StatCard label="Conversão" value={`${t.conversion.toLocaleString('pt-BR')}%`} hint="Novas contas ÷ visitas" />
      </div>

      {r.foreign.visits > 0 && (
        <p className="-mt-2 mb-6 text-sm text-slate-500">
          {plural(r.foreign.visits, 'visita de fora do Brasil não entra', 'visitas de fora do Brasil não entram')} nos números (prováveis robôs).{' '}
          <a href="#fora-do-brasil" className="font-medium text-brand-700 hover:underline">Ver quais</a>
        </p>
      )}

      <Card className="mb-6">
        <CardHeader
          title={today ? 'Visitas hoje, por hora' : `Visitas por dia · ${range.label}`}
          description="Passe o mouse (ou toque) nas colunas para ver os números."
        />
        <CardContent>
          {today
            ? <ColumnChart data={hourData} label="Visitas por hora hoje" tickEvery={3} />
            : <ColumnChart data={dayData} label={`Visitas por dia, ${range.label}`} tickEvery={range.days > 31 ? 14 : range.days > 7 ? 5 : 1} />}
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Ver em tabela</summary>
            <div className="mt-2 max-h-72 overflow-auto">
              <Table>
                <THead><tr><TH>{today ? 'Hora' : 'Dia'}</TH><TH className="text-right">Visitas</TH>{!today && <TH className="text-right">Páginas vistas</TH>}</tr></THead>
                <TBody>
                  {today
                    ? r.perHour.map((v, h) => <tr key={h}><TD>{h}h</TD><TD className="tabular text-right">{fmtNum(v)}</TD></tr>)
                    : [...r.perDay].reverse().map((d) => (
                      <tr key={d.day}><TD>{dayName(d.day)}, {dayTick(d.day)}</TD><TD className="tabular text-right">{fmtNum(d.visits)}</TD><TD className="tabular text-right">{fmtNum(d.pageViews)}</TD></tr>
                    ))}
                </TBody>
              </Table>
            </div>
          </details>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Do clique à assinatura" description="Visitas e cadastros no período. Contas e assinaturas vêm do sistema." />
          <CardContent>
            <Funnel steps={r.funnel} />
            {r.funnel[2].value > r.funnel[1].value && (
              <p className="mt-4 text-xs text-slate-500">
                Há contas criadas sem visita registrada ao cadastro: antes de a contagem começar, em navegador marcado
                para não contar ou por convite de equipe.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="De onde vieram" description="Origem da visita e quantas chegaram ao cadastro." />
          <CardContent>
            <BarList items={r.origins.map((o) => ({ label: o.label, value: o.value, extra: o.signup }))} extraLabel="no cadastro" />
            <p className="mt-4 text-xs text-slate-500">
              Links de campanha: tecnofix.pro/gratis (mensagem nova do WhatsApp), tecnofix.pro/14dias (mensagem antiga),
              tecnofix.pro/anuncio (anúncio pago) e tecnofix.pro/grupos (posts em grupos). Cada um aparece aqui com o próprio nome.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Cidades" />
          <CardContent><BarList items={r.cities} /></CardContent>
        </Card>
        <Card>
          <CardHeader title="Aparelho" />
          <CardContent><BarList items={r.devices} /></CardContent>
        </Card>
        <Card>
          <CardHeader title="Botões clicados" />
          <CardContent><BarList items={r.ctas} empty="Nenhum clique nos botões no período." /></CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        {!today && (
          <Card className="lg:col-span-2">
            <CardHeader title="Horário das visitas" description="Soma do período, por hora do dia (horário de Brasília). Ajuda a escolher a hora de mandar mensagens." />
            <CardContent><ColumnChart data={hourData} label="Visitas por hora do dia" tickEvery={3} height="h-32" /></CardContent>
          </Card>
        )}
        <Card className={today ? 'lg:col-span-3' : ''}>
          <CardHeader title="Páginas" />
          <CardContent><BarList items={r.pages} /></CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Últimas visitas" description="As 15 mais recentes do período." />
        {r.recent.length ? (
          <>
          <ul className="divide-y divide-slate-100 md:hidden">
            {r.recent.map((v) => (
              <li key={v.key} className="px-5 py-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-slate-900">{v.origin}</span>
                  {v.clicked && <span className="shrink-0 text-xs font-medium text-emerald-700">clicou</span>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDateTime(v.start)} · {v.place || 'sem cidade'} · {v.device} ({v.browser})
                </p>
                <p className="mt-0.5 text-xs text-slate-600">{v.pages.join(' → ')}</p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <THead><tr><TH>Quando</TH><TH>Origem</TH><TH>Cidade</TH><TH>Aparelho</TH><TH>Páginas</TH><TH>Clicou</TH></tr></THead>
              <TBody>
                {r.recent.map((v) => (
                  <tr key={v.key} className="align-top">
                    <TD className="whitespace-nowrap">{formatDateTime(v.start)}</TD>
                    <TD>{v.origin}</TD>
                    <TD>{v.place || <span className="text-slate-400">—</span>}</TD>
                    <TD className="whitespace-nowrap">{v.device}<span className="block text-xs text-slate-500">{v.browser}</span></TD>
                    <TD className="text-xs text-slate-600">{v.pages.join(' → ')}</TD>
                    <TD>{v.clicked ? 'Sim' : <span className="text-slate-400">Não</span>}</TD>
                  </tr>
                ))}
              </TBody>
            </Table>
          </div>
          </>
        ) : <CardContent className="text-sm text-slate-500">Nenhuma visita no período ainda.</CardContent>}
      </Card>

      <Card id="fora-do-brasil" className="mb-6 scroll-mt-24">
        <CardHeader
          title="Fora do Brasil (prováveis robôs)"
          description="Não entram nos números acima. Quase sempre são servidores do Google, Amazon, Facebook e outros abrindo a página para conferir o link; quem usa VPN também pode aparecer aqui."
        />
        {r.foreign.visits ? (
          <CardContent className="space-y-4">
            <BarList items={r.foreign.cities} />
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Ver as {plural(r.foreign.visits, 'visita', 'visitas')}</summary>
              <div className="mt-2 max-h-80 overflow-auto">
                <Table>
                  <THead><tr><TH>Quando</TH><TH>Cidade</TH><TH>Aparelho</TH><TH>Origem</TH></tr></THead>
                  <TBody>
                    {r.foreign.recent.map((v) => (
                      <tr key={v.key}>
                        <TD className="whitespace-nowrap">{formatDateTime(v.start)}</TD>
                        <TD>{v.place || '—'}{v.country && <span className="ml-1 text-xs text-slate-500">({v.country})</span>}</TD>
                        <TD className="whitespace-nowrap">{v.device} <span className="text-xs text-slate-500">{v.browser}</span></TD>
                        <TD className="text-xs text-slate-600">{v.origin}</TD>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            </details>
          </CardContent>
        ) : <CardContent className="text-sm text-slate-500">Nenhuma no período.</CardContent>}
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <NoTrackToggle />
          <p className="text-xs leading-relaxed text-slate-500">
            Como é contado: só a página inicial, o cadastro e o entrar. Sem cookies e sem guardar IP: cada visitante vira um
            código que muda todo dia, e a localização é aproximada (cidade). Robôs e a prévia de link do WhatsApp não contam, e visitas de fora do Brasil ficam à parte.
            Os dados ficam 13 meses.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
