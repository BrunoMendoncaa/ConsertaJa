'use client';

import { Printer } from 'lucide-react';
import { buttonClasses } from './button';

export function PrintButton({ label = 'Imprimir', className }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClasses({ variant: 'outline', className })}>
      <Printer className="size-4" aria-hidden="true" /> {label}
    </button>
  );
}
