import { formatBRL } from '@/lib/money';
import { shortDay } from '@/lib/dates';

// Entradas acima da linha de base, saídas abaixo: um único eixo, sinal pela posição.
// Cores do par divergente de referência (azul ↔ vermelho), com legenda e tabela.
const IN_COLOR = '#2a78d6';
const OUT_COLOR = '#e34948';

function barPath(x, y0, y1, w, r) {
  // Barra com ponta arredondada (4px) do lado do dado e base reta na linha zero.
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return '';
  const rr = Math.min(r, w / 2, h);
  if (y1 < y0) {
    return `M${x} ${y0}V${y1 + rr}Q${x} ${y1} ${x + rr} ${y1}H${x + w - rr}Q${x + w} ${y1} ${x + w} ${y1 + rr}V${y0}Z`;
  }
  return `M${x} ${y0}V${y1 - rr}Q${x} ${y1} ${x + rr} ${y1}H${x + w - rr}Q${x + w} ${y1} ${x + w} ${y1 - rr}V${y0}Z`;
}

function niceMax(v) {
  if (v <= 0) return 100;
  const exp = 10 ** Math.floor(Math.log10(v));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

export function CashFlowChart({ daily }) {
  const days = daily || [];
  if (!days.length) return null;
  const maxIn = Math.max(0, ...days.map((d) => Number(d.inflow)));
  const maxOut = Math.max(0, ...days.map((d) => Number(d.outflow)));
  const top = niceMax(maxIn);
  const bottom = niceMax(maxOut);

  const W = 720;
  const H = 240;
  const padL = 64;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const plotH = H - padT - padB;
  const scale = plotH / (top + bottom);
  const zero = padT + top * scale;
  const slot = (W - padL - padR) / days.length;
  const barW = Math.max(2, Math.min(18, slot - 2));
  const labelEvery = Math.ceil(days.length / 10);

  return (
    <figure>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: IN_COLOR }} /> Entradas</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: OUT_COLOR }} /> Saídas</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Entradas e saídas por dia no período">
        {/* grade recessiva */}
        {[top, top / 2, 0, -bottom / 2, -bottom].map((v) => {
          const y = zero - v * scale;
          return (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke={v === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth="1" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {v === 0 ? 'R$ 0' : `${v < 0 ? '−' : ''}${formatBRL(Math.abs(v)).replace(',00', '')}`}
              </text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const inY = zero - Number(d.inflow) * scale;
          const outY = zero + Number(d.outflow) * scale;
          return (
            <g key={d.day}>
              {Number(d.inflow) > 0 && <path d={barPath(x, zero - 1, inY, barW, 4)} fill={IN_COLOR} />}
              {Number(d.outflow) > 0 && <path d={barPath(x, zero + 1, outY, barW, 4)} fill={OUT_COLOR} />}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">{shortDay(d.day)}</text>
              )}
              {/* alvo de hover maior que a barra, com tooltip nativo */}
              <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent">
                <title>{`${shortDay(d.day)} · Entradas ${formatBRL(d.inflow)} · Saídas ${formatBRL(d.outflow)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-slate-500">Ver como tabela</summary>
        <table className="mt-2 w-full text-xs">
          <thead><tr className="text-left text-slate-500"><th className="py-1">Dia</th><th className="py-1 text-right">Entradas</th><th className="py-1 text-right">Saídas</th></tr></thead>
          <tbody className="tabular">
            {days.filter((d) => Number(d.inflow) || Number(d.outflow)).map((d) => (
              <tr key={d.day} className="border-t border-slate-100"><td className="py-1">{shortDay(d.day)}</td><td className="py-1 text-right">{formatBRL(d.inflow)}</td><td className="py-1 text-right">{formatBRL(d.outflow)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
