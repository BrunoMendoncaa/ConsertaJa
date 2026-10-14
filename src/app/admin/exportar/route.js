import { NextResponse } from 'next/server';
import { getAdminSession } from '@/features/admin/session';
import { listAssistances, AdminSetupError } from '@/features/admin/queries';
import {
  SITUATION_FILTERS, matchesSituation, matchesQuery, situation, dueInfo, monthlyValue, cycleLabel, profileComplete, toCsv,
} from '@/features/admin/format';
import { SITE_URL } from '@/lib/supabase/env';
import { formatDate } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

const money = (n) => (n ? n.toFixed(2).replace('.', ',') : '');

// Planilha das assistências (mesmos filtros da tela). Só com sessão admin válida.
export async function GET(request) {
  if (!(await getAdminSession())) return new NextResponse('Não autorizado', { status: 401 });
  const sp = new URL(request.url).searchParams;
  const filter = SITUATION_FILTERS.some(([k]) => k === sp.get('situacao')) ? sp.get('situacao') : 'todas';
  const q = (sp.get('q') || '').slice(0, 80);

  let rows;
  try {
    rows = (await listAssistances()).filter((a) => matchesSituation(a, filter) && matchesQuery(a, q));
  } catch (err) {
    if (err instanceof AdminSetupError) return new NextResponse(err.message, { status: 503 });
    throw err;
  }

  const header = [
    'Assistência', 'Portal', 'Situação', 'Vencimento', 'Dias', 'Plano', 'Valor mensal (R$)',
    'Dono', 'E-mail do dono', 'Telefone do dono', 'WhatsApp da loja', 'Cidade', 'UF',
    'Cadastro completo', 'Criada em', 'OS 30 dias', 'OS total', 'Última OS', 'Último acesso do dono',
  ];
  const data = rows.map((a) => {
    const d = dueInfo(a);
    return [
      a.name, `${SITE_URL}/a/${a.slug}`, situation(a).label, d.date ? formatDate(d.date) : '', d.days ?? '',
      cycleLabel(a.billing_cycle), money(monthlyValue(a)),
      a.owner_name || '', a.owner_email || '', a.owner_phone ? formatPhone(a.owner_phone) : '',
      a.whatsapp ? formatPhone(a.whatsapp) : a.phone ? formatPhone(a.phone) : '',
      a.address?.cidade || '', a.address?.uf || '',
      profileComplete(a) ? 'sim' : 'não', formatDate(a.created_at), a.orders_30d, a.orders,
      a.last_order_at ? formatDate(a.last_order_at) : '', a.owner_last_sign_in ? formatDate(a.owner_last_sign_in) : '',
    ];
  });

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return new NextResponse(toCsv(header, data), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tecnofix-assistencias-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
