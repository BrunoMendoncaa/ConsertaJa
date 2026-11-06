'use client';

import { useEffect } from 'react';
import { Alert } from '@/components/ui/alert';

/**
 * Aviso na volta do Google (?erro=google ou ?erro=google-cancelado).
 * O Supabase devolve o motivo também depois do # do endereço; aqui ele é tirado da barra.
 */
export function GoogleError({ code }) {
  const isGoogle = code === 'google' || code === 'google-cancelado';
  useEffect(() => {
    if (isGoogle && window.location.hash.startsWith('#error')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [isGoogle]);

  if (code === 'google-cancelado') {
    return <Alert variant="info" className="mt-4">O login com o Google foi cancelado. Tente de novo ou use e-mail e senha.</Alert>;
  }
  if (code === 'google') {
    return <Alert variant="warning" className="mt-4">Não foi possível entrar com o Google agora. Tente de novo ou use e-mail e senha.</Alert>;
  }
  return null;
}
