import { describe, it, expect } from 'vitest';
import { hashPassword, newSessionSecret, passwordProblem } from '../scripts/admin-senha.mjs';
import { verifyPassword, safeEqual, hashPassword as serverHash, passwordProblem as serverProblem, dummyHash } from '@/features/admin/password';
import {
  normalizePermissions, can, allowedSections, homeFor, PERMISSION_KEYS, USERNAME_RE,
} from '@/features/admin/permissions';
import { readAdminConfig, signSession, verifySession, SESSION_HOURS } from '@/features/admin/token';
import {
  situationKey, dueInfo, monthlyValue, matchesSituation, matchesQuery, relativeDays, toCsv, profileComplete,
} from '@/features/admin/format';

const DAY = 86400000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString();

describe('área admin: senha', () => {
  const hash = hashPassword('uma senha bem comprida');

  it('o hash gerado pelo comando confere no servidor', () => {
    expect(hash).toMatch(/^scrypt:32768:8:1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    expect(hash).not.toContain('$'); // não pode virar variável em arquivos .env
    expect(verifyPassword('uma senha bem comprida', hash)).toBe(true);
    expect(verifyPassword('uma senha bem compridA', hash)).toBe(false);
    expect(verifyPassword('', hash)).toBe(false);
  });

  it('cada hash tem sal próprio', () => {
    expect(hashPassword('mesma senha 123')).not.toBe(hashPassword('mesma senha 123'));
  });

  it('formato inválido nunca confere', () => {
    expect(verifyPassword('x', 'texto-qualquer')).toBe(false);
    expect(verifyPassword('x', 'scrypt:1:8:1:a:b')).toBe(false);
    expect(verifyPassword('x', null)).toBe(false);
  });

  it('regras da senha no comando', () => {
    expect(passwordProblem('curta')).toBeTruthy();
    expect(passwordProblem('aaaaaaaaaaaaaaa')).toBeTruthy();
    expect(passwordProblem('troque-isto-2026')).toBeNull();
  });

  it('safeEqual compara textos', () => {
    expect(safeEqual('bruno', 'bruno')).toBe(true);
    expect(safeEqual('bruno', 'brun0')).toBe(false);
    expect(safeEqual(undefined, '')).toBe(true);
  });
});

describe('área admin: sessão', () => {
  const cfg = readAdminConfig({
    ADMIN_USERNAME: ' Bruno ', ADMIN_PASSWORD_HASH: hashPassword('uma senha bem comprida'), ADMIN_SESSION_SECRET: newSessionSecret(),
  });

  it('sem as três variáveis a área fica desligada', () => {
    expect(readAdminConfig({})).toBeNull();
    expect(readAdminConfig({ ADMIN_USERNAME: 'a', ADMIN_PASSWORD_HASH: 'scrypt:x', ADMIN_SESSION_SECRET: 'curto' })).toBeNull();
    expect(cfg.username).toBe('bruno');
  });

  it('cookie assinado vale até expirar', () => {
    const now = Date.now();
    const token = signSession(cfg, now);
    expect(verifySession(cfg, token, now + 1000)).toMatchObject({ username: 'bruno' });
    expect(verifySession(cfg, token, now + SESSION_HOURS * 3600 * 1000 + 1)).toBeNull();
  });

  it('cookie alterado, de outra chave ou de outra senha não vale', () => {
    const token = signSession(cfg);
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ u: 'bruno', exp: Date.now() + 9e9 })).toString('base64url');
    expect(verifySession(cfg, `${forged}.${sig}`)).toBeNull();
    expect(verifySession(cfg, `${payload}.${sig}x`)).toBeNull();
    expect(verifySession(cfg, `${payload}.${sig}.extra`)).toBeNull();
    expect(verifySession({ ...cfg, secret: newSessionSecret() }, token)).toBeNull();
    expect(verifySession({ ...cfg, hash: hashPassword('outra senha comprida') }, token)).toBeNull();
    expect(verifySession({ ...cfg, username: 'outro' }, token)).toBeNull();
    expect(verifySession(cfg, undefined)).toBeNull();
  });
});

