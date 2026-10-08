import { cn } from '@/lib/cn';

const base =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm ' +
  'placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 ' +
  'disabled:bg-slate-100 disabled:text-slate-500';

export function Input({ className, ...props }) {
  return <input className={cn(base, 'h-10', className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} className={cn(base, 'py-2', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(base, 'h-10 pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-slate-700', className)} {...props} />;
}

export function Checkbox({ label, className, ...props }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700', className)}>
      <input
        type="checkbox"
        className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        {...props}
      />
      {label}
    </label>
  );
}
