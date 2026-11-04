import Link from 'next/link';
import { Mail, Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, THead, TH, TBody, TD } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert } from '@/components/ui/alert';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { listUsers, recentUserEmails, AdminSetupError } from '@/features/admin/queries';
import { sendUserEmail } from '@/features/admin/user-email-actions';
import { USER_EMAILS, userEmailKind } from '@/features/admin/user-emails';
import { can } from '@/features/admin/permissions';
import { emailConfigured } from '@/lib/email';
import { logError } from '@/lib/logger';
import { SetupNotice } from '@/features/admin/components/bits';
import { ROLES } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatPhone, whatsappLink } from '@/lib/phone';
import { cn } from '@/lib/cn';
import { requireAdmin } from '@/features/admin/session';

export const metadata = { title: 'Usuários' };

const FILTERS = [
  ['todos', 'Todos'],
  ['sem-assistencia', 'Sem assistência'],
  ['nao-confirmados', 'E-mail não confirmado'],
];

const SENT_LABEL = Object.fromEntries(Object.values(USER_EMAILS).map((e) => [e.action, e.sentLabel]));

/** Botão do e-mail que cabe para a pessoa (confirmação ou lembrete da assistência) e o último envio. */
function EmailAction({ user, last }) {
  const kind = userEmailKind(user);
  if (!kind) return null;
  const info = USER_EMAILS[kind];
  const lastText = last ? `Último e-mail (${SENT_LABEL[last.action] || 'e-mail'}): ${formatDateTime(last.at)} · ${last.by}` : null;
  return (
    <ActionForm action={sendUserEmail} className="mt-2" confirm={`${info.confirm(user.email)}${lastText ? `\n\n${lastText}` : ''}`}>
      <input type="hidden" name="user_id" value={user.id} />
      <input type="hidden" name="kind" value={kind} />
      <SubmitButton size="sm" variant="outline" pendingText="Enviando..." data-email={kind}>
        <Mail className="size-4" aria-hidden="true" /> {info.button}
      </SubmitButton>
      {lastText && <p className="mt-1 text-xs text-slate-500">{lastText}</p>}
    </ActionForm>
  );
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default async function AdminUsersPage({ searchParams }) {
  const session = await requireAdmin('usuarios_ver');
  const canEmail = can(session, 'usuarios_emails');
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp?.filtro) ? sp.filtro : 'todos';
  const q = typeof sp?.q === 'string' ? sp.q.slice(0, 80) : '';

  let all;
  try {
    all = await listUsers();
  } catch (err) {
    if (err instanceof AdminSetupError) return <><PageHeader title="Usuários" /><SetupNotice message={err.message} /></>;
    throw err;
  }
  // Último e-mail mandado para cada pessoa. Se a leitura falhar, a lista aparece do mesmo jeito.
  const sent = canEmail ? await recentUserEmails().catch((err) => { logError('admin.users.recentEmails', err); return {}; }) : {};
  const test = {
    todos: () => true,
    'sem-assistencia': (u) => !u.memberships?.length,
    'nao-confirmados': (u) => !u.email_confirmed_at,
  };
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, all.filter(test[k]).length]));
  const pendingEmail = canEmail && all.some((u) => userEmailKind(u));
  const rows = all.filter(test[filter]).filter((u) => !q || norm(`${u.full_name} ${u.email} ${u.phone}`).includes(norm(q)));

  return (
    <>
      <PageHeader title="Usuários" description="Todas as pessoas com conta no TecnoFix, inclusive quem ainda não criou assistência. Logins só de contas de teste ficam em Acessos → TecnoFix · contas de teste." />

      {pendingEmail && !emailConfigured() && (
        <Alert variant="warning" title="Envio de e-mails desligado" className="mb-4">
          Para os botões de e-mail funcionarem, crie a variável <code className="font-mono text-xs">RESEND_API_KEY</code> na Vercel
          (Settings → Environment Variables) com uma chave do Resend e faça um novo deploy.
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`?filtro=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={cn('rounded-full px-3 py-1.5 text-sm', k === filter ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>
            {label} <span className="tabular opacity-70">{counts[k]}</span>
          </Link>
        ))}
      </div>

      <form className="mb-6 flex flex-wrap gap-2" role="search">
        <input type="hidden" name="filtro" value={filter} />
        <label htmlFor="q" className="sr-only">Buscar</label>
        <Input id="q" name="q" defaultValue={q} placeholder="Nome, e-mail ou telefone" className="min-w-0 basis-full sm:max-w-md sm:flex-1 sm:basis-auto" />
        <Button type="submit" variant="outline"><Search className="size-4" aria-hidden="true" /> Buscar</Button>
      </form>

      <Card>
        {rows.length ? (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((u) => (
                <li key={u.id} className="px-4 py-3">
                  <p className="font-medium text-slate-900">{u.full_name || u.email}</p>
                  <p className="text-xs text-slate-500">{u.email}{u.phone ? ` · ${formatPhone(u.phone)}` : ''}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {u.memberships.map((m) => (
                      <Link key={m.assistance_id} href={`/admin/tecnofix/assistencias/${m.assistance_id}`}><Badge tone={m.is_test ? 'violet' : 'slate'}>{m.name} · {ROLES[m.role]}{m.is_test ? ' · teste' : ''}</Badge></Link>
                    ))}
                    {!u.memberships.length && <Badge tone="amber">Sem assistência</Badge>}
                    {!u.email_confirmed_at && <Badge tone="orange">E-mail não confirmado</Badge>}
                  </div>
                  {canEmail && <EmailAction user={u} last={sent[u.id]} />}
                  <p className="mt-1 text-xs text-slate-500">desde {formatDate(u.created_at)} · último acesso {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : 'nunca'}</p>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <Table>
                <THead><tr><TH>Pessoa</TH><TH>Assistências</TH><TH>Cadastro</TH><TH>Último acesso</TH></tr></THead>
                <TBody>
                  {rows.map((u) => (
                    <tr key={u.id} className="align-top">
                      <TD>
                        <p className="font-medium text-slate-900">{u.full_name || '—'}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                        {u.phone && (
                          <a href={whatsappLink(u.phone)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-emerald-700 hover:underline">{formatPhone(u.phone)}</a>
                        )}
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1.5">
                          {u.memberships.map((m) => (
                            <Link key={m.assistance_id} href={`/admin/tecnofix/assistencias/${m.assistance_id}`} className="hover:opacity-80">
                              <Badge tone={m.is_test ? 'violet' : m.role === 'owner' ? 'indigo' : 'slate'}>{m.name} · {ROLES[m.role]}{m.is_test ? ' · teste' : ''}{m.active ? '' : ' (desativado)'}</Badge>
                            </Link>
                          ))}
                          {!u.memberships.length && <Badge tone="amber">Sem assistência</Badge>}
                        </div>
                        {canEmail && <EmailAction user={u} last={sent[u.id]} />}
                      </TD>
                      <TD>
                        <p>{formatDate(u.created_at)}</p>
                        {!u.email_confirmed_at && <p className="text-xs text-orange-700">e-mail não confirmado</p>}
                      </TD>
                      <TD>{u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : <span className="text-slate-400">nunca</span>}</TD>
                    </tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </>
        ) : <EmptyState icon={Users} title="Ninguém neste filtro" />}
      </Card>
    </>
  );
}