describe('área admin: sessão de contas com permissões', () => {
  const cfg = readAdminConfig({
    ADMIN_USERNAME: 'bruno.mendonca', ADMIN_PASSWORD_HASH: hashPassword('uma senha bem comprida'), ADMIN_SESSION_SECRET: newSessionSecret(),
  });

  it('cookie da master não leva versão; o de uma conta leva', () => {
    expect(verifySession(cfg, signSession(cfg))).toMatchObject({ username: 'bruno.mendonca', master: true });
    const acc = verifySession(cfg, signSession(cfg, Date.now(), { username: 'maria', session_version: 3 }));
    expect(acc).toMatchObject({ username: 'maria', master: false, sv: 3 });
  });

  it('uma conta não vira master e a master não vale com versão', () => {
    // Conta do banco com o mesmo nome da master: recusado.
    expect(verifySession(cfg, signSession(cfg, Date.now(), { username: 'bruno.mendonca', session_version: 1 }))).toBeNull();
    // Cookie de conta sem versão: recusado.
    const payload = Buffer.from(JSON.stringify({ u: 'maria', exp: Date.now() + 1e6 })).toString('base64url');
    const [, sig] = signSession(cfg).split('.');
    expect(verifySession(cfg, `${payload}.${sig}`)).toBeNull();
  });

  it('cookie de conta assinado com outra chave não vale', () => {
    const other = { ...cfg, secret: newSessionSecret() };
    expect(verifySession(cfg, signSession(other, Date.now(), { username: 'maria', session_version: 1 }))).toBeNull();
  });
});

describe('área admin: senhas das contas', () => {
  it('o hash do servidor confere e usa o mesmo formato do comando', () => {
    const h = serverHash('senha da maria 2026');
    expect(h).toMatch(/^scrypt:32768:8:1:/);
    expect(verifyPassword('senha da maria 2026', h)).toBe(true);
    expect(verifyPassword('senha da maria 2027', h)).toBe(false);
    expect(verifyPassword('qualquer coisa', dummyHash())).toBe(false);
  });

  it('mesmas regras de senha do comando', () => {
    expect(serverProblem('curta')).toBeTruthy();
    expect(serverProblem('x'.repeat(20))).toBeTruthy();
    expect(serverProblem('a'.repeat(201))).toBeTruthy();
    expect(serverProblem('troque-isto-2026')).toBeNull();
  });

  it('usuário válido', () => {
    expect(USERNAME_RE.test('maria.souza')).toBe(true);
    expect(USERNAME_RE.test('Maria')).toBe(false);
    expect(USERNAME_RE.test('ma')).toBe(false);
    expect(USERNAME_RE.test('maria souza')).toBe(false);
  });
});

describe('área admin: permissões', () => {
  it('só permissões conhecidas, sem repetir e com o "ver" que cada ação exige', () => {
    expect(normalizePermissions(['assistencias_estender_teste', 'xpto', 'site_ver', 'site_ver'])).toEqual([
      'assistencias_ver', 'assistencias_estender_teste', 'site_ver',
    ]);
    expect(normalizePermissions(null)).toEqual([]);
    expect(normalizePermissions('usuarios_ver')).toEqual(['usuarios_ver']);
  });

  it('master pode tudo; conta só o marcado; sem sessão nada', () => {
    const maria = { master: false, permissions: ['site_ver'] };
    expect(can({ master: true, permissions: [] }, 'financeiro')).toBe(true);
    expect(can(maria, 'site_ver')).toBe(true);
    expect(can(maria, 'financeiro')).toBe(false);
    expect(can(null, 'site_ver')).toBe(false);
  });

  it('menu e página inicial de cada conta', () => {
    const master = { master: true, permissions: PERMISSION_KEYS };
    expect(allowedSections(master).map((s) => s.href)).toEqual(['/admin', '/admin/assistencias', '/admin/usuarios', '/admin/site', '/admin/acessos']);
    const maria = { master: false, permissions: ['site_ver', 'assistencias_ver'] };
    expect(allowedSections(maria).map((s) => s.href)).toEqual(['/admin/assistencias', '/admin/site']);
    expect(homeFor(maria)).toBe('/admin/assistencias');
    expect(homeFor({ master: false, permissions: [] })).toBe('/admin/sem-acesso');
    // Conta com todas as permissões continua sem a tela Acessos (é só da master).
    expect(allowedSections({ master: false, permissions: PERMISSION_KEYS }).some((s) => s.href === '/admin/acessos')).toBe(false);
  });
});

