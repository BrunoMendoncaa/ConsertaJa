import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { getPortalAssistance, portalCall } from '@/features/portal/queries';
import { portalLogin } from '@/features/portal/actions';

export default async function PortalLoginPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const a = await getPortalAssistance(slug);

  // Já tem sessão válida? Vai direto para a lista.
  const me = await portalCall(slug, 'portal_me');
  if (!me.expired && me.data?.length) redirect(`/a/${slug}/os`);

  const code = typeof sp?.c === 'string' ? sp.c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Acompanhe seu conserto</h1>
        <p className="mt-1 text-slate-600">{a?.welcome_message || 'Veja o andamento, o orçamento e aprove pelo celular.'}</p>
      </div>

      {sp?.expirada && <Alert variant="info">Sua sessão expirou. Entre novamente.</Alert>}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <ActionForm action={portalLogin.bind(null, slug)} className="space-y-4">
          <Field label="Seu telefone (o mesmo informado na loja)" name="phone">
            <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 98765-4321" className="h-12 text-base" />
          </Field>
          <Field label="Código de acesso" name="code" hint="Está no comprovante de entrada ou na mensagem que você recebeu.">
            <Input id="code" name="code" defaultValue={code} autoCapitalize="characters" autoComplete="one-time-code" maxLength={6}
              placeholder="Ex.: K7M4QX" className="h-12 font-mono text-base uppercase tracking-[0.3em]" />
          </Field>
          <SubmitButton size="lg" className="w-full bg-[var(--brand)] hover:bg-[var(--brand)] hover:opacity-90" pendingText="Entrando...">
            Ver meus equipamentos
          </SubmitButton>
        </ActionForm>
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
        Seus dados ficam protegidos: só quem tem o telefone cadastrado e o código da OS consegue ver as informações.
      </p>
    </div>
  );
}
