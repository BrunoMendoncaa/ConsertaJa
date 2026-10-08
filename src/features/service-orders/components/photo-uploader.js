'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import { Camera, ImagePlus, LoaderCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { registerPhoto } from '@/features/service-orders/actions';
import { PHOTO_KINDS, PHOTO_STAGES } from '@/lib/constants';
import { Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';

const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

/**
 * Upload direto do navegador para o bucket privado, na pasta da assistência.
 * A foto é reduzida (≈1600px, WebP) antes do envio e perde os metadados (GPS).
 */
export function PhotoUploader({ assistanceId, serviceOrderId, defaultStage = 'ENTRADA', onUploaded }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [kind, setKind] = useState('FRENTE');
  const [stage, setStage] = useState(defaultStage);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);
  const [count, setCount] = useState(0);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    let done = 0;

    for (const original of files) {
      try {
        if (original.size > MAX_ORIGINAL_BYTES) throw new Error('Arquivo muito grande (máximo de 25 MB antes da compressão).');
        setProgress(`Preparando ${done + 1} de ${files.length}…`);
        const file = await imageCompression(original, {
          maxWidthOrHeight: 1600, maxSizeMB: 1, fileType: 'image/webp', initialQuality: 0.82, useWebWorker: true,
        });
        const path = `${assistanceId}/${serviceOrderId}/${crypto.randomUUID()}.webp`;
        setProgress(`Enviando ${done + 1} de ${files.length}…`);
        const { error: upErr } = await supabase.storage
          .from('service-order-photos')
          .upload(path, file, { contentType: 'image/webp', upsert: false });
        if (upErr) throw new Error('Não foi possível enviar a foto. Verifique sua conexão.');
        const result = await registerPhoto({
          service_order_id: serviceOrderId, storage_path: path, mime_type: 'image/webp',
          size_bytes: file.size, kind, stage, description: null,
        });
        if (!result?.ok) throw new Error(result?.error || 'Não foi possível salvar a foto.');
        done += 1;
      } catch (e) {
        setError(e.message);
      }
    }

    setCount((c) => c + done);
    setBusy(false);
    setProgress('');
    if (inputRef.current) inputRef.current.value = '';
    onUploaded?.(done);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">O que a foto mostra</span>
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(PHOTO_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Momento</span>
          <Select value={stage} onChange={(e) => setStage(e.target.value)}>
            {Object.entries(PHOTO_STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className={buttonClasses({ variant: 'primary', className: 'cursor-pointer' })}>
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Camera className="size-4" aria-hidden="true" />}
          {busy ? progress || 'Enviando…' : 'Tirar foto'}
          <input
            ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="sr-only"
            disabled={busy} onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
        <label className={buttonClasses({ variant: 'outline', className: 'cursor-pointer' })}>
          <ImagePlus className="size-4" aria-hidden="true" /> Escolher da galeria
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy}
            onChange={(e) => handleFiles(e.target.files)} />
        </label>
      </div>
      {count > 0 && !busy && <p className="text-sm text-emerald-700">{count} foto(s) enviada(s).</p>}
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
