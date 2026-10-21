'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Barra fixa no rodapé do celular com o botão de teste grátis.
 * Aparece depois que o botão principal sai da tela (rolando para baixo) e some quando ele volta.
 */
export function MobileCtaBar({ watchId, days, whatsappHref }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => {
      setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [watchId]);

  return (
    <div
      inert={!show}
      data-visible={show ? 'true' : 'false'}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pt-3 backdrop-blur transition-transform duration-200 sm:hidden',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-18px_rgba(15,23,42,0.45)]',
        show ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="flex gap-2">
        <Link
          href="/cadastro"
          data-track="barra-teste-gratis"
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-base font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Testar grátis {days} dias <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          data-track="barra-whatsapp"
          aria-label="Tirar dúvida no WhatsApp"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
        >
          <MessageCircle className="size-5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
