import Link from 'next/link';
import { cn } from '@/lib/cn';

const OPTIONS = [['hoje', 'Hoje'], ['semana', '7 dias'], ['mes', 'Este mês']];

/** Filtro de período por URL (?periodo=hoje|semana|mes|personalizado&de=&ate=). */
export function PeriodFilter({ period, basePath = '' }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {OPTIONS.map(([key, label]) => (
        <Link key={key} href={`${basePath}?periodo=${key}`}
          className={cn('rounded-full px-3 py-1.5 text-sm',
            period.key === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>
          {label}
        </Link>
      ))}
      <form className="flex flex-wrap items-center gap-1.5" action={basePath || undefined}>
        <input type="hidden" name="periodo" value="personalizado" />
        <input type="date" name="de" defaultValue={period.from} aria-label="De"
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm" />
        <span className="text-sm text-slate-400">até</span>
        <input type="date" name="ate" defaultValue={period.to} aria-label="Até"
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm" />
        <button className={cn('h-8 rounded-lg px-3 text-sm',
          period.key === 'personalizado' ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50')}>
          Aplicar
        </button>
      </form>
    </div>
  );
}
