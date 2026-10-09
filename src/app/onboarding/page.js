import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/layout/logo';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { getStaffContext } from '@/lib/auth';
import { SITE_URL } from '@/lib/supabase/env';
import { createAssistance, switchAssistance } from '@/features/tenancy/actions';
import { getMyAssistances } from '@/features/tenancy/queries';
import { SlugFields } from '@/features/tenancy/components/slug-fields';
import { ROLES } from '@/lib/constants';

export const metadata = { title: 'Cadastrar assistência' };

export default async function OnboardingPage({ searchParams }) {
  const sp = await searchParams;
  const ctx = await getStaffContext();
  if (!ctx.user) redirect('/entrar?proximo=/onboarding');
  if (ctx.assistance && !sp?.nova) redirect('/painel');
  const mine = await getMyAssistances();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <Logo className="mb-8" />
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold text-slate-900">Cadastre sua assistência</h1>
        <p className="mt-1 text-sm text-slate-500">
          Você será o proprietário e poderá convidar técnicos e atendentes depois.
        </p>
        <ActionForm action={createAssistance} className="mt-6 space-y-4">
          <SlugFields siteUrl={SITE_URL} />
          <SubmitButton className="w-full" pendingText="Criando...">Criar assistência</SubmitButton>
        </ActionForm>

        {mine.length > 0 && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-sm font-medium text-slate-700">Ou entre numa assistência em que você já está:</p>
            <ul className="mt-3 space-y-2">
              {mine.map((a) => (
                <li key={a.id}>
                  <form action={switchAssistance}>
                    <input type="hidden" name="assistance_id" value={a.id} />
                    <button className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50">
                      <span className="font-medium text-slate-900">{a.name}</span>
                      <span className="text-slate-500">{ROLES[a.role]}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-6 text-center text-xs text-slate-500">
          Recebeu um convite? Abra o link enviado pela sua assistência. ·{' '}
          <form action="/sair" method="post" className="inline"><button className="underline">Sair</button></form>
        </div>
      </div>
      <Link href="/" className="mt-6 text-xs text-slate-400 hover:text-slate-600">tecnofix</Link>
    </main>
  );
}
