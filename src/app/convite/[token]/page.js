import { Logo } from '@/components/layout/logo';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { ButtonLink } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth';
import { acceptInvitation } from '@/features/tenancy/actions';
import { ROLES } from '@/lib/constants';

export const metadata = { title: 'Convite' };

export default async function InvitationPage({ params }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data }, user] = await Promise.all([
    supabase.rpc('invitation_preview', { p_token: token }),
    getUser(),
  ]);
  const invite = data?.[0];
  const next = encodeURIComponent(`/convite/${token}`);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <Logo className="mb-8" />
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {!invite || !invite.is_valid ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Convite indisponível</h1>
            <p className="mt-2 text-sm text-slate-500">Este convite expirou, foi cancelado ou já foi usado. Peça um novo link à assistência.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Você foi convidado</h1>
            <p className="mt-2 text-sm text-slate-600">
              Entre para a equipe da <strong>{invite.assistance_name}</strong> como <strong>{ROLES[invite.role]}</strong>.
            </p>
            <p className="mt-1 text-xs text-slate-500">Convite para {invite.email}</p>

            {user ? (
              user.email?.toLowerCase() === invite.email ? (
                <ActionForm action={acceptInvitation} className="mt-6">
                  <input type="hidden" name="token" value={token} />
                  <SubmitButton className="w-full" pendingText="Entrando...">Aceitar convite</SubmitButton>
                </ActionForm>
              ) : (
                <Alert variant="warning" className="mt-6">
                  Você está conectado como {user.email}. Saia e entre com {invite.email} para aceitar.
                  <form action="/sair" method="post" className="mt-2"><button className="font-medium underline">Sair</button></form>
                </Alert>
              )
            ) : (
              <div className="mt-6 grid gap-2">
                <ButtonLink href={`/cadastro?proximo=${next}`}>Criar conta com {invite.email}</ButtonLink>
                <ButtonLink href={`/entrar?proximo=${next}`} variant="outline">Já tenho conta</ButtonLink>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
