import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { createInvitation, revokeInvitation, updateMember } from '@/features/tenancy/actions';
import { ROLES, MANAGER_ROLES } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { InvitationResult } from './invitation-result';

export const metadata = { title: 'Equipe' };

const ROLE_HELP = {
  owner: 'Tudo, inclusive equipe, configurações e financeiro.',
  admin: 'Como o proprietário, exceto convidar administradores e mexer em proprietários.',
  technician: 'OS, diagnóstico, orçamentos, fotos e compra de peças. Não vê o caixa.',
  attendant: 'Clientes, abertura e entrega de OS, recebimentos e decisões do cliente no balcão.',
};

export default async function TeamPage() {
  const { supabase, role, user } = await requireStaff(MANAGER_ROLES);
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.rpc('team_members'),
    supabase.from('assistance_invitations').select('id, email, role, created_at, expires_at')
      .is('accepted_at', null).is('revoked_at', null).order('created_at', { ascending: false }),
  ]);
  const roleOptions = role === 'owner' ? ['owner', 'admin', 'technician', 'attendant'] : ['technician', 'attendant'];

  return (
    <>
      <PageHeader title="Equipe" description="Quem acessa o painel da assistência e o que cada um pode fazer." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Membros" />
            <ul className="divide-y divide-slate-100">
              {(members || []).map((m) => {
                const self = m.user_id === user.id;
                const editable = !self && (role === 'owner' || m.role !== 'owner');
                return (
                  <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className={`font-medium ${m.active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{m.full_name || m.email}{self && ' (você)'}</p>
                      <p className="text-sm text-slate-500">{m.email} · desde {formatDate(m.created_at)}</p>
                    </div>
                    {editable ? (
                      <ActionForm action={updateMember} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <Select name="role" defaultValue={m.role} className="h-9 w-40">
                          {(roleOptions.includes(m.role) ? roleOptions : [m.role, ...roleOptions]).map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}
                        </Select>
                        <Select name="active" defaultValue={String(m.active)} className="h-9 w-32">
                          <option value="true">Ativo</option>
                          <option value="false">Desativado</option>
                        </Select>
                        <SubmitButton size="sm" variant="outline">Salvar</SubmitButton>
                      </ActionForm>
                    ) : <Badge tone={m.role === 'owner' ? 'indigo' : 'slate'}>{ROLES[m.role]}</Badge>}
                  </li>
                );
              })}
            </ul>
          </Card>

          {invites?.length > 0 && (
            <Card>
              <CardHeader title="Convites pendentes" />
              <ul className="divide-y divide-slate-100">
                {invites.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{i.email}</p>
                      <p className="text-slate-500">{ROLES[i.role]} · expira em {formatDate(i.expires_at)}</p>
                    </div>
                    <ActionForm action={revokeInvitation}>
                      <input type="hidden" name="id" value={i.id} />
                      <SubmitButton size="sm" variant="ghost" className="text-red-600">Cancelar convite</SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="O que cada função pode fazer" />
            <CardContent>
              <dl className="space-y-2 text-sm">
                {Object.entries(ROLE_HELP).map(([k, v]) => (
                  <div key={k}><dt className="inline font-medium text-slate-900">{ROLES[k]}: </dt><dd className="inline text-slate-600">{v}</dd></div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Convidar pessoa" description="Gere um link e envie por WhatsApp ou e-mail." />
          <CardContent>
            <ActionForm action={createInvitation} resetOnSuccess className="space-y-4">
              <Field label="E-mail da pessoa" name="email" required>
                <Input id="email" name="email" type="email" />
              </Field>
              <Field label="Função" name="role" required>
                <Select id="role" name="role" defaultValue="technician">
                  {(role === 'owner' ? ['admin', 'technician', 'attendant'] : ['technician', 'attendant']).map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}
                </Select>
              </Field>
              <SubmitButton className="w-full" pendingText="Gerando...">Gerar convite</SubmitButton>
              <InvitationResult />
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
