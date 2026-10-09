import { describe, it, expect } from 'vitest';
import { parseMoney, parseQuantity, formatBRL, moneyInputValue } from '@/lib/money';
import { normalizeBrPhone, formatPhone, whatsappLink } from '@/lib/phone';
import { isValidCPF, isValidCNPJ, parseDocument, formatDocument } from '@/lib/document';
import { resolvePeriod, formatDate } from '@/lib/dates';
import { friendlyMessage, DB_NOT_READY_MESSAGE } from '@/lib/errors';
import { allowedCategories } from '@/features/finance/rules';
import { warrantyDocument, warrantyTerms, DEFAULT_WARRANTY_TERMS } from '@/features/service-orders/warranty';
import { verifyWebhookSignature, parseWebhook, mapPreapprovalStatus, mapAuthorizedPayments, describeCheckoutError } from '@/features/billing/mp-utils';
import crypto from 'node:crypto';

describe('dinheiro', () => {
  it('converte formatos brasileiros para decimal com 2 casas', () => {
    expect(parseMoney('1.234,56')).toBe('1234.56');
    expect(parseMoney('R$ 10')).toBe('10.00');
    expect(parseMoney('99,9')).toBe('99.90');
    expect(parseMoney('150')).toBe('150.00');
    expect(parseMoney('0,00')).toBe('0.00');
  });
  it('recusa valores inválidos', () => {
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1,234')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });
  it('quantidade aceita até 3 casas e precisa ser positiva', () => {
    expect(parseQuantity('1,5')).toBe('1.5');
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('2.1234')).toBeNull();
  });
  it('formata em reais', () => {
    expect(formatBRL(1050).replace(/\s/g, ' ')).toBe('R$ 1.050,00');
    expect(formatBRL(null)).toBe('—');
    expect(moneyInputValue(12.5)).toBe('12,50');
  });
});

describe('telefone', () => {
  it('normaliza para E.164 (mesma regra do banco)', () => {
    expect(normalizeBrPhone('(11) 98765-4321')).toBe('+5511987654321');
    expect(normalizeBrPhone('+55 11 98765-4321')).toBe('+5511987654321');
    expect(normalizeBrPhone('011 98765-4321')).toBe('+5511987654321');
    expect(normalizeBrPhone('55987654321')).toBe('+5555987654321');
    expect(normalizeBrPhone('(11) 3333-4444')).toBe('+551133334444');
    expect(normalizeBrPhone('123')).toBeNull();
  });
  it('formata e gera link do WhatsApp', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    expect(whatsappLink('11987654321', 'Oi')).toBe('https://wa.me/5511987654321?text=Oi');
  });
});

describe('CPF/CNPJ', () => {
  it('valida dígitos verificadores', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
    expect(isValidCNPJ('11.222.333/0001-80')).toBe(false);
  });
  it('parseDocument distingue vazio de inválido', () => {
    expect(parseDocument('')).toBeNull();
    expect(parseDocument('52998224725')).toBe('52998224725');
    expect(parseDocument('123')).toBe(false);
    expect(formatDocument('52998224725')).toBe('529.982.247-25');
  });
});

describe('datas', () => {
  it('período personalizado inverte datas trocadas', () => {
    const p = resolvePeriod({ periodo: 'personalizado', de: '2026-10-08', ate: '2026-10-01' });
    expect(p).toEqual({ key: 'personalizado', from: '2026-10-01', to: '2026-10-08' });
  });
  it('mês começa no dia 1', () => {
    expect(resolvePeriod({}).from.endsWith('-01')).toBe(true);
  });
  it('data sem hora não muda de dia por causa do fuso', () => {
    expect(formatDate('2026-10-08')).toBe('08/10/2026');
  });
});

