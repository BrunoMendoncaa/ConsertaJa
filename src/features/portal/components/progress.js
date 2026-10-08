import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

const STEPS = ['Recebido', 'Em análise', 'Orçamento', 'Conserto', 'Pronto', 'Entregue'];
const INDEX = {
  RECEBIDO: 0, EM_DIAGNOSTICO: 1, AGUARDANDO_APROVACAO: 2, ORCAMENTO_RECUSADO: 2,
  APROVADO: 3, AGUARDANDO_PECA: 3, EM_MANUTENCAO: 3, PRONTO: 4, ENTREGUE: 5,
};

/** Barra de progresso simples para o cliente. */
export function OrderProgress({ status }) {
  if (status === 'CANCELADO') return null;
  const current = INDEX[status] ?? 0;
  return (
    <ol className="grid grid-cols-6 gap-1" aria-label="Andamento do conserto">
      {STEPS.map((label, i) => {
        const done = i < current || status === 'ENTREGUE';
        const active = i === current && status !== 'ENTREGUE';
        return (
          <li key={label} className="flex flex-col items-center gap-1.5 text-center">
            <span className={cn('flex size-7 items-center justify-center rounded-full text-xs font-semibold',
              done ? 'bg-[var(--brand)] text-white' : active ? 'bg-white text-[var(--brand)] ring-2 ring-[var(--brand)]' : 'bg-slate-100 text-slate-400')}>
              {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn('text-[10px] leading-tight sm:text-xs', active ? 'font-semibold text-slate-900' : 'text-slate-500')}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
