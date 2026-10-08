import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { requestPasswordReset } from '@/features/auth/actions';

export const metadata = { title: 'Recuperar senha' };

export default function ResetRequestPage() {
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Recuperar senha</h1>
      <p className="mt-1 text-sm text-slate-500">Enviaremos um link para você criar uma nova senha.</p>
      <ActionForm action={requestPasswordReset} className="mt-6 space-y-4">
        <Field label="E-mail" name="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <SubmitButton className="w-full" pendingText="Enviando...">Enviar link</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm"><Link href="/entrar" className="text-slate-600 hover:text-slate-900">Voltar para o login</Link></p>
    </>
  );
}
