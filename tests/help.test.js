import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GUIDES, FAQ, HELP_CATEGORIES, guidesForRole, faqForRole, getGuide, searchableText } from '@/features/help/guides';
import { HELP_MEDIA } from '@/features/help/media-manifest';
import { normalizeSearch, matchesSearch, splitBold } from '@/features/help/text';
import { ALL_ROLES, TECH_ROLES, MANAGER_ROLES, OS_STATUS } from '@/lib/constants';

const ROOT = path.resolve(import.meta.dirname, '..');
const allTexts = (g) => [
  g.title, g.summary, ...(g.steps || []).flatMap((s) => [s.title, s.text]), ...(g.tips || []),
  ...(g.table?.rows || []).flat(),
];

/** Funções que podem abrir uma tela do painel, lidas do requireStaff(...) da própria página. */
function rolesForRoute(href) {
  const file = path.join(ROOT, 'src/app', href, 'page.js');
  const src = fs.readFileSync(file, 'utf8');
  if (/requireStaff\(MANAGER_ROLES\)/.test(src)) return MANAGER_ROLES;
  if (/requireStaff\(TECH_ROLES\)/.test(src)) return TECH_ROLES;
  return ALL_ROLES;
}

describe('central de ajuda: conteúdo', () => {
  it('cada guia tem endereço único e categoria válida', () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of GUIDES) {
      expect(g.slug).toMatch(/^[a-z0-9-]+$/);
      expect(HELP_CATEGORIES.map((c) => c.id)).toContain(g.category);
      expect(g.steps.length).toBeGreaterThan(0);
    }
    for (const c of HELP_CATEGORIES) expect(GUIDES.some((g) => g.category === c.id)).toBe(true);
  });

  it('funções e guias relacionados existem', () => {
    for (const g of [...GUIDES, ...FAQ]) {
      expect(g.roles.length).toBeGreaterThan(0);
      for (const r of g.roles) expect(ALL_ROLES).toContain(r);
    }
    for (const g of GUIDES) {
      for (const rel of g.related || []) {
        expect(rel).not.toBe(g.slug);
        expect(GUIDES.some((x) => x.slug === rel)).toBe(true);
      }
    }
  });

  it('negrito sempre fechado (pares de **)', () => {
    for (const g of GUIDES) for (const t of allTexts(g)) expect((t.match(/\*\*/g) || []).length % 2).toBe(0);
    for (const f of FAQ) expect((f.a.match(/\*\*/g) || []).length % 2).toBe(0);
  });

  it('prints e vídeos existem em public/ajuda e têm medidas', () => {
    for (const g of GUIDES) {
      for (const m of g.media || []) {
        for (const file of [m.file, m.poster].filter(Boolean)) {
          expect(HELP_MEDIA[file], file).toBeTruthy();
          expect(fs.existsSync(path.join(ROOT, 'public/ajuda', file)), file).toBe(true);
        }
        if (m.type === 'image') expect(m.alt, m.file).toBeTruthy();
      }
    }
    for (const file of Object.keys(HELP_MEDIA)) expect(fs.existsSync(path.join(ROOT, 'public/ajuda', file)), file).toBe(true);
  });

  it('tabela de status usa códigos de status existentes (todos os 10)', () => {
    const t = GUIDES.find((g) => g.table?.statusColumn).table;
    for (const row of t.rows) expect(Object.keys(OS_STATUS)).toContain(row[0]);
    expect(t.rows).toHaveLength(Object.keys(OS_STATUS).length);
  });

  it('o botão "Abrir…" só aparece para quem consegue abrir a tela', () => {
    for (const g of GUIDES.filter((x) => x.screen)) {
      const allowed = rolesForRoute(g.screen.href);
      for (const r of g.roles) expect(allowed, `${g.slug} → ${g.screen.href} (${r})`).toContain(r);
    }
  });
});

describe('central de ajuda: permissões', () => {
  it('técnico não vê guias de caixa, relatórios, equipe, configurações e plano', () => {
    const slugs = guidesForRole('technician').map((g) => g.slug);
    for (const s of ['caixa', 'relatorios', 'convidar-equipe', 'configurar-assistencia', 'meu-plano', 'comece-por-aqui']) expect(slugs).not.toContain(s);
    expect(slugs).toContain('montar-orcamento');
    expect(slugs).toContain('fornecedores');
  });

  it('atendente não vê montagem de orçamento nem fornecedores', () => {
    const slugs = guidesForRole('attendant').map((g) => g.slug);
    expect(slugs).not.toContain('montar-orcamento');
    expect(slugs).not.toContain('fornecedores');
    expect(slugs).toContain('abrir-os');
    expect(slugs).toContain('entrega-e-garantia');
  });

  it('proprietário vê todos os guias', () => {
    expect(guidesForRole('owner')).toHaveLength(GUIDES.length);
  });

  it('getGuide esconde guia de outra função e endereço inexistente', () => {
    expect(getGuide('caixa', 'technician')).toBeNull();
    expect(getGuide('caixa', 'admin')?.slug).toBe('caixa');
    expect(getGuide('nao-existe', 'owner')).toBeNull();
  });

  it('perguntas frequentes respeitam a função', () => {
    expect(faqForRole('attendant').some((f) => f.q.includes('Preciso mudar um orçamento'))).toBe(false);
    expect(faqForRole('owner').length).toBe(FAQ.length);
  });
});

describe('central de ajuda: busca e texto', () => {
  it('busca ignora acentos e maiúsculas', () => {
    expect(normalizeSearch('  Orçamento  APROVAÇÃO ')).toBe('orcamento aprovacao');
    const hay = searchableText(GUIDES.find((g) => g.slug === 'montar-orcamento'));
    expect(matchesSearch(hay, 'orcamento')).toBe(true);
    expect(matchesSearch(hay, 'ORÇAMENTO versão')).toBe(true);
    expect(matchesSearch(hay, 'orçamento helicóptero')).toBe(false);
  });

  it('palavras comuns encontram o guia certo', () => {
    const find = (q) => GUIDES.filter((g) => matchesSearch(searchableText(g), q)).map((g) => g.slug);
    expect(find('garantia')).toContain('entrega-e-garantia');
    expect(find('imei')).toContain('clientes-e-equipamentos');
    expect(find('pix')).toContain('registrar-pagamentos');
    expect(find('convite')).toContain('convidar-equipe');
  });

  it('splitBold separa os trechos em negrito', () => {
    expect(splitBold('Clique em **Salvar** e pronto')).toEqual([
      { text: 'Clique em ', bold: false }, { text: 'Salvar', bold: true }, { text: ' e pronto', bold: false },
    ]);
    expect(splitBold('**Só negrito**')).toEqual([{ text: 'Só negrito', bold: true }]);
  });
});
