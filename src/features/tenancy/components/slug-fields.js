'use client';

import { useState } from 'react';
import { Input, Label } from '@/components/ui/input';
import { FieldError } from '@/components/ui/action-form';

export function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}

export function SlugFields({ siteUrl }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [touched, setTouched] = useState(false);
  const host = siteUrl.replace(/^https?:\/\//, '');

  return (
    <>
      <div>
        <Label htmlFor="name">Nome da assistência</Label>
        <Input
          id="name" name="name" required placeholder="Assistência Técnica Silva" value={name}
          onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }}
        />
        <FieldError name="name" />
      </div>
      <div>
        <Label htmlFor="slug">Endereço para os seus clientes</Label>
        <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 bg-slate-50 focus-within:ring-2 focus-within:ring-brand-500/30">
          <span className="shrink-0 pl-3 text-sm text-slate-500">{host}/a/</span>
          <input
            id="slug" name="slug" required value={slug} placeholder="assistencia-silva"
            onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)); }}
            className="h-10 min-w-0 flex-1 bg-white px-2 text-sm outline-none"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">Vai no comprovante e no QR code. Depois de criado, não muda.</p>
        <FieldError name="slug" />
      </div>
    </>
  );
}
