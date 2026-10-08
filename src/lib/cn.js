import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Junta classes do Tailwind resolvendo conflitos. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
