'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store } from 'lucide-react';

/**
 * Aviso de cadastro da assistência incompleto (WhatsApp/telefone ou endereço).
 * Proprietário e administrador veem em todas as telas, menos em Configurações (onde já estão).
 * Técnico e atendente só veem no Dashboard, para avisarem o responsável.
 */
export function ProfileNotice({ missing, canManage }) {
  const pathname = usePathname();
  if (!missing?.length) return null;
  if (pathname.startsWith('/painel/configuracoes')) return null;
  if (!canManage && pathname !== '/painel') return null;
  const what = missing.join(' e ');

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-900 print:hidden">
      <Store className="size-4 shrink-0" aria-hidden="true" />
      {canManage ? (
        <>
          <span>Complete o cadastro da assistência: falta {what}. Esses dados saem no comprovante, no orçamento e no portal do cliente.</span>
          <Link href="/painel/configuracoes?completar=1" className="whitespace-nowrap font-semibold underline">Completar agora</Link>
        </>
      ) : (
        <span>O cadastro da assistência está incompleto (falta {what}). Avise o responsável pela assistência.</span>
      )}
    </div>
  );
}
