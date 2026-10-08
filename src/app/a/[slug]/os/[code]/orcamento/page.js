import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { BudgetDocument } from '@/features/budgets/components/budget-document';
import { DecisionPanel } from '@/features/portal/components/decision-panel';
import { portalCall, getPortalAssistance } from '@/features/portal/queries';
import { portalDecide } from '@/features/portal/actions';
import { logoUrl } from '@/features/tenancy/queries';
import { formatDate, formatDateTime } from '@/lib/dates';
import { DECISION_CHANNELS } from '@/lib/constants';

export default async function PortalBudgetPage({ params, searchParams }) {
  const { slug, code } = await params;
  const sp = await searchParams;
  const version = Number(sp?.versao) || null;
  const osCode = decodeURIComponent(code);

  const [res, a] = await Promise.all([
    portalCall(slug, 'portal_get_budget', { p_code: osCode, p_version: version }),
    getPortalAssistance(slug),
  ]);
  if (res.expired) redirect(`/a/${slug}?expirada=1`);
  const b = res.data;
  if (!b) notFound();

  const s = b.snapshot;
  const open = b.status === 'ENVIADO' && !b.is_expired;

  return (
    <div className="space-y-5">
      <Link href={`/a/${slug}/os/${osCode}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ChevronLeft className="size-4" aria-hidden="true" /> Voltar para a OS
      </Link>

      {b.status === 'APROVADO' && (
        <Alert variant="success" title="Orçamento aprovado">
          {DECISION_CHANNELS[b.decision_channel]} em {formatDateTime(b.decided_at)}. A assistência já foi avisada e vai seguir com o serviço.
        </Alert>
      )}
      {b.status === 'RECUSADO' && (
        <Alert variant="warning" title="Orçamento recusado">
          {DECISION_CHANNELS[b.decision_channel]} em {formatDateTime(b.decided_at)}{b.refusal_reason && ` · ${b.refusal_reason}`}.
          {' '}A assistência vai entrar em contato para combinar os próximos passos.
        </Alert>
      )}
      {b.is_expired && (
        <Alert variant="info" title="Orçamento vencido">
          Este orçamento valia até {formatDate(b.valid_until)}. Fale com a assistência para receber um novo.
        </Alert>
      )}

      <BudgetDocument doc={s} logoUrl={logoUrl(s.assistance?.logo_path)} brandColor={a?.brand_color} />

      {open && (
        <section className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:shadow-sm">
          <DecisionPanel action={portalDecide.bind(null, slug, osCode, b.id, b.content_hash)} total={s.totals?.total} />
          <p className="mt-3 text-center text-xs text-slate-500">
            Sua resposta fica registrada com data, hora e identificação deste acesso.
          </p>
        </section>
      )}
    </div>
  );
}
