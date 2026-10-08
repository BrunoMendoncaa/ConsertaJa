import { NextResponse } from 'next/server';
import { getStaffContext } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/constants';
import { isMercadoPagoConfigured } from '@/lib/mercadopago';
import { syncAssistance } from '@/features/billing/sync';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Volta do checkout do Mercado Pago. Confere a assinatura direto na API
 * (os parâmetros da URL não são usados para liberar nada) e só depois abre
 * "Meu plano", para que o painel inteiro já mostre a situação nova.
 */
export async function GET(request) {
  const ctx = await getStaffContext();
  if (!ctx.user) return NextResponse.redirect(new URL('/entrar', request.url));
  if (!ctx.assistance || !MANAGER_ROLES.includes(ctx.role)) return NextResponse.redirect(new URL('/painel', request.url));

  let result = 'pendente';
  if (isMercadoPagoConfigured()) {
    try {
      const access = await syncAssistance(ctx.assistance.id);
      const { data: a } = await ctx.supabase.from('assistances').select('mp_preapproval_id').eq('id', ctx.assistance.id).maybeSingle();
      result = access === 'active' ? 'confirmado' : a?.mp_preapproval_id ? 'agendado' : 'pendente';
    } catch (error) {
      logError('billing.return', error, { mp: error?.details });
      result = 'erro';
    }
  }
  const url = new URL('/painel/plano', request.url);
  url.searchParams.set('pagamento', result);
  return NextResponse.redirect(url);
}
