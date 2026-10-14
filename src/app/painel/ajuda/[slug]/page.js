import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Lightbulb, ChevronRight } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { GUIDES, HELP_CATEGORIES, getGuide } from '@/features/help/guides';
import { GuideMedia } from '@/features/help/components/guide-media';
import { RichText } from '@/features/help/components/rich-text';
import { ROLES, ALL_ROLES } from '@/lib/constants';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const guide = GUIDES.find((g) => g.slug === slug);
  return { title: guide ? guide.title : 'Como usar' };
}

function GuideTable({ table }) {
  const [first, ...rest] = table.columns;
  const head = (cell) => (table.statusColumn ? <StatusBadge status={cell} /> : <RichText text={cell} />);
  return (
    <Card>
      <CardHeader title={table.title} />
      {/* Celular: um cartão por linha */}
      <ul className="divide-y divide-slate-100 sm:hidden">
        {table.rows.map((row) => (
          <li key={row[0]} className="px-5 py-3 text-sm">
            <p className="font-semibold text-slate-900">{head(row[0])}</p>
            {row.slice(1).map((cell, i) => (
              <p key={rest[i]} className="mt-1 text-slate-600"><span className="text-slate-500">{rest[i]}: </span><RichText text={cell} /></p>
            ))}
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-medium">{first}</th>
              {rest.map((c) => <th key={c} scope="col" className="px-5 py-2.5 font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.rows.map((row) => (
              <tr key={row[0]} className="align-top">
                <th scope="row" className="whitespace-nowrap px-5 py-3 font-semibold text-slate-900">{head(row[0])}</th>
                {row.slice(1).map((cell, i) => <td key={rest[i]} className="px-5 py-3 text-slate-600"><RichText text={cell} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default async function GuidePage({ params }) {
  const { slug } = await params;
  const { role } = await requireStaff();
  const guide = getGuide(slug, role);
  if (!guide) notFound();

  const category = HELP_CATEGORIES.find((c) => c.id === guide.category);
  const related = (guide.related || []).map((s) => getGuide(s, role)).filter(Boolean);
  const everyone = ALL_ROLES.every((r) => guide.roles.includes(r));

  return (
    <>
      <PageHeader
        title={guide.title}
        description={guide.summary}
        back={{ href: '/painel/ajuda', label: 'Como usar' }}
        actions={guide.screen && (
          <ButtonLink href={guide.screen.href} variant="outline">
            {guide.screen.label} <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <GuideMedia media={guide.media} />

          <Card>
            <CardHeader title="Passo a passo" />
            <CardContent>
              <ol className="space-y-5">
                {guide.steps.map((st, i) => (
                  <li key={st.title} className="flex gap-4">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 ring-1 ring-brand-200" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{st.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600"><RichText text={st.text} /></p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {guide.table && <GuideTable table={guide.table} />}

          {guide.tips?.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-5 py-4">
              <p className="flex items-center gap-2 font-semibold text-amber-900">
                <Lightbulb className="size-4" aria-hidden="true" /> Dicas
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-amber-900/90 marker:text-amber-400">
                {guide.tips.map((t) => <li key={t}><RichText text={t} /></li>)}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Quem usa" />
            <CardContent className="flex flex-wrap gap-2">
              {everyone
                ? <Badge tone="emerald">Toda a equipe</Badge>
                : guide.roles.map((r) => <Badge key={r} tone="indigo">{ROLES[r]}</Badge>)}
            </CardContent>
          </Card>

          {related.length > 0 && (
            <Card>
              <CardHeader title="Veja também" />
              <ul className="divide-y divide-slate-100">
                {related.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/painel/ajuda/${g.slug}`} className="group flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900 group-hover:text-brand-700">{g.title}</span>
                        <span className="block text-slate-500">{g.summary}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {category && (
            <Link href="/painel/ajuda" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              Ver todos os guias
            </Link>
          )}
        </aside>
      </div>
    </>
  );
}
