'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search, X, ChevronRight, ChevronDown, CirclePlay, Rocket, ClipboardList, Users, Wallet, UserCog, CircleHelp,
} from 'lucide-react';
import { matchesSearch } from '@/features/help/text';
import { RichText } from './rich-text';

const CATEGORY_ICONS = { rocket: Rocket, os: ClipboardList, customers: Users, cash: Wallet, users: UserCog };

function GuideCard({ guide }) {
  return (
    <Link
      href={`/painel/ajuda/${guide.slug}`}
      className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="font-semibold text-slate-900 group-hover:text-brand-700">{guide.title}</span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-slate-400 group-hover:text-brand-600" aria-hidden="true" />
      </span>
      <span className="mt-1 text-sm text-slate-600">{guide.summary}</span>
      {guide.hasVideo && (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
          <CirclePlay className="size-3.5" aria-hidden="true" /> Com vídeo
        </span>
      )}
    </Link>
  );
}

function FaqItem({ item }) {
  return (
    <details className="group rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
        {item.q}
        <ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <p className="px-4 pb-4 text-sm leading-relaxed text-slate-600"><RichText text={item.a} /></p>
    </details>
  );
}

/** Índice da central de ajuda: busca, guias por categoria e perguntas frequentes. */
export function HelpBrowser({ categories, faq }) {
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;

  const results = useMemo(() => {
    if (!searching) return null;
    const guides = categories.flatMap((c) => c.guides).filter((g) => matchesSearch(g.search, query));
    const questions = faq.filter((f) => matchesSearch(f.search, query));
    return { guides, questions };
  }, [categories, faq, query, searching]);

  return (
    <div className="space-y-8">
      <div className="relative max-w-xl">
        <label htmlFor="busca-ajuda" className="sr-only">Buscar nos guias</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          id="busca-ajuda"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar: orçamento, garantia, senha, caixa…"
          autoComplete="off"
          className="block h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 [&::-webkit-search-cancel-button]:hidden"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {searching ? (
        <section aria-live="polite">
          {results.guides.length + results.questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <CircleHelp className="mx-auto size-8 text-slate-300" aria-hidden="true" />
              <p className="mt-3 font-medium text-slate-900">Nada encontrado para “{query.trim()}”.</p>
              <p className="mt-1 text-sm text-slate-500">Tente outra palavra, como orçamento, entrega, foto ou pagamento.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-slate-500">
                {results.guides.length + results.questions.length} resultado(s) para “{query.trim()}”
              </p>
              {results.guides.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {results.guides.map((g) => <GuideCard key={g.slug} guide={g} />)}
                </div>
              )}
              {results.questions.length > 0 && (
                <div className="max-w-3xl space-y-2">
                  {results.questions.map((f) => <FaqItem key={f.q} item={f} />)}
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <>
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.icon] || CircleHelp;
            return (
              <section key={c.id} aria-labelledby={`cat-${c.id}`}>
                <h2 id={`cat-${c.id}`} className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  {c.title}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {c.guides.map((g) => <GuideCard key={g.slug} guide={g} />)}
                </div>
              </section>
            );
          })}

          {faq.length > 0 && (
            <section aria-labelledby="faq">
              <h2 id="faq" className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <span className="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <CircleHelp className="size-4" aria-hidden="true" />
                </span>
                Perguntas frequentes
              </h2>
              <div className="max-w-3xl space-y-2">
                {faq.map((f) => <FaqItem key={f.q} item={f} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
