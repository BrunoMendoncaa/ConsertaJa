import { redirect } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { updatePassword } from '@/features/auth/actions';
import { getUser } from '@/lib/auth';

export const metadata = { title: 'Nova senha' };

export default async function NewPasswordPage() {
  const user = await getUser();
  if (!user) redirect('/entrar?erro=link');
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Criar nova senha</h1>
      <p className="mt-1 text-sm text-slate-500">{user.email}</p>
      <ActionForm action={updatePassword} className="mt-6 space-y-4">
        <Field label="Nova senha" name="password" hint="Mínimo de 8 caracteres.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Repita a nova senha" name="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton className="w-full" pendingText="Salvando...">Salvar nova senha</SubmitButton>
      </ActionForm>
    </>
  );
}
