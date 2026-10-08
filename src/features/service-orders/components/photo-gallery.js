import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { togglePhotoVisibility, deletePhoto } from '@/features/service-orders/actions';
import { PHOTO_KINDS, PHOTO_STAGES } from '@/lib/constants';
import { formatDateTime } from '@/lib/dates';

export function PhotoGallery({ photos, serviceOrderId, canDelete }) {
  if (!photos.length) return <p className="text-sm text-slate-500">Nenhuma foto ainda.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((p) => (
        <li key={p.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {p.url ? (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={PHOTO_KINDS[p.kind]} className="size-full object-cover" loading="lazy" />
            </a>
          ) : <div className="aspect-square bg-slate-100" />}
          <div className="space-y-1 p-2">
            <p className="text-xs font-medium text-slate-800">{PHOTO_KINDS[p.kind]} · {PHOTO_STAGES[p.stage]}</p>
            <p className="text-[11px] text-slate-500">{formatDateTime(p.created_at)}</p>
            <div className="flex items-center justify-between gap-1">
              <ActionForm action={togglePhotoVisibility.bind(null, p.id, serviceOrderId)}>
                <input type="hidden" name="visible" value={String(!p.visible_to_customer)} />
                <SubmitButton variant="ghost" size="sm" className="h-7 px-2 text-xs" title={p.visible_to_customer ? 'Visível no portal' : 'Oculta no portal'}>
                  {p.visible_to_customer ? <Eye className="size-3.5" aria-hidden="true" /> : <EyeOff className="size-3.5" aria-hidden="true" />}
                  {p.visible_to_customer ? 'No portal' : 'Oculta'}
                </SubmitButton>
              </ActionForm>
              {canDelete && (
                <ActionForm action={deletePhoto.bind(null, p.id, serviceOrderId)} confirm="Excluir esta foto?">
                  <SubmitButton variant="ghost" size="sm" className="h-7 px-2 text-red-600" aria-label="Excluir foto">
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
