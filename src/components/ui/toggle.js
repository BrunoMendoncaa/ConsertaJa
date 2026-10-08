'use client';

import { useState } from 'react';

/** Mostra/esconde um bloco (ex.: formulário de recusa, edição inline). */
export function Toggle({ label, children, buttonClassName, defaultOpen = false, closeLabel = 'Cancelar' }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className={buttonClassName}>
          {label}
        </button>
      )}
      {open && (
        <div>
          {children}
          <button type="button" onClick={() => setOpen(false)} className="mt-2 text-sm text-slate-500 hover:text-slate-800">
            {closeLabel}
          </button>
        </div>
      )}
    </div>
  );
}
