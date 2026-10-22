'use client';

import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';

// Recado para quem chega por um link de campanha (mensagem do WhatsApp ou post em grupo).
const NOTES = {
  // Mensagens antigas do WhatsApp prometiam mais 14 dias pelo número: continua valendo (estender pela área admin).
  '/14dias': 'Veio pela mensagem do WhatsApp? Crie sua conta grátis e responda a mensagem: eu libero mais 14 dias de Pro e te ajudo a configurar.',
  '/gratis': 'Veio pela mensagem do WhatsApp? Crie sua conta grátis e me chame lá se quiser ajuda para configurar.',
  '/grupos': 'Veio pelo grupo? Crie sua conta grátis e me chame no WhatsApp se quiser ajuda para configurar.',
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
