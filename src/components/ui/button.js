import Link from 'next/link';
import { cn } from '@/lib/cn';

const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600 shadow-sm',
  secondary: 'bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900 shadow-sm',
  outline: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-brand-600',
  ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:outline-brand-600',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600 shadow-sm',
  link: 'text-brand-700 underline-offset-4 hover:underline px-0 h-auto',
};

const sizes = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export function buttonClasses({ variant = 'primary', size = 'md', className } = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    variant !== 'link' && sizes[size],
    className
  );
}

export function Button({ variant, size, className, type = 'button', ...props }) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
