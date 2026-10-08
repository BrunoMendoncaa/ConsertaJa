import { OS_STATUS } from '@/lib/constants';
import { formatDateTime } from '@/lib/dates';
import { cn } from '@/lib/cn';

const VIA = { STAFF: 'Equipe', PORTAL: 'Cliente (portal)', SYSTEM: 'Sistema' };

export function Timeline({ events, customerView = false }) {
  if (!events?.length) return <p className="text-sm text-slate-500">Sem eventos.</p>;
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {events.map((e, i) => (
        <li key={e.id || i} className="relative">
          <span className={cn('absolute -left-[26px] top-1 size-3 rounded-full ring-4 ring-white',
            i === events.length - 1 ? 'bg-brand-600' : 'bg-slate-300')} />
          <p className="text-sm font-medium text-slate-900">
            {customerView ? OS_STATUS[e.status]?.customer : OS_STATUS[e.to_status]?.label}
          </p>
          {e.note && <p className="text-sm text-slate-600">{e.note}</p>}
          <p className="text-xs text-slate-400">
            {formatDateTime(e.created_at || e.at)}
            {!customerView && e.changed_via && ` · ${VIA[e.changed_via]}${e.author ? ` · ${e.author}` : ''}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
