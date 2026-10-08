// Teste de ponta a ponta (Playwright). Pré-requisitos:
//   npx supabase start && npx supabase db reset   (banco com o seed)
//   npm run build && npm start                     (app em http://localhost:3000)
//   npm i -D playwright && npx playwright install chromium
// Rodar: node tests/e2e/cadastro-convite-recusa.js
// Segundo roteiro: cadastro + onboarding, configurações, clientes, convite, recusa pelo portal,
// nova versão, decisão no balcão, cancelamento e anulação no caixa.
const { chromium } = require('playwright');
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const OUT = process.env.E2E_SHOTS_DIR || 'tests/e2e/screenshots';
const PHOTO = require('path').join(__dirname, 'foto-teste.png');
require('fs').mkdirSync(OUT, { recursive: true });
const problems = [];
const pages = [];
let step = 0;
const log = (m) => console.log(`[${++step}] ${m}`);
function watch(page, label) {
  pages.push([label, page]);
  page.on('pageerror', (e) => problems.push(`${label} pageerror: ${e.message.slice(0, 300)}`));
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`${label} HTTP ${r.status()} ${r.url()}`); });
}
const expectText = (page, text, timeout = 10000) => page.getByText(text, { exact: false }).filter({ visible: true }).first().waitFor({ timeout });
async function login(page, email, password = 'consertaja123') {
  await page.goto(`${BASE}/entrar`);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([page.waitForURL(/\/painel|\/onboarding|\/convite/, { timeout: 15000 }), page.click('button[type=submit]')]);
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const stamp = Date.now().toString(36);

  // 1. Cadastro + onboarding
  const n = await (await browser.newContext()).newPage();
  watch(n, 'novo');
  await n.goto(`${BASE}/cadastro`);
  await n.fill('#full_name', 'Pedro Novo');
  await n.fill('#email', `pedro.${stamp}@teste.dev`);
  await n.fill('#password', 'senhaforte123');
  await Promise.all([n.waitForURL(/\/onboarding/, { timeout: 15000 }), n.click('button[type=submit]')]);
  await n.fill('#name', 'Oficina Teste Ltda');
  const slug = await n.inputValue('#slug');
  if (slug !== 'oficina-teste-ltda') problems.push(`slug sugerido: ${slug}`);
  await n.fill('#slug', `oficina-${stamp}`);
  await Promise.all([n.waitForURL(/\/painel$/, { timeout: 15000 }), n.click('button[type=submit]')]);
  await expectText(n, 'Oficina Teste Ltda');
  log('cadastro + onboarding criam a assistência e caem no painel');

  // slug reservado
  await n.goto(`${BASE}/onboarding?nova=1`);
  await n.fill('#name', 'Painel');
  await n.fill('#slug', 'painel');
  await n.click('button[type=submit]');
  await expectText(n, 'reservado');
  log('slug reservado é recusado');

  // 2. Configurações + logo
  await n.goto(`${BASE}/painel/configuracoes`);
  await n.fill('#whatsapp', '(21) 99999-0000');
  await n.fill('#business_hours', 'Seg a sáb, 8h às 18h');
  await n.fill('#diagnosis_fee', '35,00');
  await n.getByRole('button', { name: /Salvar configurações/ }).click();
  await expectText(n, 'Configurações salvas');
  await n.locator('input[type=file]').setInputFiles(PHOTO);
  await n.locator('img[alt="Logo atual"]').waitFor({ timeout: 15000 });
  await n.screenshot({ path: `${OUT}/30-config-logo.png`, fullPage: true });
  log('configurações salvas e logo enviado');

  // telefone inválido nas configurações
  await n.fill('#whatsapp', '123');
  await n.getByRole('button', { name: /Salvar configurações/ }).click();
  await expectText(n, 'Telefone inválido');
  log('validação de telefone nas configurações');

  // 3. Clientes
  await n.goto(`${BASE}/painel/clientes/novo`);
  await n.fill('#name', 'Cliente Teste');
  await n.fill('#phone', '(21) 98888-1111');
  await n.fill('#document', '111.111.111-11');
  await n.getByRole('button', { name: /Salvar cliente/ }).click();
  await expectText(n, 'CPF/CNPJ inválido');
  await n.fill('#document', '529.982.247-25');
  await Promise.all([n.waitForURL(/\/painel\/clientes\/[0-9a-f-]{36}$/), n.getByRole('button', { name: /Salvar cliente/ }).click()]);
  await n.getByRole('button', { name: /Adicionar equipamento/ }).click();
  await n.selectOption('#category_id', { label: 'Notebook' });
  await n.fill('#brand', 'Acer');
  await n.fill('#model', 'Aspire 5');
  await n.getByRole('button', { name: /Salvar equipamento/ }).click();
  await expectText(n, 'Equipamento cadastrado');
  await n.reload();
  await expectText(n, 'Acer Aspire 5');
  log('cliente com CPF validado e equipamento cadastrados');

  await n.goto(`${BASE}/painel/clientes/novo`);
  await n.fill('#name', 'Duplicado');
  await n.fill('#phone', '21988881111');
  await n.getByRole('button', { name: /Salvar cliente/ }).click();
  await expectText(n, 'Já existe um cliente com este telefone');
  log('telefone duplicado recusado com mensagem amigável');

  // 4. Convite (Ana convida, nova pessoa aceita)
  const ana = await (await browser.newContext()).newPage();
  watch(ana, 'ana');
  await login(ana, 'ana@techsp.dev');
  await ana.goto(`${BASE}/painel/usuarios`);
  const guest = `convidado.${stamp}@teste.dev`;
  await ana.fill('#email', guest);
  await ana.selectOption('#role', 'attendant');
  await ana.getByRole('button', { name: /Gerar convite/ }).click();
  const linkText = await ana.locator('p.break-all').first().textContent();
  const inviteUrl = linkText.trim();
  log(`convite gerado ${inviteUrl.slice(0, 50)}…`);

  const g = await (await browser.newContext()).newPage();
  watch(g, 'convidado');
  await g.goto(inviteUrl);
  await expectText(g, 'Você foi convidado');
  await g.getByRole('link', { name: /Criar conta com/ }).click();
  await g.fill('#full_name', 'Joana Convidada');
  await g.fill('#email', guest);
  await g.fill('#password', 'senhaforte123');
  await Promise.all([g.waitForURL(/\/convite\//, { timeout: 15000 }), g.click('button[type=submit]')]);
  await Promise.all([g.waitForURL(/\/painel/, { timeout: 15000 }), g.getByRole('button', { name: /Aceitar convite/ }).click()]);
  await expectText(g, 'Assistência Tech São Paulo');
  await expectText(g, 'Atendente');
  log('convite aceito: nova atendente entra na assistência certa');

  // 5. Recusa pelo portal (João, OS-000001, código TESTE7)
  const c = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  watch(c, 'portal');
  await c.goto(`${BASE}/a/assistencia-tech-sp?c=TESTE7`);
  await c.fill('#phone', '11987654321');
  await Promise.all([c.waitForURL(/\/os$/), c.click('button[type=submit]')]);
  await expectText(c, 'Olá, João');
  const tvCount = await c.getByText('Smart TV').count();
  if (tvCount < 1) problems.push('João deveria ver a TV também (mesmo cliente)');
  if ((await c.getByText('IdeaPad').count()) > 0) problems.push('João vê OS da outra assistência');
  await c.goto(`${BASE}/a/assistencia-tech-sp/os/OS-2026-000001/orcamento`);
  if (await c.getByRole('button', { name: /Recusar orçamento/ }).count()) {
    await c.getByRole('button', { name: /Recusar orçamento/ }).click();
    await c.getByRole('button', { name: /Confirmar recusa/ }).click();
    await expectText(c, 'Conte rapidamente o motivo');
    await c.fill('#reason', 'Vou pesquisar outro preço.');
    await c.getByRole('button', { name: /Confirmar recusa/ }).click();
  }
  await expectText(c, 'Orçamento recusado');
  await expectText(c, 'Vou pesquisar outro preço');
  await c.screenshot({ path: `${OUT}/32-portal-recusado.png`, fullPage: true });
  log('cliente recusou pelo portal com motivo');

  // 6. Nova versão + decisão no balcão
  await ana.goto(`${BASE}/painel/os?status=ORCAMENTO_RECUSADO`);
  await Promise.all([ana.waitForURL(/\/painel\/os\/[0-9a-f-]{36}$/), ana.getByRole('link', { name: 'OS-2026-000001' }).click()]);
  await expectText(ana, 'Recusado');
  const osUrl = ana.url();
  await ana.goto(`${osUrl}/orcamento`);
  await ana.getByRole('button', { name: /Nova versão/ }).click();
  await expectText(ana, 'Versão 2');
  await ana.getByRole('button', { name: /Editar/ }).first().click();
  const editForm = ana.locator('form').filter({ hasText: 'Salvar item' }).first();
  await editForm.locator('input[name=unit_price]').fill('400,00');
  await editForm.getByRole('button', { name: /Salvar item/ }).click();
  await expectText(ana, 'Item atualizado');
  ana.once('dialog', (d) => d.accept());
  await ana.getByRole('button', { name: /Enviar orçamento/ }).click();
  await expectText(ana, 'Registrar decisão do cliente');
  await ana.selectOption('#channel', 'TELEFONE');
  await ana.getByRole('button', { name: /Registrar decisão/ }).click();
  await expectText(ana, 'Por telefone em');
  await ana.goto(`${osUrl}/orcamento?versao=1`);
  await expectText(ana, 'Vou pesquisar outro preço');
  await ana.screenshot({ path: `${OUT}/31-versao-1-recusada.png`, fullPage: true });
  log('v1 recusada preservada; v2 enviada e aprovada por telefone');

  // 7. Cancelamento (OS-000006)
  await ana.goto(`${BASE}/painel/os?status=todas&q=Micro`);
  await Promise.all([ana.waitForURL(/\/painel\/os\/[0-9a-f-]{36}$/), ana.getByRole('link', { name: 'OS-2026-000006' }).click()]);
  await ana.getByText('Cancelar OS').first().click();
  await ana.fill('#cancel_note', 'Cliente desistiu do conserto.');
  ana.once('dialog', (d) => d.accept());
  await ana.getByRole('button', { name: 'Cancelar OS' }).click();
  await expectText(ana, 'OS cancelada');
  log('OS cancelada com motivo');

  // 8. Caixa: despesa e anulação
  await ana.goto(`${BASE}/painel/caixa`);
  await ana.selectOption('#category', 'DESPESA_OPERACIONAL');
  await ana.fill('#amount', '123,45');
  await ana.fill('#description', 'Material de limpeza');
  await ana.getByRole('button', { name: /^Registrar$/ }).click();
  await expectText(ana, 'Saída registrada');
  await ana.reload();
  const row = ana.locator('tr').filter({ hasText: 'Material de limpeza' });
  await row.getByText('Anular').click();
  await row.locator('input[name=reason]').fill('Lançado errado');
  await row.getByRole('button', { name: 'OK' }).click();
  await expectText(ana, 'Anulado: Lançado errado');
  log('despesa registrada e anulada (continua visível, fora do saldo)');

  // recebimento sem OS → erro de validação
  await ana.selectOption('#category', 'RECEBIMENTO_OS');
  await ana.fill('#amount', '10');
  await ana.fill('#description', 'Sem OS');
  await ana.getByRole('button', { name: /^Registrar$/ }).click();
  await expectText(ana, 'Selecione a OS deste lançamento');
  log('recebimento sem OS é recusado');

  await browser.close();
  console.log('\nPROBLEMAS:', problems.length ? '\n- ' + problems.join('\n- ') : 'nenhum');
})().catch(async (e) => {
  console.error('FALHOU:', e.message.split('\n').slice(0, 3).join(' | '));
  for (const [label, pg] of pages) { try { await pg.screenshot({ path: `${OUT}/fail-${label}.png`, fullPage: true }); console.log('shot', label, pg.url()); } catch {} }
  console.log('PROBLEMAS:', problems); process.exit(1);
});
