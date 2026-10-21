import { KeyRound } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { requireAdmin } from '@/features/admin/session';
import { changeOwnPassword } from '@/features/admin/account-actions';

export const metadata = { title: 'Minha senha' };

export default async function AdminMyPasswordPage() {
  const session = await requireAdmin(null, { allowPasswordChange: true });

  if (session.master) {
    return (
      <>
        <PageHeader title="Minha senha" />
        <Alert variant="info" title="Conta master">
          A senha da conta master fica nas variáveis da Vercel. Para trocar, rode <code className="font-mono">npm run admin:senha</code> no
          seu computador e substitua as 3 variáveis (veja a seção &quot;Área admin&quot; do README).
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Minha senha" description={`${session.name} · ${session.username}`} />
      <div className="max-w-lg">
        {session.mustChangePassword && (
          <Alert variant="warning" title="Crie sua senha para continuar" className="mb-6">
            Este é seu primeiro acesso (ou a senha foi redefinida). Troque a senha que você recebeu por uma só sua.
          </Alert>
        )}
        <Card>
          <CardContent className="py-6">
            <ActionForm action={changeOwnPassword} className="space-y-4">
              <Field label={session.mustChangePassword ? 'Senha que você recebeu' : 'Senha atual'} name="current_password">
                <Input id="current_password" name="current_password" type="password" autoComplete="current-password" maxLength={200} />
              </Field>
              <Field label="Nova senha" name="password" hint="Mínimo de 12 caracteres.">
                <Input id="password" name="password" type="password" autoComplete="new-password" maxLength={200} />
              </Field>
              <Field label="Repita a nova senha" name="password_again">
                <Input id="password_again" name="password_again" type="password" autoComplete="new-password" maxLength={200} />
              </Field>
              <SubmitButton pendingText="Salvando..."><KeyRound className="size-4" aria-hidden="true" /> Salvar senha</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
