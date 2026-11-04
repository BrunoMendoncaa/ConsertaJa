'use server';

// Área admin → TecnoFix → Usuários: reenviar a confirmação de e-mail e lembrar de cadastrar
// a assistência (veja user-emails.js). Tudo é conferido aqui no servidor: a pessoa existe,
// o e-mail ainda cabe (não confirmou / não tem assistência) e não saiu o mesmo na última hora.

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE_URL } from '@/lib/supabase/env';
import { sendEmail, emailConfigured, emailErrorMessage, EMAIL_SETUP_MESSAGE } from '@/lib/email';
import { logError } from '@/lib/logger';
import { formatDateTime } from '@/lib/dates';
import { actionSession } from './session';
import { audit } from './audit';
import { USER_EMAILS, USER_EMAIL_COOLDOWN_MS, userEmailKind, userEmailContent, entryLink } from './user-emails';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mismatch(kind, current) {
  if (kind === 'confirmar') return 'Esta pessoa já confirmou o e-mail. Atualize a página.';
  if (current === 'confirmar') return 'Esta pessoa ainda não confirmou o e-mail. Mande a confirmação.';
  return 'Esta pessoa já cadastrou a assistência. Atualize a página.';
}

export async function sendUserEmail(_prev, formData) {
  const auth = await actionSession('usuarios_emails');
  if (auth.error) return { ok: false, error: auth.error };

  const userId = String(formData.get('user_id') || '');
  const kind = String(formData.get('kind') || '');
  if (!UUID_RE.test(userId) || !USER_EMAILS[kind]) return { ok: false, error: 'Pedido inválido.' };
  if (!emailConfigured()) return { ok: false, error: EMAIL_SETUP_MESSAGE };

  const db = createAdminClient();
  const { data: got, error: userError } = await db.auth.admin.getUserById(userId);
  if (userError || !got?.user) {
    if (userError && userError.status !== 404) logError('admin.userEmail.user', userError);
    return { ok: false, error: 'Pessoa não encontrada.' };
  }
  const user = got.user;
  if (user.banned_until && new Date(user.banned_until) > new Date()) return { ok: false, error: 'Este login está bloqueado.' };

  const { data: memberships, error: mError } = await db.from('assistance_members').select('assistance_id').eq('user_id', userId).limit(1);
  if (mError) {
    logError('admin.userEmail.members', mError);
    return { ok: false, error: 'Não foi possível conferir a pessoa agora. Tente de novo.' };
  }
  const current = userEmailKind({ email: user.email, email_confirmed_at: user.email_confirmed_at, memberships });
  if (current !== kind) return { ok: false, error: mismatch(kind, current) };

  // Mesmo e-mail para a mesma pessoa: no máximo um por hora.
  const since = new Date(Date.now() - USER_EMAIL_COOLDOWN_MS).toISOString();
  const { data: recent, error: rError } = await db.from('admin_audit_log')
    .select('created_at, admin_username')
    .eq('action', USER_EMAILS[kind].action).eq('details->>user_id', userId).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1);
  if (rError) {
    logError('admin.userEmail.recent', rError);
    return { ok: false, error: 'Não foi possível conferir os envios anteriores. Tente de novo.' };
  }
  if (recent?.length) {
    return { ok: false, error: `Este e-mail já foi enviado em ${formatDateTime(recent[0].created_at)} (${recent[0].admin_username}). Espere 1 hora para mandar de novo.` };
  }

  // Link de uso único do Supabase Auth (não manda e-mail sozinho). Só para quem já existe:
  // o e-mail vem do cadastro da pessoa, nunca do formulário.
  const { data: link, error: linkError } = await db.auth.admin.generateLink({ type: 'magiclink', email: user.email });
  if (linkError || !link?.properties?.hashed_token) {
    logError('admin.userEmail.link', linkError || new Error('sem hashed_token'));
    return { ok: false, error: 'Não foi possível gerar o link de acesso agora. Tente de novo.' };
  }
  const url = entryLink(SITE_URL, { hashedToken: link.properties.hashed_token, type: link.properties.verification_type || 'magiclink' });
  const name = user.user_metadata?.full_name || '';

  let sent;
  try {
    sent = await sendEmail({ to: user.email, ...userEmailContent(kind, { name, link: url, siteUrl: SITE_URL }), tags: [{ name: 'tipo', value: kind }] });
  } catch (err) {
    logError('admin.userEmail.send', err, { kind, status: err?.status });
    return { ok: false, error: emailErrorMessage(err) };
  }

  await audit(db, auth.session.username, USER_EMAILS[kind].action, null, { user_id: userId, email: user.email, name, email_id: sent.id });
  revalidatePath('/admin/tecnofix/usuarios');
  return { ok: true, message: `E-mail enviado para ${user.email}.` };
}
