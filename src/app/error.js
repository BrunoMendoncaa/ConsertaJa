'use client';

import { useEffect } from 'react';

export default function GlobalRouteError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Algo deu errado</h1>
      <p className="max-w-md text-sm text-slate-500">
        Não foi possível carregar esta página. Tente novamente em instantes.
        {error?.digest && <span className="mt-1 block text-xs text-slate-400">Código: {error.digest}</span>}
      </p>
      <button type="button" onClick={reset} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        Tentar de novo
      </button>
    </main>
  );
}
