'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/** Menu da área admin. As seções chegam do servidor já filtradas pelas permissões da conta. */
export function AdminNav({ items }) {
  const pathname = usePathname();
  if (!items?.length) return null;
  return (
    <nav className="flex flex-wrap gap-1" aria-label="Área admin">
      {items.map((item) => {
        const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
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
  );
}
