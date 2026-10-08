import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { signIn } from '@/features/auth/actions';

export const metadata = { title: 'Entrar' };

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  const next = typeof sp?.proximo === 'string' ? sp.proximo : '';
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Entrar</h1>
      <p className="mt-1 text-sm text-slate-500">Acesse o painel da sua assistência.</p>
      {sp?.erro === 'link' && (
        <Alert variant="warning" className="mt-4">O link expirou ou já foi usado. Entre com sua senha ou peça um novo.</Alert>
      )}
      <ActionForm action={signIn} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="E-mail" name="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Senha" name="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full" pendingText="Entrando...">Entrar</SubmitButton>
      </ActionForm>
      <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/recuperar-senha" className="text-slate-600 hover:text-slate-900">Esqueci minha senha</Link>
        <Link href={`/cadastro${next ? `?proximo=${encodeURIComponent(next)}` : ''}`} className="font-medium text-brand-700 hover:underline">
          Criar conta
        </Link>
      </div>
    </>
  );
}
