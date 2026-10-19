import { cn } from '@/lib/cn';

// Gráficos simples em HTML (sem biblioteca): colunas por dia/hora e barras horizontais.
// Uma cor só (azul da marca), números em cinza/preto, dica ao passar o mouse e tabela opcional.

const nf = new Intl.NumberFormat('pt-BR');
export const fmtNum = (n) => nf.format(n || 0);

/** Teto "redondo" para o eixo (1, 2, 5, 10, 20, 50...). */
export function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

/**
 * Colunas. data: [{ key, tick, value, tip }]. tick = rótulo do eixo (mostrado de N em N).
 * A maior coluna ganha o número em cima; o resto fica na dica e na tabela.
 */
export function ColumnChart({ data, label, tickEvery = 1, height = 'h-44' }) {
  const maxVal = Math.max(0, ...data.map((d) => d.value));
  const max = niceMax(maxVal);
  const peak = maxVal > 0 ? data.findIndex((d) => d.value === maxVal) : -1;
  const n = data.length;
  return (
    <figure aria-label={label}>
      <div className={cn('relative', height)}>
        {[0, max / 2, max].map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="tabular absolute left-0 -translate-y-1/2 bg-white pr-1 text-[11px] text-slate-400">{fmtNum(t)}</span>
          </div>
        ))}
        <div className="absolute inset-y-0 left-8 right-0 flex items-end gap-0.5">
          {data.map((d, i) => {
            const pos = i < n / 3 ? 'left-0' : i > (2 * n) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2';
            return (
              <div key={d.key} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                <div
                  className="relative w-full max-w-6 rounded-t-[4px] bg-brand-600 transition-colors group-hover:bg-brand-800"
                  style={{ height: `${(d.value / max) * 100}%` }}
                >
                  {i === peak && (
                    <span className="tabular absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 text-[11px] font-semibold text-slate-700 group-hover:invisible">
                      {fmtNum(d.value)}
                    </span>
                  )}
                  <span className={cn('pointer-events-none absolute bottom-full z-10 mb-1.5 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow group-hover:block', pos)}>
                    {d.tip}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-8 mt-1.5 flex gap-0.5 text-[11px] text-slate-500" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
            {i % tickEvery === 0 || i === n - 1 ? d.tick : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Barras horizontais com valor à direita. items: [{ label, value, extra? }] */
export function BarList({ items, empty = 'Sem dados no período.', extraLabel }) {
  if (!items.length) return <p className="text-sm text-slate-500">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700" title={it.label}>{it.label}</span>
            <span className="tabular shrink-0 font-medium text-slate-900">
              {fmtNum(it.value)}
              {extraLabel && it.extra !== undefined && <span className="ml-1.5 text-xs font-normal text-slate-500">· {fmtNum(it.extra)} {extraLabel}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${Math.min(100, Math.max(2, (it.value / max) * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Funil: cada etapa com o total, % do início e % da etapa anterior. */
export function Funnel({ steps }) {
  // Escala pela maior etapa (as contas vêm do sistema e podem passar das visitas registradas).
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-700"><span className="tabular mr-1.5 text-slate-400">{i + 1}.</span>{s.label}</span>
            <span className="tabular shrink-0 font-semibold text-slate-900">
              {fmtNum(s.value)}
              {s.ofPrev !== null && i > 0 && <span className="ml-1.5 text-xs font-normal text-slate-500">{s.ofPrev.toLocaleString('pt-BR')}% da etapa anterior</span>}
            </span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-2.5 rounded-full bg-brand-600" style={{ width: `${s.value ? Math.min(100, Math.max(1.5, (s.value / max) * 100)) : 0}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
