'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ClipboardList, Users, Smartphone, FileText, Wallet, ChartColumn, UserCog,
  Settings, LogOut, Menu, X, Plus, Truck, ChevronDown, CreditCard,
} from 'lucide-react';
import { Logo } from './logo';
import { cn } from '@/lib/cn';

const ICONS = {
  dashboard: LayoutDashboard, os: ClipboardList, customers: Users, equipment: Smartphone,
  budgets: FileText, cash: Wallet, reports: ChartColumn, users: UserCog, settings: Settings, suppliers: Truck,
  plan: CreditCard,
};

function NavLinks({ items, onNavigate }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === '/painel' ? pathname === '/painel' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ items, assistanceName, userName, roleLabel, switcher, planLabel, planHref, notice, children }) {
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <Link href="/painel" className="px-2" onClick={() => setOpen(false)}>
        <Logo />
      </Link>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-slate-900" title={assistanceName}>{assistanceName}</p>
        <p className="text-xs text-slate-500">{roleLabel}</p>
        {planLabel && (planHref ? (
          <Link href={planHref} onClick={() => setOpen(false)} className="mt-1 block text-xs font-medium text-brand-700 hover:underline">{planLabel}</Link>
        ) : <p className="mt-1 text-xs font-medium text-slate-600">{planLabel}</p>)}
        {switcher}
      </div>

      <Link
        href="/painel/os/nova"
        onClick={() => setOpen(false)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
      >
        <Plus className="size-4" aria-hidden="true" /> Nova OS
      </Link>

      <div className="flex-1 overflow-y-auto">
        <NavLinks items={items} onNavigate={() => setOpen(false)} />
      </div>

      <div className="border-t border-slate-200 pt-4">
        <Link href="/painel/minha-conta" onClick={() => setOpen(false)} className="block truncate px-3 text-sm font-medium text-slate-800 hover:text-brand-700">
          {userName || 'Minha conta'}
        </Link>
        <form action="/sair" method="post" className="mt-1">
          <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <LogOut className="size-4" aria-hidden="true" /> Sair
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white print:hidden lg:fixed lg:inset-y-0 lg:block">
        {sidebar}
      </aside>

      {/* Mobile: barra superior */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden lg:hidden">
        <Link href="/painel"><Logo /></Link>
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 lg:pl-64 print:pl-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">{notice}{children}</div>
      </main>
    </div>
  );
}

export function SwitcherDisclosure({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
        Trocar assistência <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
