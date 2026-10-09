'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/constants';
import { parseForm, z, email } from '@/lib/forms';
import { logError } from '@/lib/logger';
import { PLANS } from '@/lib/billing';
import { SITE_URL } from '@/lib/supabase/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { isMercadoPagoConfigured, createPreapproval, cancelPreapproval } from '@/lib/mercadopago';
import { syncAssistance, syncSubscription } from '@/features/billing/sync';
import { describeCheckoutError } from '@/features/billing/mp-utils';

const NOT_CONFIGURED = 'O pagamento ainda não foi configurado neste ambiente. Fale com o suporte do Conserta Já.';

const checkoutSchema = z.object({
  cycle: z.enum(['monthly', 'yearly'], { error: 'Escolha mensal ou anual.' }),
  payer_email: email(),
});

/** Cria a assinatura no Mercado Pago (pendente) e leva o dono para pagar lá. */
export async function startCheckout(_prev, formData) {
  const { assistance, user } = await requireStaff(MANAGER_ROLES);
  const parsed = parseForm(checkoutSchema, formData);
  if (!parsed.data) return parsed;
  if (!isMercadoPagoConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const plan = PLANS[parsed.data.cycle];
  // Assinou durante o teste: a 1ª cobrança fica para o fim do teste (não perde dias).
  const trialEnds = new Date(assistance.trial_ends_at);
  const startDate = trialEnds.getTime() > Date.now() + 60 * 60 * 1000 ? trialEnds.toISOString() : undefined;
  const backUrl = `${SITE_URL}/painel/plano/retorno`;
  let checkoutUrl;
  try {
    const pre = await createPreapproval({
      reason: plan.reason,
      externalReference: assistance.id, // vem do banco, nunca do formulário
      payerEmail: parsed.data.payer_email,
      amount: plan.amount,
      months: plan.months,
      startDate,
      backUrl,
      idempotencyKey: crypto.randomUUID(),
    });
    checkoutUrl = pre.init_point || pre.sandbox_init_point;
    if (!pre.id || !checkoutUrl) throw new Error('Resposta do Mercado Pago sem id ou link de pagamento.');

    const admin = createAdminClient();
    const { error } = await admin.rpc('billing_register_checkout', {
      p_assistance_id: assistance.id,
      p_provider_id: String(pre.id),
      p_cycle: plan.cycle,
      p_amount: plan.amount,
      p_payer_email: parsed.data.payer_email,
      p_checkout_url: checkoutUrl,
      p_user_id: user.id,
    });
    if (error) throw error;
  } catch (error) {
    const ref = logError('billing.startCheckout', error, { mp: error?.details, backUrl });
    return { ok: false, ref, error: describeCheckoutError(error, { backUrl }) };
  }
  redirect(checkoutUrl);
}

/** Confere no Mercado Pago se o pagamento já foi aprovado. */
export async function refreshBilling() {
  const { assistance } = await requireStaff(MANAGER_ROLES);
  if (!isMercadoPagoConfigured()) return { ok: false, error: NOT_CONFIGURED };
  try {
    const access = await syncAssistance(assistance.id);
    revalidatePath('/painel', 'layout');
    return {
      ok: true,
      message: access === 'active' ? 'Pagamento confirmado. Sua assinatura está ativa.' : 'Situação atualizada com o Mercado Pago.',
    };
  } catch (error) {
    const ref = logError('billing.refresh', error, { mp: error?.details });
    return { ok: false, ref, error: 'Não foi possível consultar o Mercado Pago agora. Tente de novo em instantes.' };
  }
}

/** Cancela a renovação. A conta continua liberada até o fim do período já pago. */
export async function cancelSubscription() {
  const { assistance } = await requireStaff(['owner']);
  if (!assistance.mp_preapproval_id) return { ok: false, error: 'Não há assinatura ativa para cancelar.' };
  try {
    await cancelPreapproval(assistance.mp_preapproval_id);
    await syncSubscription(assistance.mp_preapproval_id);
    revalidatePath('/painel', 'layout');
    return { ok: true, message: 'Renovação cancelada. Você continua usando até o fim do período já pago.' };
  } catch (error) {
    const ref = logError('billing.cancel', error, { mp: error?.details });
    return { ok: false, ref, error: 'Não foi possível cancelar agora. Tente de novo em instantes.' };
  }
}
