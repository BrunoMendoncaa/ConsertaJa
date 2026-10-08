'use client';

import { MessageCircle } from 'lucide-react';
import { useActionFormState } from '@/components/ui/action-form';
import { CopyButton } from '@/components/ui/copy-button';
import { buttonClasses } from '@/components/ui/button';

/** Mostra o link do convite gerado (o token só aparece uma vez). */
export function InvitationResult() {
  const { state } = useActionFormState();
  if (!state?.ok || !state?.data?.link) return null;
  const { link, whatsappText } = state.data;
  return (
    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <p className="break-all text-xs text-emerald-900">{link}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={link} label="Copiar link" />
        <a href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noopener noreferrer"
          className={buttonClasses({ variant: 'success', size: 'sm' })}>
          <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
        </a>
      </div>
    </div>
  );
}
