import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { signUp } from '@/features/auth/actions';

export const metadata = { title: 'Criar conta' };

export default async function SignUpPage({ searchParams }) {
  const sp = await searchParams;
  const next = typeof sp?.proximo === 'string' ? sp.proximo : '';
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Criar conta</h1>
      <p className="mt-1 text-sm text-slate-500">14 dias grátis, sem cartão. Depois você cadastra sua assistência ou aceita um convite da equipe.</p>
      <ActionForm action={signUp} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Seu nome" name="full_name">
          <Input id="full_name" name="full_name" autoComplete="name" required />
        </Field>
        <Field label="E-mail" name="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Senha" name="password" hint="Mínimo de 8 caracteres.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton className="w-full" pendingText="Criando...">Criar conta</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-600">
        Já tem conta?{' '}
        <Link href={`/entrar${next ? `?proximo=${encodeURIComponent(next)}` : ''}`} className="font-medium text-brand-700 hover:underline">Entrar</Link>
      </p>
    </>
  );
}