describe('mensagens de erro', () => {
  it('regras de negócio do banco aparecem como estão', () => {
    expect(friendlyMessage({ code: 'P0001', message: 'Informe o prazo estimado em dias.' })).toBe('Informe o prazo estimado em dias.');
  });
  it('constraints viram mensagens específicas', () => {
    expect(friendlyMessage({ code: '23505', message: 'duplicate key value violates unique constraint "customers_phone_unique"' }))
      .toBe('Já existe um cliente com este telefone nesta assistência.');
  });
  it('nunca mostra o erro técnico cru', () => {
    expect(friendlyMessage({ code: '23503', message: 'insert or update on table "x" violates foreign key constraint' }))
      .not.toMatch(/foreign key/);
    expect(friendlyMessage({ code: '42501', message: 'new row violates row-level security policy for table "customers"' }))
      .toBe('Você não tem permissão para esta ação.');
  });
  it('banco sem migrations avisa que precisa ser preparado', () => {
    expect(friendlyMessage({ code: 'PGRST202', message: 'Could not find the function public.create_assistance' }))
      .toBe(DB_NOT_READY_MESSAGE);
    expect(friendlyMessage({ code: 'PGRST205', message: "Could not find the table 'public.profiles'" }))
      .toBe(DB_NOT_READY_MESSAGE);
  });
});

describe('permissões do caixa (espelho da policy)', () => {
  it('cada papel lança só o que pode', () => {
    expect(allowedCategories('attendant')).toEqual(['RECEBIMENTO_OS', 'TAXA_DIAGNOSTICO']);
    expect(allowedCategories('technician')).toContain('COMPRA_PECA');
    expect(allowedCategories('technician')).not.toContain('DESPESA_OPERACIONAL');
    expect(allowedCategories('owner')).toContain('DESPESA_OPERACIONAL');
  });
});

describe('certificado de garantia', () => {
  const entregue = { status: 'ENTREGUE', outcome: 'REPARADO', delivered_at: '2026-10-08T15:00:00Z', warranty_until: '2027-01-06' };

  it('só existe depois da entrega', () => {
    expect(warrantyDocument({ ...entregue, status: 'PRONTO' }, { warranty_days: 90 })).toBeNull();
  });
  it('reparado com prazo gera certificado com as datas', () => {
    expect(warrantyDocument(entregue, { warranty_days: 90 }))
      .toEqual({ kind: 'certificate', days: 90, startsAt: entregue.delivered_at, endsAt: '2027-01-06' });
  });
  it('sem orçamento carregado, calcula o prazo pelas datas', () => {
    expect(warrantyDocument(entregue, null).days).toBe(90);
  });
  it('garantia zero e devolução sem reparo não geram certificado', () => {
    expect(warrantyDocument({ ...entregue, warranty_until: null }, { warranty_days: 0 }).kind).toBe('no_warranty');
    expect(warrantyDocument({ ...entregue, outcome: 'NAO_REPARADO_RECUSADO', warranty_until: null }, null).kind).toBe('pickup');
  });
  it('usa as condições da assistência, uma por linha, ou o padrão', () => {
    expect(warrantyTerms('- Cobre a tela trocada\n\n2) 90 dias para defeitos de fábrica da peça')).toEqual([
      'Cobre a tela trocada', '90 dias para defeitos de fábrica da peça',
    ]);
    expect(warrantyTerms('   ')).toBe(DEFAULT_WARRANTY_TERMS);
  });
});

