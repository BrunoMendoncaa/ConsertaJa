'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LayoutGrid, Users, Check } from 'lucide-react';
import { AppIcon } from '@/features/admin/components/app-icon';
import { cn } from '@/lib/cn';

function isActive(pathname, href, exactHrefs) {
  return exactHrefs.includes(href) ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Topo da área admin: escolha da aplicação (ou a central) e o menu dela.
 * Tudo chega do servidor já filtrado pelas aplicações e permissões da conta.
 * apps: [{ key, name, base, home, items: [{ href, label }] }]
 */
export function AdminNav({ hubItems = [], apps = [], master = false }) {
  const pathname = usePathname();
  const menu = useRef(null);
  const current = apps.find((a) => pathname === a.base || pathname.startsWith(`${a.base}/`)) || null;
  const items = current ? current.items : hubItems;
  const exact = current ? [current.base] : ['/admin'];

  // Fecha a lista de aplicações ao trocar de página.
  useEffect(() => { if (menu.current) menu.current.open = false; }, [pathname]);

  const switcherOptions = apps.filter((a) => a.home);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      {(switcherOptions.length > 0 || current) && (
        <details ref={menu} className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-white/15 [&::-webkit-details-marker]:hidden"
            aria-label="Escolher aplicação">
            {current ? <AppIcon appKey={current.key} size="sm" /> : <LayoutGrid className="size-4 text-slate-300" aria-hidden="true" />}
            <span>{current ? current.name : 'Todas as aplicações'}</span>
            <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="absolute left-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-800 shadow-lg">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Aplicações</p>
            {switcherOptions.map((a) => (
              <Link key={a.key} href={a.home} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50">
                <AppIcon appKey={a.key} size="sm" />
                <span className="flex-1 font-medium">{a.name}</span>
                {current?.key === a.key && <Check className="size-4 text-brand-600" aria-hidden="true" />}
              </Link>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <Link href="/admin" className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50">
              <LayoutGrid className="size-4 text-slate-500" aria-hidden="true" /> Todas as aplicações
            </Link>
            {master && (
              <Link href="/admin/acessos" className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50">
                <Users className="size-4 text-slate-500" aria-hidden="true" /> Acessos
              </Link>
            )}
          </div>
        </details>
      )}
      {items.length > 0 && (
        <nav className="flex flex-wrap gap-1" aria-label={current ? `Menu do ${current.name}` : 'Área admin'}>
          {items.map((item) => {
            const active = isActive(pathname, item.href, exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
