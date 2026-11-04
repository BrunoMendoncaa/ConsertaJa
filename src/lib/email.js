import 'server-only';

// Envio de e-mails do sistema pela API do Resend (o mesmo serviço do SMTP do Supabase Auth).
// Variáveis (somente servidor): RESEND_API_KEY (obrigatória), EMAIL_FROM e EMAIL_REPLY_TO (opcionais).
// RESEND_API_URL só serve para testes locais (aponta para um servidor falso).

export const EMAIL_SETUP_MESSAGE = 'O envio de e-mails ainda não foi configurado: crie a variável RESEND_API_KEY na Vercel (veja o .env.example) e faça um novo deploy.';
const DEFAULT_FROM = 'TecnoFix <nao-responda@tecnofix.pro>';

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export class EmailError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** Manda um e-mail. Devolve { id } do Resend; erro vira EmailError com o status HTTP. */
export async function sendEmail({ to, subject, html, text, tags }) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new EmailError('RESEND_API_KEY ausente', 0);
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  let res;
  try {
    res = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(tags?.length ? { tags } : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new EmailError(`falha de rede: ${err?.message || err}`, 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new EmailError(`resend ${res.status}: ${body?.name || ''} ${body?.message || ''}`.trim(), res.status);
  return { id: body?.id || null };
}

/** Mensagem para a tela a partir do erro do envio. */
export function emailErrorMessage(err) {
  const status = err?.status;
  if (status === 401) return 'O Resend recusou a chave (RESEND_API_KEY). Confira a chave na Vercel.';
  if (status === 403 || status === 422 || status === 400) {
    return 'O Resend recusou o envio. Confira se a chave tem permissão de envio e se o domínio do remetente (EMAIL_FROM) está verificado no Resend.';
  }
  if (status === 429) return 'Muitos envios em pouco tempo. Tente de novo em 1 minuto.';
  return 'Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos.';
}
