import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { updateProfile } from '@/features/tenancy/actions';
import { updatePassword } from '@/features/auth/actions';
import { getMyAssistances } from '@/features/tenancy/queries';
import { ROLES } from '@/lib/constants';

export const metadata = { title: 'Minha conta' };

export default async function AccountPage() {
  const { profile, user } = await requireStaff();
  const mine = await getMyAssistances();
  return (
    <>
      <PageHeader title="Minha conta" description={user.email} />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Dados pessoais" />
          <CardContent>
            <ActionForm action={updateProfile} className="space-y-4">
              <Field label="Nome" name="full_name"><Input id="full_name" name="full_name" defaultValue={profile?.full_name || ''} /></Field>
              <Field label="Telefone" name="phone"><Input id="phone" name="phone" type="tel" defaultValue={profile?.phone || ''} /></Field>
              <SubmitButton>Salvar</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Trocar senha" />
          <CardContent>
            <ActionForm action={updatePassword} className="space-y-4">
              <Field label="Nova senha" name="password" hint="Mínimo de 8 caracteres."><Input id="password" name="password" type="password" autoComplete="new-password" /></Field>
              <Field label="Repita a nova senha" name="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" /></Field>
              <SubmitButton>Trocar senha</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Minhas assistências" />
          <CardContent>
            <ul className="space-y-1 text-sm">
              {mine.map((a) => (
                <li key={a.id} className="flex justify-between"><span className="text-slate-900">{a.name}{a.is_active && ' (ativa)'}</span><span className="text-slate-500">{ROLES[a.role]}</span></li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-500">Quer abrir outra assistência? <Link href="/onboarding?nova=1" className="font-medium text-brand-700 hover:underline">Cadastrar nova</Link></p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
