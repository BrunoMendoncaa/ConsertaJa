import { cn } from '@/lib/cn';

export function StatCard({ label, value, hint, tone = 'default', className }) {
  const toneCls = {
    default: 'text-slate-900',
    positive: 'text-emerald-700',
    negative: 'text-red-700',
    warning: 'text-amber-700',
  }[tone];
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn('tabular mt-1 text-2xl font-semibold tracking-tight', toneCls)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
