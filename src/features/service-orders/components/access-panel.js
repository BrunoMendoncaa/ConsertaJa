import { MessageCircle, Printer, ExternalLink } from 'lucide-react';
import { CopyButton } from '@/components/ui/copy-button';
import { buttonClasses } from '@/components/ui/button';

/** Código + link do portal + atalhos (WhatsApp e comprovante). */
export function AccessPanel({ link, accessCode, whatsappHref, receiptHref }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Código de acesso</p>
          <p className="font-mono text-2xl font-semibold tracking-[0.2em] text-slate-900">{accessCode}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate text-slate-700" title={link}>{link}</span>
        <CopyButton text={link} label="Copiar link" />
      </div>
      <div className="flex flex-wrap gap-2">
        {whatsappHref && (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'success', size: 'sm' })}>
            <MessageCircle className="size-4" aria-hidden="true" /> Enviar no WhatsApp
          </a>
        )}
        {receiptHref && (
          <a href={receiptHref} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'outline', size: 'sm' })}>
            <Printer className="size-4" aria-hidden="true" /> Comprovante com QR code
          </a>
        )}
        <a href={link} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
          <ExternalLink className="size-4" aria-hidden="true" /> Ver como cliente
        </a>
      </div>
    </div>
  );
}
