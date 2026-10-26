import { Wrench, AppWindow } from 'lucide-react';
import { cn } from '@/lib/cn';

// Ícone e cor de cada aplicação da central (aplicação nova sem ícone usa o genérico).
const ICONS = {
  tecnofix: { Icon: Wrench, className: 'bg-brand-600 text-white' },
};

export function AppIcon({ appKey, size = 'md', className }) {
  const { Icon, className: tone } = ICONS[appKey] || { Icon: AppWindow, className: 'bg-slate-600 text-white' };
  const box = size === 'sm' ? 'size-6 rounded-md' : size === 'lg' ? 'size-11 rounded-xl' : 'size-8 rounded-lg';
  const icon = size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-6' : 'size-4';
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center', box, tone, className)}>
      <Icon className={icon} aria-hidden="true" />
    </span>
  );
}
