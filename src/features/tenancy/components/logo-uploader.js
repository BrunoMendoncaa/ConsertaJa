'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import { ImagePlus, LoaderCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { setLogo } from '@/features/tenancy/actions';
import { buttonClasses } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export function LogoUploader({ assistanceId, currentUrl }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Use PNG, JPG ou WebP.');
      const small = await imageCompression(file, { maxWidthOrHeight: 512, maxSizeMB: 0.5, fileType: 'image/webp' });
      const path = `${assistanceId}/logo-${Date.now()}.webp`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from('logos').upload(path, small, { contentType: 'image/webp', upsert: true });
      if (upErr) throw new Error('Não foi possível enviar o logo.');
      const res = await setLogo(path);
      if (!res?.ok) throw new Error(res?.error || 'Não foi possível salvar o logo.');
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    await setLogo(null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="flex size-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {currentUrl ? <img src={currentUrl} alt="Logo atual" className="size-full object-contain" /> : <span className="text-xs text-slate-400">Sem logo</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className={buttonClasses({ variant: 'outline', size: 'sm', className: 'cursor-pointer' })}>
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
            {currentUrl ? 'Trocar logo' : 'Enviar logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy}
              onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {currentUrl && <button type="button" onClick={remove} disabled={busy} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>Remover</button>}
        </div>
      </div>
      <p className="text-xs text-slate-500">Aparece no portal do cliente, no comprovante e no orçamento. Quadrado, fundo transparente de preferência.</p>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