describe('área admin: situação e vencimento', () => {
  const base = { subscription_status: 'trialing', access: 'trial', trial_ends_at: iso(5), paid_until: null, mp_preapproval_id: null };

  it('classifica as situações', () => {
    expect(situationKey(base)).toBe('trial');
    expect(situationKey({ ...base, mp_preapproval_id: 'p1', subscription_mp_status: 'authorized' })).toBe('trial_subscribed');
    expect(situationKey({ ...base, access: 'active', subscription_status: 'active' })).toBe('active');
    expect(situationKey({ ...base, access: 'grace', subscription_status: 'past_due' })).toBe('grace');
    expect(situationKey({ ...base, access: 'blocked', trial_ends_at: iso(-3) })).toBe('expired');
    expect(situationKey({ ...base, access: 'blocked', subscription_status: 'canceled' })).toBe('canceled');
    expect(situationKey({ ...base, access: 'blocked', subscription_status: 'suspended' })).toBe('suspended');
  });

  it('filtro "Em teste" inclui quem já assinou', () => {
    expect(matchesSituation({ ...base, mp_preapproval_id: 'p1', subscription_mp_status: 'authorized' }, 'trial')).toBe(true);
    expect(matchesSituation(base, 'active')).toBe(false);
    expect(matchesSituation(base, 'todas')).toBe(true);
  });

  it('vencimento: fim do teste, pago até ou quando venceu', () => {
    expect(dueInfo(base)).toMatchObject({ label: 'Teste até', days: 5 });
    expect(dueInfo({ ...base, access: 'active', subscription_status: 'active', paid_until: iso(20) })).toMatchObject({ label: 'Pago até', days: 20 });
    expect(dueInfo({ ...base, access: 'blocked', trial_ends_at: iso(-10), paid_until: iso(-3) })).toMatchObject({ label: 'Venceu em', days: -3 });
    expect(dueInfo({ ...base, subscription_status: 'suspended' }).date).toBeNull();
  });

  it('textos relativos', () => {
    expect(relativeDays(0)).toBe('hoje');
    expect(relativeDays(1)).toBe('amanhã');
    expect(relativeDays(-1)).toBe('ontem');
    expect(relativeDays(5)).toBe('em 5 dias');
    expect(relativeDays(-4)).toBe('há 4 dias');
  });

  it('receita mensal só de quem paga; anual dividido por 12', () => {
    expect(monthlyValue(base)).toBe(0);
    expect(monthlyValue({ ...base, access: 'active', subscription_status: 'active', billing_cycle: 'monthly', subscription_amount: 49 })).toBe(49);
    expect(monthlyValue({ ...base, access: 'active', subscription_status: 'active', billing_cycle: 'yearly', subscription_amount: 490 })).toBe(40.83);
    expect(monthlyValue({ ...base, access: 'grace', subscription_status: 'past_due', billing_cycle: 'monthly' })).toBe(49);
  });
});

describe('área admin: busca, cadastro e planilha', () => {
  const a = {
    name: 'Assistência São José', slug: 'sao-jose', owner_name: 'Márcia Lima', owner_email: 'marcia@ex.com',
    phone: '(11) 3333-4444', whatsapp: '(11) 98888-7777', owner_phone: null, document: '12.345.678/0001-90',
    address: { cep: '01310-100', rua: 'Av', numero: '1', bairro: 'B', cidade: 'Campinas', uf: 'SP' },
  };

  it('busca por nome, dono, cidade e telefone, sem acento', () => {
    expect(matchesQuery(a, 'sao jose')).toBe(true);
    expect(matchesQuery(a, 'MARCIA')).toBe(true);
    expect(matchesQuery(a, 'campinas')).toBe(true);
    expect(matchesQuery(a, '98888')).toBe(true);
    expect(matchesQuery(a, '12345678')).toBe(true);
    expect(matchesQuery(a, 'rio')).toBe(false);
    expect(matchesQuery(a, '')).toBe(true);
  });

  it('cadastro completo segue a regra do app', () => {
    expect(profileComplete(a)).toBe(true);
    expect(profileComplete({ ...a, whatsapp: null, phone: null })).toBe(false);
    expect(profileComplete({ ...a, address: { ...a.address, cep: '' } })).toBe(false);
  });

  it('CSV para Excel: BOM, ";" e aspas', () => {
    const csv = toCsv(['Nome', 'Obs'], [['Loja "A"', 'x;y'], ['B', null]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Nome;Obs\r\n');
    expect(csv).toContain('"Loja ""A""";"x;y"\r\n');
    expect(csv).toContain('B;\r\n');
  });
});
