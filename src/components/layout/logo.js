import { Wrench } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Logo({ className, inverted = false }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold tracking-tight', className)}>
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
        <Wrench className="size-4" aria-hidden="true" />
      </span>
      <span className={cn('text-lg', inverted ? 'text-white' : 'text-slate-900')}>
        Tecno<span className="text-accent-500">Fix</span>
      </span>
    </span>
  );
}
