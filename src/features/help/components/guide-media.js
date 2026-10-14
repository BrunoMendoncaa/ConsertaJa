import { HELP_MEDIA } from '@/features/help/media-manifest';
import { cn } from '@/lib/cn';

// Moldura e largura máxima de cada tipo de mídia (os arquivos têm o dobro da resolução).
const FRAMES = {
  desktop: { box: 'rounded-xl border border-slate-200 bg-white shadow-sm', maxWidth: null },
  card: { box: 'rounded-xl bg-slate-50 ring-1 ring-slate-200', maxWidth: (w) => Math.round(w / 2) },
  doc: { box: 'rounded-lg border border-slate-200 bg-white shadow-md', maxWidth: () => 460 },
  phone: { box: 'rounded-[2rem] border-[6px] border-slate-900 bg-white shadow-lg', maxWidth: () => 280 },
};

function MediaItem({ item }) {
  const size = HELP_MEDIA[item.file];
  if (!size) return null;
  const frame = FRAMES[item.frame] || FRAMES.desktop;
  const maxWidth = frame.maxWidth ? frame.maxWidth(size.width) : undefined;
  const src = `/ajuda/${item.file}`;

  return (
    <figure className="mx-auto w-full" style={maxWidth ? { maxWidth } : undefined}>
      <div className={cn('overflow-hidden', frame.box)}>
        {item.type === 'video' ? (
          <video
            src={src}
            poster={item.poster ? `/ajuda/${item.poster}` : undefined}
            width={size.width}
            height={size.height}
            controls
            playsInline
            muted
            preload="none"
            aria-label={item.caption || 'Vídeo de demonstração'}
            className="block h-auto w-full"
          />
        ) : (
          <img
            src={src}
            alt={item.alt || ''}
            width={size.width}
            height={size.height}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        )}
      </div>
      {item.caption && <figcaption className="mt-2 text-center text-sm text-slate-500">{item.caption}</figcaption>}
    </figure>
  );
}

/** Prints e vídeos de um guia. Celulares lado a lado; o resto um embaixo do outro. */
export function GuideMedia({ media }) {
  if (!media?.length) return null;
  const allPhones = media.every((m) => m.frame === 'phone');
  return (
    <div className={allPhones ? 'flex flex-wrap items-start justify-center gap-6' : 'space-y-6'}>
      {media.map((m) => <MediaItem key={m.file} item={m} />)}
    </div>
  );
}
