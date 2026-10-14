import { describe, it, expect } from 'vitest';
import { missingProfileFields, isProfileComplete, profileFieldErrors, formatCep } from '@/features/tenancy/profile';

const fullAddress = { cep: '01310-100', rua: 'Av. Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' };

describe('cadastro da assistência', () => {
  it('assistência recém-criada está incompleta', () => {
    expect(missingProfileFields({ name: 'Loja', address: {} })).toEqual(['WhatsApp ou telefone', 'endereço completo']);
    expect(isProfileComplete({ name: 'Loja' })).toBe(false);
  });

  it('WhatsApp ou telefone bastam (um dos dois)', () => {
    expect(missingProfileFields({ whatsapp: '(11) 98888-7777', address: fullAddress })).toEqual([]);
    expect(missingProfileFields({ phone: '(11) 3333-4444', address: fullAddress })).toEqual([]);
    expect(missingProfileFields({ phone: '  ', address: fullAddress })).toEqual(['WhatsApp ou telefone']);
  });

  it('endereço sem CEP (cadastros antigos) conta como incompleto; complemento é opcional', () => {
    const { cep, ...semCep } = fullAddress;
    expect(missingProfileFields({ whatsapp: 'x', address: semCep })).toEqual(['endereço completo']);
    expect(isProfileComplete({ whatsapp: 'x', address: { ...fullAddress, complemento: '' } })).toBe(true);
  });

  it('erros por campo ao salvar', () => {
    expect(profileFieldErrors({ phone: null, whatsapp: null }, {})).toEqual({
      whatsapp: 'Informe o WhatsApp ou o telefone da assistência.',
      cep: 'Informe o CEP.', rua: 'Informe a rua.', numero: 'Informe o número (ou S/N).',
      bairro: 'Informe o bairro.', cidade: 'Informe a cidade.', uf: 'Escolha o estado.',
    });
    expect(profileFieldErrors({ whatsapp: '11988887777' }, fullAddress)).toEqual({});
    expect(profileFieldErrors({ whatsapp: '1' }, { ...fullAddress, cep: '123' }).cep).toBe('CEP inválido. Use 8 números.');
    expect(profileFieldErrors({ whatsapp: '1' }, { ...fullAddress, uf: 'XX' }).uf).toBe('Estado inválido.');
    expect(profileFieldErrors({ whatsapp: '1' }, { ...fullAddress, numero: 'S/N' })).toEqual({});
  });

  it('formata o CEP', () => {
    expect(formatCep('01310100')).toBe('01310-100');
    expect(formatCep('01310-100')).toBe('01310-100');
    expect(formatCep('1310100')).toBeNull();
    expect(formatCep(null)).toBeNull();
  });
});
