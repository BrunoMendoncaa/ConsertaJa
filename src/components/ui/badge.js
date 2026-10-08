import { cn } from '@/lib/cn';
import { OS_STATUS, BUDGET_STATUS } from '@/lib/constants';

const tones = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
  green: 'bg-green-50 text-green-700 ring-green-200',
  zinc: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
};

export function Badge({ tone = 'slate', className, children }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, customer = false, className }) {
  const s = OS_STATUS[status];
  if (!s) return <Badge className={className}>{status}</Badge>;
  return <Badge tone={s.tone} className={className}>{customer ? s.customer : s.label}</Badge>;
}

export function BudgetStatusBadge({ status, expired, className }) {
  if (expired) return <Badge tone="zinc" className={className}>Vencido</Badge>;
  const s = BUDGET_STATUS[status];
  return <Badge tone={s?.tone} className={className}>{s?.label || status}</Badge>;
}
