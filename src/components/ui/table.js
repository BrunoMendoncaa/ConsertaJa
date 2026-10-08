import { cn } from '@/lib/cn';

export function Table({ className, children }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('min-w-full divide-y divide-slate-200 text-sm', className)}>{children}</table>
    </div>
  );
}

export function TH({ className, ...props }) {
  return <th className={cn('whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500', className)} {...props} />;
}

export function TD({ className, ...props }) {
  return <td className={cn('px-4 py-3 align-top text-slate-700', className)} {...props} />;
}

export function THead({ children }) {
  return <thead className="bg-slate-50">{children}</thead>;
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>;
}
