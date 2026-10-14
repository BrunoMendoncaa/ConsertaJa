'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/supabase/env';
import { parseForm, z, email } from '@/lib/forms';
import { logError } from '@/lib/logger';
import { landingPath } from '@/features/tenancy/landing';

function safeNext(next, fallback = '/painel') {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
  next: z.string().optional(),
});

export async function signIn(_prev, formData) {
  const parsed = parseForm(loginSchema, formData);
  if (!parsed.data) return parsed;

  const supabase = await createClient();
  const { data: signed, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === 'email_not_confirmed') {
      return { ok: false, error: 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.' };
    }
    if (error.status === 429) return { ok: false, error: 'Muitas tentativas. Aguarde alguns minutos.' };
    return { ok: false, error: 'E-mail ou senha incorretos.' };
  }

  // Sem destino pedido: proprietário/administrador com cadastro da assistência incompleto
  // vai direto para Configurações completar (WhatsApp e endereço).
  const next = safeNext(parsed.data.next);
  redirect(next === '/painel' ? await landingPath(supabase, signed?.user?.id) : next);
}

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, 'Informe seu nome.').max(120),
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72),
  next: z.string().optional(),
});

export async function signUp(_prev, formData) {
  const parsed = parseForm(signUpSchema, formData);
  if (!parsed.data) return parsed;

  const next = safeNext(parsed.data.next, '/onboarding');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    if (error.code === 'user_already_exists') return { ok: false, error: 'Este e-mail já tem conta. Entre com sua senha.' };
    if (error.code === 'weak_password') return { ok: false, error: 'Senha fraca. Use letras, números e pelo menos 8 caracteres.' };
    if (error.status === 429) return { ok: false, error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' };
    logError('auth.signUp', error);
    // Falha no envio do e-mail (servidor SMTP): a conta foi criada, mas a confirmação não saiu.
    if (/sending confirmation email/i.test(error.message || '')) {
      return { ok: false, error: 'Não conseguimos enviar o e-mail de confirmação agora. Tente de novo em alguns minutos.' };
    }
    return { ok: false, error: 'Não foi possível criar a conta agora. Tente novamente.' };
  }

  // Confirmação de e-mail desligada no projeto: já entra direto.
  if (data.session) redirect(next);

  // E-mail que já tem conta: o Supabase responde "ok" sem erro, mas NÃO envia e-mail
  // (devolve o usuário sem identidades). Avisa em vez de prometer um e-mail que não vem.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, error: 'Este e-mail já tem conta. Entre com sua senha ou use "Esqueci minha senha".' };
  }

  return {
    ok: true,
    message: `Enviamos um link de confirmação para ${parsed.data.email}. Abra o e-mail neste mesmo navegador para continuar. Se não aparecer em alguns minutos, confira a caixa de spam.`,
  };
}

export async function requestPasswordReset(_prev, formData) {
  const parsed = parseForm(z.object({ email: email() }), formData);
  if (!parsed.data?.email) return { ok: false, error: 'Informe um e-mail válido.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE_URL}/auth/confirm?next=/redefinir-senha`,
  });
  if (error && error.status !== 429) logError('auth.reset', error);

  // Mesma resposta exista ou não a conta (não revela e-mails cadastrados).
  return { ok: true, message: 'Se houver uma conta com este e-mail, você receberá um link para criar uma nova senha.' };
}

const newPasswordSchema = z
  .object({
    password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'As senhas não conferem.', path: ['confirm'] });

export async function updatePassword(_prev, formData) {
  const parsed = parseForm(newPasswordSchema, formData);
  if (!parsed.data) return parsed;

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === 'same_password') return { ok: false, error: 'Escolha uma senha diferente da atual.' };
    logError('auth.updatePassword', error);
    return { ok: false, error: 'O link expirou. Peça um novo link de recuperação.' };
  }
  redirect('/painel');
}
