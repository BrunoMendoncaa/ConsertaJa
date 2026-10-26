'use client';

import { useRef, useState } from 'react';
import { APPS } from '@/features/admin/apps';
import { PERMISSIONS } from '@/features/admin/permissions';
import { cn } from '@/lib/cn';

const REQUIRES = Object.fromEntries(PERMISSIONS.filter((p) => p.requires).map((p) => [p.key, p.requires]));

/**
 * Aplicações (name="apps") e, dentro de cada uma, uma caixa por funcionalidade (name="permissions").
 * Aplicação desmarcada: as caixas dela ficam desligadas (não vão no formulário). Marcar uma ação
 * marca também o "ver" que ela exige; desmarcar o "ver" desmarca as ações que dependem dele.
 * O servidor confere tudo de novo.
 */
export function PermissionPicker({ value = [], apps = [], idPrefix = 'perm' }) {
  const box = useRef(null);
  const selected = new Set(value);
  const [enabled, setEnabled] = useState(() => new Set(apps));

  function inputs(appKey) {
    const scope = box.current?.querySelector(`[data-app="${appKey}"]`);
    return [...(scope?.querySelectorAll('input[name="permissions"]') || [])];
  }

  function onPermissionChange(appKey, event) {
    const { value: key, checked } = event.target;
    const all = inputs(appKey);
    if (checked && REQUIRES[key]) {
      const base = all.find((i) => i.value === REQUIRES[key]);
      if (base) base.checked = true;
    }
    if (!checked) {
      for (const i of all) if (REQUIRES[i.value] === key) i.checked = false;
    }
  }

  function toggleApp(appKey, on) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (on) next.add(appKey); else next.delete(appKey);
      return next;
    });
  }

  function setAll(appKey, checked) {
    for (const i of inputs(appKey)) i.checked = checked;
  }

  return (
    <div ref={box} className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-700">Aplicações e o que pode ver e fazer em cada uma</p>
        <p className="text-xs text-slate-500">Marque as aplicações que este acesso abre. Sem nenhuma, a pessoa só entra e troca a senha.</p>
      </div>
      {APPS.map((app) => {
        const on = enabled.has(app.key);
        const appId = `${idPrefix}-app-${app.key}`;
        return (
          <section key={app.key} data-app={app.key}
            className={cn('rounded-xl border', on ? 'border-brand-200 bg-brand-50/40' : 'border-slate-200')}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <label htmlFor={appId} className="flex cursor-pointer items-start gap-2.5">
                <input id={appId} type="checkbox" name="apps" value={app.key} checked={on}
                  onChange={(e) => toggleApp(app.key, e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{app.name}</span>
                  <span className="block text-xs text-slate-500">{on ? app.tagline : `${app.tagline} · sem acesso`}</span>
                </span>
              </label>
              {on && (
                <div className="flex gap-3 text-sm">
                  <button type="button" onClick={() => setAll(app.key, true)} className="font-medium text-brand-700 hover:underline">Marcar tudo</button>
                  <button type="button" onClick={() => setAll(app.key, false)} className="font-medium text-slate-500 hover:underline">Desmarcar tudo</button>
                </div>
              )}
            </div>
            {/* Desligado não vai no formulário, mas guarda o que estava marcado se a aplicação voltar. */}
            <fieldset disabled={!on} hidden={!on} className="border-t border-slate-200 p-4">
              <legend className="sr-only">Permissões no {app.name}</legend>
              <div className="grid gap-4 md:grid-cols-2">
                {app.permissionGroups.map((group) => (
                  <div key={group.title} className="rounded-xl border border-slate-200 bg-white p-4">
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
                                onChange={(e) => onPermissionChange(app.key, e)}
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
          </section>
        );
      })}
    </div>
  );
}
