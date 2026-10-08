'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { ActionForm, SubmitButton, FieldError } from '@/components/ui/action-form';
import { Textarea } from '@/components/ui/input';
import { formatBRL } from '@/lib/money';

export function DecisionPanel({ action, total }) {
  const [mode, setMode] = useState(null);

  if (!mode) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setMode('approve')}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-semibold text-white shadow-sm hover:bg-emerald-700">
          <Check className="size-5" aria-hidden="true" /> Aprovar orçamento
        </button>
        <button type="button" onClick={() => setMode('refuse')}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-base font-semibold text-slate-700 hover:bg-slate-50">
          <X className="size-5" aria-hidden="true" /> Recusar orçamento
        </button>
      </div>
    );
  }

  return (
    <ActionForm action={action} className="space-y-4">
      {mode === 'approve' ? (
        <>
          <input type="hidden" name="decision" value="APROVADO" />
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <input type="checkbox" name="accept" className="mt-0.5 size-5 rounded border-slate-300 text-emerald-600" />
            <span>Li o orçamento e autorizo a execução do serviço no valor total de <strong>{formatBRL(total)}</strong>, nas condições descritas.</span>
          </label>
          <FieldError name="accept" />
          <SubmitButton variant="success" size="lg" className="w-full" pendingText="Registrando...">Confirmar aprovação</SubmitButton>
        </>
      ) : (
        <>
          <input type="hidden" name="decision" value="RECUSADO" />
          <label className="block text-sm font-medium text-slate-700" htmlFor="reason">Por que você está recusando?</label>
          <Textarea id="reason" name="reason" rows={3} placeholder="Ex.: Achei caro, vou trocar o aparelho, prefiro outra peça…" />
          <FieldError name="reason" />
          <SubmitButton variant="danger" size="lg" className="w-full" pendingText="Registrando...">Confirmar recusa</SubmitButton>
        </>
      )}
      <button type="button" onClick={() => setMode(null)} className="w-full text-center text-sm text-slate-500 hover:text-slate-800">Voltar</button>
    </ActionForm>
  );
}
