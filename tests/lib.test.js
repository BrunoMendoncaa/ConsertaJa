import { describe, it, expect } from 'vitest';
import { parseMoney, parseQuantity, formatBRL, moneyInputValue } from '@/lib/money';
import { normalizeBrPhone, formatPhone, whatsappLink } from '@/lib/phone';
import { isValidCPF, isValidCNPJ, parseDocument, formatDocument } from '@/lib/document';
import { resolvePeriod, formatDate } from '@/lib/dates';
import { friendlyMessage, DB_NOT_READY_MESSAGE } from '@/lib/errors';
import { allowedCategories } from '@/features/finance/rules';

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
