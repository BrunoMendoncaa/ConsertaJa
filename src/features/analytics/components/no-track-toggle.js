'use client';

import { useEffect, useState } from 'react';
import { NO_TRACK_KEY } from '@/features/analytics/constants';

// "Não contar minhas visitas": marca este navegador para o contador ignorar.
// Vale para o tecnofix.pro inteiro neste navegador (a área admin e o site são o mesmo endereço).
export function NoTrackToggle() {
  const [off, setOff] = useState(null);

  useEffect(() => {
    try {
      setOff(window.localStorage.getItem(NO_TRACK_KEY) === '1');
    } catch {
      setOff(false);
    }
  }, []);

  function toggle() {
    try {
      if (off) window.localStorage.removeItem(NO_TRACK_KEY);
      else window.localStorage.setItem(NO_TRACK_KEY, '1');
      setOff(!off);
    } catch {
      // navegador sem armazenamento: nada a fazer
    }
  }

  if (off === null) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-slate-600">
        {off ? 'Suas visitas neste navegador não entram na contagem.' : 'Suas visitas neste navegador entram na contagem.'}
      </span>
      <button type="button" onClick={toggle}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {off ? 'Voltar a contar' : 'Não contar minhas visitas'}
      </button>
    </div>
  );
}
