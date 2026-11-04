// E-mails que a área admin manda para quem se cadastrou e parou no meio do caminho:
// - "confirmar": a pessoa criou a conta, mas não confirmou o e-mail;
// - "assistencia": confirmou, mas não cadastrou a assistência.
// Os dois levam um botão que entra direto na conta (link de uso único gerado pelo Supabase
// Auth, que também confirma o e-mail) e cai em /onboarding para cadastrar a assistência.
// Funciona em qualquer navegador, diferente do link do cadastro (fluxo PKCE).
import { WHATSAPP_NUMBER, WHATSAPP_LABEL } from '@/lib/contact';

export const USER_EMAILS = {
  confirmar: {
    action: 'user_confirm_email',
    button: 'Reenviar confirmação',
    sentLabel: 'confirmação',
    confirm: (email) => `Reenviar o e-mail de confirmação para ${email}?`,
  },
  assistencia: {
    action: 'user_onboarding_email',
    button: 'Lembrar de cadastrar a assistência',
    sentLabel: 'lembrete da assistência',
    confirm: (email) => `Mandar para ${email} um e-mail lembrando de cadastrar a assistência?`,
  },
};
export const USER_EMAIL_KINDS = Object.keys(USER_EMAILS);
export const USER_EMAIL_ACTIONS = USER_EMAIL_KINDS.map((k) => USER_EMAILS[k].action);

/** O mesmo e-mail para a mesma pessoa só sai de novo depois deste tempo (evita envio repetido). */
export const USER_EMAIL_COOLDOWN_MS = 60 * 60 * 1000;

/** Qual e-mail cabe para esta pessoa agora: 'confirmar', 'assistencia' ou null. */
export function userEmailKind(user) {
  if (!user?.email) return null;
  if (!user.email_confirmed_at) return 'confirmar';
  if (!user.memberships?.length) return 'assistencia';
  return null;
}

/** Endereço do botão: /auth/confirm confere o token no servidor, abre a sessão e segue para `next`. */
export function entryLink(siteUrl, { hashedToken, type = 'magiclink', next = '/onboarding' }) {
  const q = new URLSearchParams({ token_hash: hashedToken, type, next });
  return `${String(siteUrl).replace(/\/+$/, '')}/auth/confirm?${q}`;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Primeiro nome, só com letras, espaços e pontuação comum (o nome vem do cadastro, digitado pela pessoa). */
export function firstName(fullName) {
  const first = String(fullName || '').trim().split(/\s+/)[0] || '';
  const clean = first.replace(/[^\p{L}\p{M}'.-]/gu, '').slice(0, 30);
  return clean.length >= 2 ? clean : '';
}

const FREE_LINE = 'O TecnoFix é grátis, sem prazo e sem cartão: OS no celular com fotos do aparelho, orçamento que o cliente aprova pelo link e garantia pronta na entrega.';

/** Assunto, HTML e texto puro do e-mail. */
export function userEmailContent(kind, { name, link, siteUrl }) {
  const site = String(siteUrl).replace(/\/+$/, '');
  const host = site.replace(/^https?:\/\//, '');
  const first = firstName(name);
  const hello = first ? `Olá, ${first}!` : 'Olá!';
  const whatsapp = `https://wa.me/${WHATSAPP_NUMBER}`;

  const c = kind === 'confirmar'
    ? {
      subject: 'Falta confirmar seu e-mail no TecnoFix',
      title: 'Falta só confirmar seu e-mail',
      intro: `${hello} Você criou sua conta no TecnoFix, mas o e-mail ainda não foi confirmado. Clique no botão para confirmar e já cadastrar sua assistência. Leva 2 minutos.`,
      button: 'Confirmar e-mail',
      note: `O botão funciona uma vez e vale por pouco tempo. Se ele não abrir mais, chame no WhatsApp ${WHATSAPP_LABEL} que mandamos outro. Se não foi você que criou a conta, é só ignorar este e-mail.`,
    }
    : {
      subject: 'Falta cadastrar sua assistência no TecnoFix',
      title: 'Sua conta está pronta. Falta a assistência.',
      intro: `${hello} Você já tem conta no TecnoFix, mas ainda não cadastrou sua assistência. É só informar o nome da loja e você já pode abrir a primeira ordem de serviço.`,
      button: 'Cadastrar minha assistência',
      note: `O botão entra direto na sua conta e vale por pouco tempo. Depois disso, entre em ${host}/entrar com seu e-mail e senha (ou use "Esqueci minha senha"). Dúvidas? Chame no WhatsApp ${WHATSAPP_LABEL}.`,
    };

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
  <p style="font-size:20px;font-weight:bold;margin:0 0 20px">Tecno<span style="color:#f97316">Fix</span></p>
  <h1 style="font-size:20px;margin:0 0 12px">${esc(c.title)}</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 20px">${esc(c.intro)}</p>
  <p style="margin:0 0 20px"><a href="${esc(link)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${esc(c.button)}</a></p>
  <p style="font-size:14px;line-height:1.5;margin:0 0 16px">${esc(FREE_LINE)}</p>
  <p style="font-size:13px;line-height:1.5;color:#64748b;margin:0">${esc(c.note)}</p>
  <p style="font-size:13px;margin:12px 0 0"><a href="${esc(whatsapp)}" style="color:#047857;font-weight:bold;text-decoration:none">Falar no WhatsApp</a></p>
  <p style="font-size:12px;color:#94a3b8;margin:24px 0 0">TecnoFix · Sistema de OS para assistência técnica · ${esc(host)}<br>Você recebeu este e-mail porque criou uma conta no TecnoFix.</p>
</div>`;

  const text = [
    c.title, '', c.intro, '', `${c.button}: ${link}`, '', FREE_LINE, '', c.note, `WhatsApp: ${whatsapp}`, '',
    `TecnoFix · ${host}`, 'Você recebeu este e-mail porque criou uma conta no TecnoFix.',
  ].join('\n');

  return { subject: c.subject, html, text };
}
