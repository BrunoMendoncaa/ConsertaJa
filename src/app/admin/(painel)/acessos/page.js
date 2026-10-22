import Link from 'next/link';
import { ShieldCheck, UserPlus, ChevronRight, FlaskConical, LayoutDashboard, Store } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Table, THead, TH, TBody, TD } from '@/components/ui/table';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { requireAdmin } from '@/features/admin/session';
import { listAdminAccounts, listTestAssistances, AccountsSetupError, AdminSetupError } from '@/features/admin/queries';
import { createAdminAccount } from '@/features/admin/account-actions';
import { createTestAccount } from '@/features/admin/test-account-actions';
import { TEST_PLANS } from '@/features/admin/format';
import { PlanChoice } from '@/features/admin/components/plan-choice';
import { SITE_URL } from '@/lib/supabase/env';
import { cn } from '@/lib/cn';
import { PermissionPicker } from '@/features/admin/components/permission-picker';
import { PERMISSIONS, normalizePermissions, permissionLabel } from '@/features/admin/permissions';
import { formatDateTime } from '@/lib/dates';

export const metadata = { title: 'Acessos' };

function PermissionSummary({ permissions }) {
  const list = normalizePermissions(permissions);
  if (!list.length) return <span className="text-slate-400">Nenhuma permissão</span>;
  if (list.length === PERMISSIONS.length) return <Badge tone="emerald">Tudo liberado</Badge>;
  return (
    <span className="flex flex-wrap gap-1">
      {list.slice(0, 3).map((k) => <Badge key={k} tone="slate">{permissionLabel(k)}</Badge>)}
      {list.length > 3 && <Badge tone="slate">+{list.length - 3}</Badge>}
    </span>
  );
}

function StatusCell({ account }) {
  if (!account.active) return <Badge tone="red">Desativado</Badge>;
  if (account.must_change_password) return <Badge tone="amber">Falta trocar a senha</Badge>;
  return <Badge tone="emerald">Ativo</Badge>;
}

const TABS = [
  ['admin', 'Painel admin', LayoutDashboard],
  ['aplicacao', 'Aplicação (contas de teste)', Store],
];

function Tabs({ current }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Tipo de acesso">
      {TABS.map(([k, label, Icon]) => (
        <Link key={k} href={k === 'admin' ? '/admin/acessos' : `/admin/acessos?tipo=${k}`} aria-current={k === current ? 'page' : undefined}
          className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
            k === current ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>
          <Icon className="size-4" aria-hidden="true" /> {label}
        </Link>
      ))}
    </nav>
  );
}

export default async function AdminAccessPage({ searchParams }) {
  const session = await requireAdmin('master');
  const sp = await searchParams;
  const tab = sp?.tipo === 'aplicacao' ? 'aplicacao' : 'admin';

  return (
    <>
      <PageHeader title="Acessos" description="Quem entra na área admin e as contas de teste da aplicação." />
      <Tabs current={tab} />
      {tab === 'admin'
        ? <AdminAccounts session={session} />
        : <TestAccounts deleted={typeof sp?.excluida === 'string' ? sp.excluida.slice(0, 120) : null} keptLogins={Number(sp?.logins_mantidos) || 0} />}
    </>
  );
}

