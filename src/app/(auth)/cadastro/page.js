import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { signUp } from '@/features/auth/actions';
import { googleEnabled, browserInfo } from '@/features/auth/google';
import { GoogleButton, OrDivider } from '@/features/auth/components/google-button';
import { GoogleError } from '@/features/auth/components/google-error';

// Também abre em /anuncio/cadastro (botão do anúncio, ver next.config.mjs): o endereço oficial é /cadastro.
export const metadata = { title: 'Criar conta', alternates: { canonical: '/cadastro' } };

export default async function SignUpPage({ searchParams }) {
  const sp = await searchParams;
  const next = typeof sp?.proximo === 'string' ? sp.proximo : '';
  const [google, browser] = await Promise.all([googleEnabled(), browserInfo()]);
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Criar conta grátis</h1>
      <p className="mt-1 text-sm text-slate-500">Sistema de OS para assistência técnica. Grátis, sem prazo e sem cartão (os 14 primeiros dias têm o Pro completo). Depois você cadastra sua assistência ou aceita um convite da equipe.</p>
      <GoogleError code={sp?.erro} />
      {google && (
        <>
          <div className="mt-6"><GoogleButton mode="cadastro" next={next} {...browser} /></div>
          <OrDivider />
        </>
      )}
      <ActionForm action={signUp} className={google ? 'space-y-4' : 'mt-6 space-y-4'}>
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
        <SubmitButton className="w-full" pendingText="Criando..." data-track="cadastro-criar-conta">Criar conta</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-600">
        Já tem conta?{' '}
        <Link href={`/entrar${next ? `?proximo=${encodeURIComponent(next)}` : ''}`} className="font-medium text-brand-700 hover:underline">Entrar</Link>
      </p>
      {!next && (
        <p className="mt-2 text-center text-sm text-slate-500">
          <Link href="/" data-track="cadastro-como-funciona" className="hover:text-slate-800 hover:underline">Ver como o sistema funciona</Link>
        </p>
      )}
    </>
  );
}
