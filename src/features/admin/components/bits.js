import { MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { formatDate } from '@/lib/dates';
import { formatPhone, whatsappLink } from '@/lib/phone';
import { situation, dueInfo, relativeDays } from '@/features/admin/format';
import { cn } from '@/lib/cn';

export function SituationBadge({ assistance }) {
  const s = situation(assistance);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Data que importa agora (fim do teste, pago até, venceu em) + "em N dias". */
export function DueCell({ assistance, compact = false }) {
  const d = dueInfo(assistance);
  if (!d.date) return <span className="text-slate-400">—</span>;
  const urgent = d.days !== null && d.days <= 3;
  return (
    <span className="block">
      {!compact && <span className="block text-xs text-slate-500">{d.label}</span>}
      <span className="font-medium text-slate-900">{formatDate(d.date)}</span>
      <span className={cn('block text-xs', urgent ? 'font-medium text-amber-700' : 'text-slate-500')}>{relativeDays(d.days)}</span>
    </span>
  );
}

/** Contato do dono: WhatsApp (dele ou da loja) com mensagem pronta. */
export function OwnerContact({ assistance, message }) {
  const phone = assistance.owner_phone || assistance.whatsapp || assistance.phone;
  if (!phone) return null;
  return (
    <a href={whatsappLink(phone, message)} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
      <MessageCircle className="size-3.5" aria-hidden="true" /> {formatPhone(phone)}
    </a>
  );
}

export function SetupNotice({ message }) {
  return (
    <Alert variant="warning" title="Falta configurar o banco">
      {message} Abra o SQL Editor do Supabase, cole o arquivo
      <code className="mx-1 font-mono text-xs">supabase/migrations/20261014120000_admin.sql</code>
      e clique em Run.
    </Alert>
  );
}

const STATUS_LABELS = { trialing: 'teste grátis', active: 'ativa', past_due: 'pagamento pendente', canceled: 'cancelada' };

export const ACTION_LABELS = {
  login: 'Entrou na área admin',
  extend_trial: 'Estendeu o teste',
  suspend: 'Suspendeu',
  reactivate: 'Reativou',
  sync_mp: 'Conferiu no Mercado Pago',
};

export function actionDetail(row) {
  const d = row.details || {};
  if (row.action === 'extend_trial') return `+${d.days} dia(s), até ${formatDate(d.to)}${d.note ? ` · ${d.note}` : ''}`;
  if (row.action === 'suspend') return d.reason || '';
  if (row.action === 'reactivate') return d.restored_status ? `voltou para ${STATUS_LABELS[d.restored_status] || d.restored_status}` : '';
  return '';
}
