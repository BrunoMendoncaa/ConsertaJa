import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { requireAdmin } from '@/features/admin/session';
import { getAdminAccount, AccountsSetupError } from '@/features/admin/queries';
import { updateAdminAccount, resetAdminPassword, deleteAdminAccount } from '@/features/admin/account-actions';
import { PermissionPicker } from '@/features/admin/components/permission-picker';
import { ACTION_LABELS, actionDetail } from '@/features/admin/components/bits';
import { normalizePermissions } from '@/features/admin/permissions';
import { formatDateTime } from '@/lib/dates';

export const metadata = { title: 'Editar acesso' };

function Item({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{children ?? '—'}</dd>
    </div>
  );
}

export default async function AdminAccessEditPage({ params }) {
  await requireAdmin('master');
  const { id } = await params;
  let account;
  try {
    account = await getAdminAccount(id);
  } catch (err) {
    if (err instanceof AccountsSetupError) notFound();
    throw err;
  }
  if (!account) notFound();

  return (
    <>
      <PageHeader
        title={account.full_name}
        description={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{account.username}</span>{!account.active && <Badge tone="red">Desativado</Badge>}{account.active && account.must_change_password && <Badge tone="amber">Falta trocar a senha</Badge>}</span>}
        back={{ href: '/admin/acessos', label: 'Acessos' }}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="h-fit xl:col-span-2">
          <CardHeader title="Nome e permissões" description="As mudanças valem no próximo clique da pessoa, sem precisar sair e entrar." />
          <CardContent>
            <ActionForm action={updateAdminAccount} className="space-y-6">
              <input type="hidden" name="id" value={account.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nome" name="full_name" required>
                  <Input id="full_name" name="full_name" maxLength={80} defaultValue={account.full_name} />
                </Field>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-slate-700">Situação</p>
                  <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="active" defaultChecked={account.active} className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                    Acesso ativo (desmarque para bloquear a entrada)
                  </label>
                </div>
              </div>
              <PermissionPicker value={normalizePermissions(account.permissions)} idPrefix="editar" />
              <SubmitButton pendingText="Salvando...">Salvar acesso</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Detalhes" />
            <CardContent>
              <dl className="space-y-3">
                <Item label="Último acesso">{account.last_login_at ? formatDateTime(account.last_login_at) : 'nunca'}</Item>
                <Item label="Criado em">{formatDateTime(account.created_at)} por {account.created_by}</Item>
                <Item label="Senha alterada em">{formatDateTime(account.password_changed_at)}</Item>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Redefinir senha" description="Para quando a pessoa esqueceu a senha. Ela sai da área admin e troca a senha no próximo acesso." />
            <CardContent>
              <ActionForm action={resetAdminPassword} resetOnSuccess className="space-y-3">
                <input type="hidden" name="id" value={account.id} />
                <Field label="Nova senha" name="password" hint="Mínimo de 12 caracteres.">
                  <Input id="reset-password" name="password" type="password" maxLength={200} autoComplete="new-password" />
                </Field>
                <SubmitButton size="sm" variant="outline" pendingText="Salvando...">Redefinir senha</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Excluir acesso" description="Remove a conta. O histórico do que ela fez continua registrado." />
            <CardContent>
              <ActionForm action={deleteAdminAccount} confirm={`Excluir o acesso de ${account.full_name} (${account.username})?`}>
                <input type="hidden" name="id" value={account.id} />
                <SubmitButton size="sm" variant="danger" pendingText="Excluindo...">Excluir acesso</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Histórico" />
            <ul className="divide-y divide-slate-100 text-sm">
              {account.log.map((r) => (
                <li key={r.id} className="px-5 py-2.5">
                  <p className="text-slate-900">{ACTION_LABELS[r.action] || r.action}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(r.created_at)} · por {r.admin_username}{actionDetail(r) && ` · ${actionDetail(r)}`}</p>
                </li>
              ))}
              {!account.log.length && <li className="px-5 py-3 text-slate-500">Nada registrado ainda.</li>}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
