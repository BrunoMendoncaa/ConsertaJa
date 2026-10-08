'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAnonClient } from '@/lib/supabase/anon';
import { getPortalToken, setPortalToken, requestFingerprint, isValidSlug } from '@/lib/portal-session';
import { friendlyMessage } from '@/lib/errors';
import { logError } from '@/lib/logger';

export async function portalLogin(slug, _prev, formData) {
  if (!isValidSlug(slug)) return { ok: false, error: 'Endereço inválido.' };
  const phone = String(formData.get('phone') || '').trim();
  const code = String(formData.get('code') || '').trim();
  const fieldErrors = {};
  if (phone.replace(/\D/g, '').length < 10) fieldErrors.phone = 'Informe o telefone com DDD.';
  if (code.replace(/\s/g, '').length !== 6) fieldErrors.code = 'O código tem 6 caracteres.';
  if (Object.keys(fieldErrors).length) return { ok: false, error: 'Revise os campos.', fieldErrors };

  const { ip, userAgent } = await requestFingerprint();
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc('portal_login', {
    p_slug: slug, p_phone: phone, p_code: code, p_ip: ip, p_user_agent: userAgent,
  });
  if (error) {
    logError('portal.login', error);
    return { ok: false, error: 'Não foi possível entrar agora. Tente novamente em instantes.' };
  }
  const row = data?.[0];
  if (!row?.token) return { ok: false, error: row?.error_message || 'Telefone ou código não conferem.' };

  await setPortalToken(slug, row.token);
  redirect(`/a/${slug}/os`);
}

export async function portalDecide(slug, code, versionId, contentHash, _prev, formData) {
  const decision = String(formData.get('decision') || '');
  const reason = String(formData.get('reason') || '').trim();
  if (decision === 'APROVADO' && formData.get('accept') !== 'on') {
    return { ok: false, error: 'Confirme que leu e autoriza o serviço.', fieldErrors: { accept: 'Marque para continuar.' } };
  }
  if (decision === 'RECUSADO' && reason.length < 3) {
    return { ok: false, error: 'Conte rapidamente o motivo da recusa.', fieldErrors: { reason: 'Informe o motivo.' } };
  }

  const token = await getPortalToken(slug);
  if (!token) redirect(`/a/${slug}?expirada=1`);

  const { ip, userAgent } = await requestFingerprint();
  const supabase = createAnonClient();
  const { error } = await supabase.rpc('portal_decide_budget', {
    p_token: token, p_slug: slug, p_version_id: versionId, p_content_hash: contentHash,
    p_decision: decision, p_reason: reason || null, p_ip: ip, p_user_agent: userAgent,
  });
  if (error) {
    if (error.code === 'PT401') redirect(`/a/${slug}?expirada=1`);
    if (error.code !== 'P0001') logError('portal.decide', error);
    return { ok: false, error: friendlyMessage(error, 'Não foi possível registrar sua resposta.') };
  }

  revalidatePath(`/a/${slug}/os/${code}`);
  revalidatePath(`/a/${slug}/os/${code}/orcamento`);
  return {
    ok: true,
    message: decision === 'APROVADO'
      ? 'Orçamento aprovado! A assistência já foi avisada e vai iniciar o serviço.'
      : 'Recusa registrada. A assistência vai entrar em contato para combinar a devolução.',
  };
}