async function AdminAccounts({ session }) {
  let accounts = [];
  let setupMessage = null;
  try {
    accounts = await listAdminAccounts();
  } catch (err) {
    if (!(err instanceof AccountsSetupError)) throw err;
    setupMessage = err.message;
  }

  return (
    <>
      {setupMessage && (
        <Alert variant="warning" title="Falta ativar os acessos" className="mb-6">
          {setupMessage} Abra o SQL Editor do Supabase, cole o arquivo
          <code className="mx-1 font-mono text-xs">supabase/migrations/20261021120000_acessos_admin.sql</code>
          e clique em Run.
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader title="Acessos ao painel admin" description={`${accounts.length + 1} acesso(s), contando o master.`} />
        <ul className="divide-y divide-slate-100 md:hidden">
          <li className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="min-w-0">
              <span className="block font-medium text-slate-900">{session.username}</span>
              <span className="block text-xs text-slate-500">Master · tudo liberado</span>
            </span>
            <ShieldCheck className="size-5 text-emerald-600" aria-hidden="true" />
          </li>
          {accounts.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/acessos/${a.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">{a.full_name}</span>
                  <span className="block text-xs text-slate-500">{a.username} · {normalizePermissions(a.permissions).length} permissão(ões)</span>
                  <span className="mt-1 block"><StatusCell account={a} /></span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <THead><tr><TH>Nome</TH><TH>Usuário</TH><TH>Pode</TH><TH>Situação</TH><TH>Último acesso</TH><TH><span className="sr-only">Editar</span></TH></tr></THead>
            <TBody>
              <tr>
                <TD className="font-medium text-slate-900">Você</TD>
                <TD className="font-mono text-xs">{session.username}</TD>
                <TD><Badge tone="emerald">Master · tudo liberado</Badge></TD>
                <TD><Badge tone="emerald">Ativo</Badge></TD>
                <TD className="text-xs text-slate-500">Senha nas variáveis da Vercel</TD>
                <TD />
              </tr>
              {accounts.map((a) => (
                <tr key={a.id} className="align-top">
                  <TD className="font-medium text-slate-900">{a.full_name}</TD>
                  <TD className="font-mono text-xs">{a.username}</TD>
                  <TD><PermissionSummary permissions={a.permissions} /></TD>
                  <TD><StatusCell account={a} /></TD>
                  <TD className="whitespace-nowrap text-sm text-slate-600">{a.last_login_at ? formatDateTime(a.last_login_at) : 'nunca'}</TD>
                  <TD className="text-right">
                    <Link href={`/admin/acessos/${a.id}`} className="text-sm font-medium text-brand-700 hover:underline">Editar</Link>
                  </TD>
                </tr>
              ))}
            </TBody>
          </Table>
        </div>
        {!accounts.length && !setupMessage && (
          <CardContent className="border-t border-slate-100 text-sm text-slate-500">Só a conta master por enquanto. Crie um acesso abaixo.</CardContent>
        )}
      </Card>

      {!setupMessage && (
        <Card>
          <CardHeader
            title={<span className="inline-flex items-center gap-2"><UserPlus className="size-5 text-brand-600" aria-hidden="true" /> Novo acesso ao painel admin</span>}
            description="A pessoa entra em tecnofix.pro/admin com o usuário e a senha abaixo e troca a senha no primeiro acesso."
          />
          <CardContent>
            <ActionForm action={createAdminAccount} resetOnSuccess className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Nome" name="full_name" required>
                  <Input id="full_name" name="full_name" maxLength={80} autoComplete="off" placeholder="Ex.: Maria Souza" />
                </Field>
                <Field label="Usuário" name="username" required hint="Minúsculas, números, ponto, hífen ou _.">
                  <Input id="username" name="username" maxLength={40} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Ex.: maria.souza" />
                </Field>
                <Field label="Senha inicial" name="password" required hint="Mínimo de 12 caracteres.">
                  <Input id="password" name="password" type="password" maxLength={200} autoComplete="new-password" />
                </Field>
              </div>
              <PermissionPicker idPrefix="novo" />
              <SubmitButton pendingText="Criando...">Criar acesso</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      )}
    </>
  );
}

async function TestAccounts({ deleted, keptLogins }) {
  let tests = [];
  let setupMessage = null;
  try {
    tests = await listTestAssistances();
  } catch (err) {
    if (!(err instanceof AdminSetupError)) throw err;
    setupMessage = err.message;
  }
  const host = SITE_URL.replace(/^https?:\/\//, '');

  return (
    <>
      {deleted && (
        <Alert variant="success" title="Conta de teste excluída" className="mb-6">
          {deleted} foi excluída com as OS, clientes, fotos e logins que só existiam nela.
          {keptLogins > 0 && ` ${keptLogins} login(s) não puderam ser apagados; veja em Usuários.`}
        </Alert>
      )}
      {setupMessage && <Alert variant="warning" title="Falta configurar o banco" className="mb-6">{setupMessage}</Alert>}

      <Card className="mb-6">
        <CardHeader
          title="Contas de teste da aplicação"
          description="Ficam fora dos números, das listas de assistências e da planilha. Não têm cobrança e só elas podem ser excluídas."
        />
        {tests.length ? (
          <ul className="divide-y divide-slate-100">
            {tests.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/assistencias/${a.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-slate-900">{a.name}</span>
                      <Badge tone={a.test_plan === 'free' ? 'orange' : 'violet'}>{TEST_PLANS[a.test_plan]?.label || a.test_plan}</Badge>
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {a.owner_email || 'sem login'} · {a.orders} OS · criada em {formatDateTime(a.created_at)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <CardContent className="border-t border-slate-100 text-sm text-slate-500">
            Nenhuma conta de teste. Crie uma abaixo, ou abra uma assistência em Assistências e use &quot;Marcar como conta de teste&quot;.
          </CardContent>
        )}
      </Card>

      {!setupMessage && (
        <Card>
          <CardHeader
            title={<span className="inline-flex items-center gap-2"><FlaskConical className="size-5 text-violet-600" aria-hidden="true" /> Nova conta de teste</span>}
            description={`A conta já nasce com a assistência criada. Entre em ${host}/entrar com o e-mail e a senha abaixo.`}
          />
          <CardContent>
            <ActionForm action={createTestAccount} resetOnSuccess className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nome da assistência" name="assistance_name" required>
                  <Input id="assistance_name" name="assistance_name" maxLength={120} autoComplete="off" placeholder="Ex.: Loja Teste Centro" />
                </Field>
                <Field label="Nome da pessoa" name="full_name" required>
                  <Input id="full_name" name="full_name" maxLength={80} autoComplete="off" placeholder="Ex.: Bruno" />
                </Field>
                <Field label="E-mail do login" name="email" required hint="Pode ser um e-mail só para teste; nenhuma mensagem é enviada.">
                  <Input id="email" name="email" type="email" maxLength={200} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Ex.: teste1@tecnofix.pro" />
                </Field>
                <Field label="Senha" name="password" required hint="Mínimo de 8 caracteres.">
                  <Input id="password" name="password" type="password" maxLength={72} autoComplete="new-password" />
                </Field>
              </div>
              <PlanChoice name="plan" defaultValue="pro" />
              <SubmitButton pendingText="Criando...">Criar conta de teste</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      )}
    </>
  );
}