describe('Mercado Pago: webhook e conversões', () => {
  const secret = 'segredo-de-teste';
  const sign = (manifest) => crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  it('aceita a assinatura correta (data.id em minúsculas no manifest)', () => {
    const v1 = sign('id:abc123xyz;request-id:req-1;ts:1700000000;');
    expect(verifyWebhookSignature({ signature: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: 'ABC123XYZ', secret })).toBe(true);
  });
  it('recusa segredo errado, id trocado ou cabeçalho incompleto', () => {
    const v1 = sign('id:123;request-id:req-1;ts:1700000000;');
    expect(verifyWebhookSignature({ signature: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: '123', secret: 'outro' })).toBe(false);
    expect(verifyWebhookSignature({ signature: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: '999', secret })).toBe(false);
    expect(verifyWebhookSignature({ signature: 'ts=1700000000', requestId: 'req-1', dataId: '123', secret })).toBe(false);
    expect(verifyWebhookSignature({ signature: null, requestId: 'req-1', dataId: '123', secret })).toBe(false);
  });
  it('omite do manifest o que não veio (sem x-request-id)', () => {
    const v1 = sign('id:123;ts:1700000000;');
    expect(verifyWebhookSignature({ signature: `ts=1700000000,v1=${v1}`, dataId: '123', secret })).toBe(true);
  });
  it('lê tipo e id do formato novo e do antigo', () => {
    expect(parseWebhook({ searchParams: new URLSearchParams('data.id=55&type=subscription_preapproval'), body: null }))
      .toEqual({ type: 'subscription_preapproval', dataId: '55' });
    expect(parseWebhook({ searchParams: new URLSearchParams('topic=subscription_authorized_payment&id=77'), body: null }))
      .toEqual({ type: 'subscription_authorized_payment', dataId: '77' });
    expect(parseWebhook({ searchParams: new URLSearchParams(''), body: { type: 'payment', data: { id: 9 } } }))
      .toEqual({ type: 'payment', dataId: '9' });
  });
  it('converte status e faturas; só "approved" conta como pago', () => {
    expect(mapPreapprovalStatus('authorized')).toBe('authorized');
    expect(mapPreapprovalStatus('finished')).toBe('cancelled');
    expect(mapPreapprovalStatus('qualquer')).toBe('pending');
    expect(mapAuthorizedPayments([
      { id: 1, transaction_amount: 49, status: 'processed', debit_date: '2026-10-08T10:00:00Z', payment: { id: 10, status: 'approved' } },
      { id: 2, transaction_amount: 49, status: 'recycling', payment: { id: 11, status: 'rejected' } },
    ])).toEqual([
      { id: '1', payment_id: '10', amount: 49, status: 'approved', paid_at: '2026-10-08T10:00:00Z' },
      { id: '2', payment_id: '11', amount: 49, status: 'rejected', paid_at: null },
    ]);
  });
});

describe('Mercado Pago: mensagem quando a assinatura é recusada', () => {
  const err = (status, details) => Object.assign(new Error('mp'), { status, details });
  it('explica credencial de teste com e-mail real', () => {
    expect(describeCheckoutError(err(400, { message: 'Both payer and collector must be real or test users' }))).toMatch(/comprador de teste/);
    expect(describeCheckoutError(err(400, { message: 'Invalid users involved' }))).toMatch(/comprador de teste/);
  });
  it('explica pagador igual ao recebedor', () => {
    expect(describeCheckoutError(err(400, { message: 'Payer and collector cannot be the same user' }))).toMatch(/mesma conta/);
  });
  it('explica país e back_url', () => {
    expect(describeCheckoutError(err(400, { message: 'Cannot operate between different countries' }))).toMatch(/outro país/);
    expect(describeCheckoutError(err(400, { message: 'Invalid value for back_url, must be a valid URL' }))).toMatch(/NEXT_PUBLIC_SITE_URL/);
    const withUrl = describeCheckoutError(err(400, { message: 'Invalid value for back_url, must be a valid URL' }), { backUrl: 'http://localhost:3000/painel/plano/retorno' });
    expect(withUrl).toContain('(http://localhost:3000/painel/plano/retorno)');
    expect(withUrl).toContain('Invalid value for back_url');
  });
  it('credencial recusada, falha do MP ou erro interno', () => {
    expect(describeCheckoutError(err(401, { message: 'invalid access token' }))).toMatch(/MP_ACCESS_TOKEN/);
    expect(describeCheckoutError(err(503, null))).toMatch(/Tente de novo/);
    expect(describeCheckoutError(new Error('rede'))).toMatch(/Tente de novo/);
  });
  it('nos demais casos mostra o motivo do Mercado Pago', () => {
    const msg = describeCheckoutError(err(400, { message: 'bad_request', cause: [{ code: 1, description: 'payer_email is invalid' }] }));
    expect(msg).toContain('bad_request · payer_email is invalid');
  });
});
