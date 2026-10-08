import { cn } from '@/lib/cn';

export function Card({ className, ...props }) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)} {...props} />;
}

export function CardHeader({ title, description, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}
