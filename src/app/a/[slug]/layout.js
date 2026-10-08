import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Phone, MessageCircle, MapPin, Clock } from 'lucide-react';
import { getPortalAssistance } from '@/features/portal/queries';
import { logoUrl } from '@/features/tenancy/queries';
import { whatsappLink } from '@/lib/phone';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const a = await getPortalAssistance(slug);
  return { title: a ? `${a.name} · Acompanhe seu conserto` : 'Assistência não encontrada', robots: { index: false } };
}

export default async function PortalLayout({ children, params }) {
  const { slug } = await params;
  const a = await getPortalAssistance(slug);
  if (!a) notFound();

  const logo = logoUrl(a.logo_path);
  const addr = a.address || {};
  const addressLine = [addr.rua && `${addr.rua}${addr.numero ? `, ${addr.numero}` : ''}`, addr.bairro, addr.cidade && `${addr.cidade}${addr.uf ? `/${addr.uf}` : ''}`]
    .filter(Boolean).join(' · ');

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 print:bg-white" style={{ '--brand': a.brand_color || '#2563eb' }}>
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {logo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logo} alt="" className="size-10 rounded-lg object-contain" />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--brand)] text-lg font-semibold text-white">
              {a.name.slice(0, 1)}
            </span>
          )}
          <Link href={`/a/${slug}`} className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{a.name}</p>
            <p className="text-xs text-slate-500">Acompanhamento de conserto</p>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 print:max-w-none print:p-0">{children}</main>

      <footer className="border-t border-slate-200 bg-white print:hidden">
        <div className="mx-auto max-w-2xl space-y-2 px-4 py-6 text-sm text-slate-600">
          <p className="font-medium text-slate-900">{a.name}</p>
          {a.whatsapp && (
            <a href={whatsappLink(a.whatsapp, 'Olá! Gostaria de falar sobre meu conserto.')} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-emerald-700 hover:underline">
              <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp {a.whatsapp}
            </a>
          )}
          {a.phone && <a href={`tel:${a.phone.replace(/\D/g, '')}`} className="flex items-center gap-2 hover:underline"><Phone className="size-4" aria-hidden="true" /> {a.phone}</a>}
          {addressLine && <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {addressLine}</p>}
          {a.business_hours && <p className="flex items-start gap-2"><Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {a.business_hours}</p>}
          <p className="pt-3 text-xs text-slate-400">Sistema Conserta Já</p>
        </div>
      </footer>
    </div>
  );
}
