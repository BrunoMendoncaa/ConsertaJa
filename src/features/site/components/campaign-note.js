'use client';

import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';

// Recado para quem chega por um link de campanha que oferece mais 14 dias pelo WhatsApp.
const NOTES = {
  '/14dias': 'Veio pela mensagem do WhatsApp? Comece os 14 dias grátis e responda a mensagem para ganhar mais 14.',
  '/grupos': 'Veio pelo grupo? Comece os 14 dias grátis e chame no WhatsApp para ganhar mais 14.',
};

export function CampaignNote() {
  // Os links de campanha são rewrites para "/": no servidor a página não sabe por qual link a pessoa veio,
  // então o recado só entra depois de carregar no navegador (evita diferença entre servidor e navegador).
  const [note, setNote] = useState(null);
  useEffect(() => {
    setNote(NOTES[window.location.pathname] || null);
  }, []);
  if (!note) return null;
  return (
    <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
      <Gift className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
      {note}
    </p>
  );
}
