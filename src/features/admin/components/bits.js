import { MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { formatDate } from '@/lib/dates';
import { formatPhone, whatsappLink } from '@/lib/phone';
import { situation, dueInfo, relativeDays } from '@/features/admin/format';
import { cn } from '@/lib/cn';
import { getApp } from '@/features/admin/apps';

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
  admin_create: 'Criou acesso admin',
  admin_update: 'Alterou acesso admin',
  admin_password_reset: 'Redefiniu a senha de um acesso',
  admin_delete: 'Removeu acesso admin',
  password_change: 'Trocou a própria senha',
  test_create: 'Criou conta de teste',
  test_plan: 'Trocou o plano da conta de teste',
  test_mark: 'Marcou como conta de teste',
  test_unmark: 'Voltou a contar como assistência',
  test_password: 'Trocou a senha da conta de teste',
  test_delete: 'Excluiu conta de teste',
};

const PLAN_NAMES = { pro: 'Pro', free: 'Grátis' };
const appName = (key) => getApp(key)?.name || key;

export function actionDetail(row) {
  const d = row.details || {};
  if (row.action === 'extend_trial') return `+${d.days} dia(s), até ${formatDate(d.to)}${d.note ? ` · ${d.note}` : ''}`;
  if (row.action === 'suspend') return d.reason || '';
  if (row.action === 'reactivate') return d.restored_status ? `voltou para ${STATUS_LABELS[d.restored_status] || d.restored_status}` : '';
  if (row.action === 'admin_update') {
    const parts = [d.target];
    if (d.apps_added?.length) parts.push(`+ ${d.apps_added.map(appName).join(', ')}`);
    if (d.apps_removed?.length) parts.push(`- ${d.apps_removed.map(appName).join(', ')}`);
    if (d.added?.length) parts.push(`+${d.added.length} permissão(ões)`);
    if (d.removed?.length) parts.push(`-${d.removed.length} permissão(ões)`);
    if (d.active === false) parts.push('desativado');
    if (d.active === true) parts.push('reativado');
    return parts.filter(Boolean).join(' · ');
  }
  if (['admin_create', 'admin_password_reset', 'admin_delete'].includes(row.action)) return d.target || '';
  if (row.action === 'test_create') return [d.name, d.email, PLAN_NAMES[d.plan]].filter(Boolean).join(' · ');
  if (row.action === 'test_plan') return `${PLAN_NAMES[d.from] || d.from || '—'} → ${PLAN_NAMES[d.to] || d.to}`;
  if (row.action === 'test_mark') return PLAN_NAMES[d.plan] || '';
  if (row.action === 'test_delete') return [d.name, d.logins?.length ? `logins: ${d.logins.join(', ')}` : ''].filter(Boolean).join(' · ');
  return '';
}
