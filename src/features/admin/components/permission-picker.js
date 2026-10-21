'use client';

import { useRef } from 'react';
import { PERMISSION_GROUPS, PERMISSIONS } from '@/features/admin/permissions';

const REQUIRES = Object.fromEntries(PERMISSIONS.filter((p) => p.requires).map((p) => [p.key, p.requires]));

/**
 * Uma caixa por funcionalidade (name="permissions"). Marcar uma ação marca também o "ver"
 * que ela exige; desmarcar o "ver" desmarca as ações que dependem dele. O servidor confere de novo.
 */
export function PermissionPicker({ value = [], idPrefix = 'perm' }) {
  const box = useRef(null);
  const selected = new Set(value);

  function inputs() {
    return [...(box.current?.querySelectorAll('input[name="permissions"]') || [])];
  }

  function onChange(event) {
    const { value: key, checked } = event.target;
    const all = inputs();
    if (checked && REQUIRES[key]) {
      const base = all.find((i) => i.value === REQUIRES[key]);
      if (base) base.checked = true;
    }
    if (!checked) {
      for (const i of all) if (REQUIRES[i.value] === key) i.checked = false;
    }
  }

  function setAll(checked) {
    for (const i of inputs()) i.checked = checked;
  }

  return (
    <fieldset ref={box} className="space-y-4">
      <legend className="sr-only">Permissões deste acesso</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">O que este acesso pode ver e fazer</p>
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={() => setAll(true)} className="font-medium text-brand-700 hover:underline">Marcar tudo</button>
          <button type="button" onClick={() => setAll(false)} className="font-medium text-slate-500 hover:underline">Desmarcar tudo</button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.title} className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</p>
            <ul className="mt-3 space-y-3">
              {group.items.map((p) => {
                const id = `${idPrefix}-${p.key}`;
                return (
                  <li key={p.key} className={p.requires ? 'pl-6' : ''}>
                    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5">
                      <input
                        id={id}
                        type="checkbox"
                        name="permissions"
                        value={p.key}
                        defaultChecked={selected.has(p.key)}
                        onChange={onChange}
                        className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">{p.label}</span>
                        {p.hint && <span className="block text-xs text-slate-500">{p.hint}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
