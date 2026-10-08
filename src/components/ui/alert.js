import { cn } from '@/lib/cn';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

const styles = {
  error: ['border-red-200 bg-red-50 text-red-800', CircleAlert],
  success: ['border-emerald-200 bg-emerald-50 text-emerald-800', CircleCheck],
  warning: ['border-amber-200 bg-amber-50 text-amber-900', TriangleAlert],
  info: ['border-blue-200 bg-blue-50 text-blue-800', Info],
};

export function Alert({ variant = 'info', title, children, className }) {
  const [cls, Icon] = styles[variant];
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  );
}
