'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { buttonClasses } from './button';

export function CopyButton({ text, label = 'Copiar', variant = 'outline', size = 'sm', className }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie o texto:', text);
    }
  }
  return (
    <button type="button" onClick={copy} className={buttonClasses({ variant, size, className })}>
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {copied ? 'Copiado' : label}
    </button>
  );
}
