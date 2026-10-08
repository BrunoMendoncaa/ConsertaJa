import { AppShell, SwitcherDisclosure } from '@/components/layout/app-shell';
import { requireStaff } from '@/lib/auth';
import { ROLES, MANAGER_ROLES, TECH_ROLES } from '@/lib/constants';
import { getMyAssistances } from '@/features/tenancy/queries';
import { switchAssistance } from '@/features/tenancy/actions';

export const metadata = { title: { default: 'Painel', template: '%s · Conserta Já' } };

export default async function PainelLayout({ children }) {
  const ctx = await requireStaff();
  const mine = await getMyAssistances();
  const isManager = MANAGER_ROLES.includes(ctx.role);

  const items = [
    { href: '/painel', label: 'Dashboard', icon: 'dashboard' },
    { href: '/painel/os', label: 'Ordens de serviço', icon: 'os' },
    { href: '/painel/orcamentos', label: 'Orçamentos', icon: 'budgets' },
    { href: '/painel/clientes', label: 'Clientes', icon: 'customers' },
    { href: '/painel/equipamentos', label: 'Equipamentos', icon: 'equipment' },
    { href: '/painel/caixa', label: isManager ? 'Caixa' : 'Meus lançamentos', icon: 'cash' },
    ...(TECH_ROLES.includes(ctx.role) ? [{ href: '/painel/fornecedores', label: 'Fornecedores', icon: 'suppliers' }] : []),
    ...(isManager
      ? [
          { href: '/painel/relatorios', label: 'Relatórios', icon: 'reports' },
          { href: '/painel/usuarios', label: 'Equipe', icon: 'users' },
          { href: '/painel/configuracoes', label: 'Configurações', icon: 'settings' },
        ]
      : []),
  ];

  const others = mine.filter((a) => a.id !== ctx.assistance.id);
  const switcher = others.length ? (
    <SwitcherDisclosure>
      <form action={switchAssistance} className="flex flex-col gap-1">
        {others.map((a) => (
          <button key={a.id} name="assistance_id" value={a.id} className="truncate rounded-md px-2 py-1 text-left text-xs text-slate-700 hover:bg-white">
            {a.name}
          </button>
        ))}
      </form>
    </SwitcherDisclosure>
  ) : null;

  return (
    <AppShell
      items={items}
      assistanceName={ctx.assistance.name}
      userName={ctx.profile?.full_name || ctx.user.email}
      roleLabel={ROLES[ctx.role]}
      switcher={switcher}
    >
      {children}
    </AppShell>
  );
}
