'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { formatTime } from '@/lib/dates';
import { cn } from '@/lib/cn';

/**
 * Recarrega os dados da página atual da área admin sem sair dela (busca tudo de novo no
 * servidor). renderedAt vem do servidor a cada carga, então o horário mostrado é o da
 * última leitura do banco, em Brasília.
 */
export function RefreshButton({ renderedAt }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      title={`Dados de ${formatTime(renderedAt)} (horário de Brasília). Clique para buscar de novo.`}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-70"
    >
      <RefreshCw className={cn('size-4', pending && 'animate-spin')} aria-hidden="true" />
      <span aria-live="polite">
        {pending ? 'Atualizando…' : (
          <>Atualizar<span className="hidden sm:inline"> · {formatTime(renderedAt)}</span></>
        )}
      </span>
    </button>
  );
}
