import { redirect } from 'next/navigation';
import { Wrench, ShieldCheck } from 'lucide-react';
import { getAdminSession, adminConfig } from '@/features/admin/session';
import { adminSignIn } from '@/features/admin/actions';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

export const metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect('/admin');
  const configured = Boolean(adminConfig());

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Wrench className="size-4" aria-hidden="true" />
          </span>
          <span>Tecno<span className="text-accent-500">Fix</span></span>
          <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Admin</span>
        </div>
        <h1 className="mt-6 text-xl font-semibold text-slate-900">Área administrativa</h1>
        <p className="mt-1 text-sm text-slate-500">Acesso restrito à equipe do TecnoFix.</p>

        {configured ? (
          <ActionForm action={adminSignIn} className="mt-6 space-y-4">
            <Field label="Usuário" name="username">
              <Input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} />
            </Field>
            <Field label="Senha" name="password">
              <Input id="password" name="password" type="password" autoComplete="current-password" />
            </Field>
            <SubmitButton className="w-full" pendingText="Entrando...">Entrar</SubmitButton>
          </ActionForm>
        ) : (
          <Alert variant="info" className="mt-6">
            Acesso ainda não configurado. Rode <code className="font-mono">npm run admin:senha</code> no seu computador e
            cadastre as variáveis na Vercel (veja a seção &quot;Área admin&quot; do README).
          </Alert>
        )}
        <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="size-3.5" aria-hidden="true" /> Tentativas erradas são limitadas e registradas.
        </p>
      </div>
    </main>
  );
}
