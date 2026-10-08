// Teste de ponta a ponta (Playwright). Pré-requisitos:
//   npx supabase start && npx supabase db reset   (banco com o seed)
//   npm run build && npm start                     (app em http://localhost:3000)
//   npm i -D playwright && npx playwright install chromium
// Rodar: node tests/e2e/fluxo-equipe-e-portal.js
// Teste de ponta a ponta do Conserta Já contra a pilha local (GoTrue + PostgREST + Storage).
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const OUT = process.env.E2E_SHOTS_DIR || 'tests/e2e/screenshots';
const PHOTO = require('path').join(__dirname, 'foto-teste.png');
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
let step = 0;
function log(msg) { console.log(`[${++step}] ${msg}`); }

function watch(page, label) {
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${label} console: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => problems.push(`${label} pageerror: ${e.message.slice(0, 300)}`));
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`${label} HTTP ${r.status()} ${r.url()}`); });
}

async function shot(page, name) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); }

async function expectText(page, text, timeout = 10000) {
  await page.getByText(text, { exact: false }).filter({ visible: true }).first().waitFor({ timeout });
}

async function login(page, email) {
  await page.goto(`${BASE}/entrar`);
  await page.fill('#email', email);
  await page.fill('#password', 'consertaja123');
  await Promise.all([page.waitForURL(/\/painel/, { timeout: 15000 }), page.click('button[type=submit]')]);
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  // ---------------------------------------------------------------- equipe (Ana, proprietária)
  const staff = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await staff.newPage();
  watch(p, 'staff');

  await login(p, 'ana@techsp.dev');
  await expectText(p, 'OS abertas');
  await shot(p, '01-dashboard');
  log('login + dashboard ok');

  await p.goto(`${BASE}/painel/os`);
  await expectText(p, 'OS-2026-000001');
  await shot(p, '02-os-list');
  log('lista de OS ok');

  await p.goto(`${BASE}/painel/os?status=todas&q=PlayStation`);
  await expectText(p, 'Carlos Pereira');
  log('busca na lista ok');

  // Nova OS pelo assistente: cliente existente (Maria), equipamento novo
  await p.goto(`${BASE}/painel/os/nova`);
  await p.fill('#term', 'Maria');
  await p.getByRole('button', { name: /Maria Oliveira/ }).first().click();
  await expectText(p, 'Cliente: Maria Oliveira');
  await p.getByRole('button', { name: /Novo equipamento/ }).click();
  await p.selectOption('#e_cat', { label: 'Tablet' });
  await p.fill('#e_brand', 'Samsung');
  await p.fill('#e_model', 'Galaxy Tab S9');
  await p.getByRole('button', { name: /Continuar/ }).click();
  await p.fill('#issue', 'Tela piscando e bateria inchada.');
  await p.getByLabel('Carregador').check();
  await p.getByLabel('Riscos ou arranhões').check();
  await p.fill('#unlock', '2580');
  await p.getByRole('button', { name: /Continuar/ }).click();
  await expectText(p, 'Galaxy Tab S9');
  await shot(p, '03-wizard-review');
  await p.getByRole('button', { name: /Criar OS/ }).click();
  await expectText(p, 'Ordem de serviço criada');
  const code = (await p.locator('p.text-3xl, p.sm\\:text-4xl').first().textContent()).trim();
  const accessCode = (await p.locator('p.font-mono').first().textContent()).trim();
  log(`OS criada ${code} código ${accessCode}`);

  // Foto de entrada (upload direto ao Storage privado)
  await p.locator('input[type=file][capture]').setInputFiles(PHOTO);
  await expectText(p, 'foto(s) enviada(s)', 20000);
  await shot(p, '04-wizard-done');
  log('upload de foto ok');

  await p.getByRole('link', { name: /Concluir e abrir a OS/ }).click();
  await p.waitForURL(/\/painel\/os\/[0-9a-f-]{36}$/);
  const osUrl = p.url();
  await expectText(p, 'Fotos');
  const imgCount = await p.locator('img[alt="Frente"]').count();
  if (imgCount < 1) problems.push('foto não aparece na OS');
  await expectText(p, '2580'); // senha visível para owner
  log('OS detalhe com foto e senha ok');

  // Diagnóstico
  await p.fill('#diagnosis', 'Bateria estufada pressionando o display. Trocar bateria e display.');
  await p.getByRole('button', { name: 'Salvar', exact: true }).first().click();
  await expectText(p, 'OS atualizada');
  log('diagnóstico salvo');

  // Comprovante
  await p.goto(`${osUrl}/comprovante`);
  await expectText(p, 'Comprovante de entrada');
  await expectText(p, accessCode);
  await shot(p, '05-comprovante');
  log('comprovante com QR ok');

  // Orçamento
  await p.goto(`${osUrl}/orcamento`);
  await p.getByRole('button', { name: /Montar orçamento/ }).click();
  await expectText(p, 'Adicionar item');
  const addForm = p.locator('form').filter({ has: p.locator('#new_description') });
  await p.selectOption('#new_kind', 'PECA');
  await p.fill('#new_description', 'Display Galaxy Tab S9');
  await p.fill('#new_quantity', '1');
  await p.fill('#new_unit_price', '899,90');
  await addForm.getByRole('button', { name: /Adicionar/ }).click();
  await expectText(p, 'Item adicionado');
  await p.selectOption('#new_kind', 'SERVICO');
  await p.fill('#new_description', 'Mão de obra');
  await p.fill('#new_quantity', '1');
  await p.fill('#new_unit_price', '200');
  await p.fill('#new_discount_amount', '20');
  await addForm.getByRole('button', { name: /Adicionar/ }).click();
  await p.waitForTimeout(800);
  await p.fill('#discount_amount', '29,90');
  await p.getByRole('button', { name: /Salvar condições/ }).click();
  await expectText(p, 'Condições salvas');
  await p.getByText('R$ 1.050,00').first().waitFor({ timeout: 5000 }).catch(() => {});
  const totalText = await p.locator('dl').first().innerText();
  if (!totalText.includes('1.050,00')) problems.push(`total do orçamento inesperado: ${totalText.replace(/\n/g, ' | ')}`);
  await shot(p, '06-budget-editor');
  // Sem prazo do conserto o envio é barrado no próprio formulário
  await p.fill('#estimated_days', '4');
  p.once('dialog', (d) => d.accept());
  await p.getByRole('button', { name: /Enviar orçamento/ }).click();
  await expectText(p, 'Aguardando o cliente');
  await shot(p, '07-budget-sent');
  log('orçamento montado (R$ 1.050,00) e enviado');

  // ---------------------------------------------------------------- portal do cliente (celular)
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const c = await phone.newPage();
  watch(c, 'portal');
  await c.goto(`${BASE}/a/assistencia-tech-sp?c=${accessCode}`);
  await expectText(c, 'Acompanhe seu conserto');
  await shot(c, '08-portal-login');
  await c.fill('#phone', '11 9999-0000');
  await c.click('button[type=submit]');
  await expectText(c, 'Telefone ou código não conferem');
  log('portal recusa telefone errado com mensagem genérica');
  await c.fill('#phone', '(11) 97654-3210');
  await Promise.all([c.waitForURL(/\/os$/), c.click('button[type=submit]')]);
  await expectText(c, 'Olá, Maria');
  await expectText(c, 'aguardando sua aprovação');
  await shot(c, '09-portal-list');
  log('login no portal ok');

  // Tentativa de abrir OS de outro cliente pela URL
  const other = await c.goto(`${BASE}/a/assistencia-tech-sp/os/OS-2026-000001`);
  if (other.status() !== 404) problems.push(`portal: OS de outro cliente respondeu ${other.status()}`);
  log(`portal: OS de outro cliente → ${other.status()}`);

  await c.goto(`${BASE}/a/assistencia-tech-sp/os/${code}`);
  await expectText(c, 'Ver e aprovar');
  await shot(c, '10-portal-os');
  await c.getByText('Ver e aprovar').click();
  await expectText(c, 'Itens do orçamento');
  await expectText(c, 'Display Galaxy Tab S9');
  await shot(c, '11-portal-budget');
  await c.getByRole('button', { name: /Aprovar orçamento/ }).click();
  await c.getByRole('button', { name: /Confirmar aprovação/ }).click();
  await expectText(c, 'Confirme que leu');
  await c.locator('input[name=accept]').check();
  await c.getByRole('button', { name: /Confirmar aprovação/ }).click();
  await expectText(c, 'Orçamento aprovado');
  await shot(c, '12-portal-approved');
  log('cliente aprovou pelo portal');

  // Portal de outra assistência com o mesmo navegador: não enxerga nada
  await c.goto(`${BASE}/a/conserta-rapido-rio/os`);
  if (!c.url().includes('/a/conserta-rapido-rio') || (await c.getByText('Olá, Maria').count()) > 0) {
    problems.push('sessão do portal vazou para outra assistência');
  }
  log('sessão do portal não vale em outra assistência');

  // ---------------------------------------------------------------- equipe conclui
  await p.goto(osUrl);
  await expectText(p, 'Aprovado');
  await expectText(p, 'Cliente (portal)');
  log('OS mostra aprovação vinda do portal');

  await p.selectOption('#to', 'EM_MANUTENCAO');
  await p.getByRole('button', { name: /Atualizar status/ }).click();
  await expectText(p, 'Status atualizado');
  await p.fill('#solution', 'Bateria e display substituídos, testes ok.');
  await p.getByRole('button', { name: 'Salvar', exact: true }).first().click();
  await expectText(p, 'OS atualizada');
  await p.selectOption('#to', 'PRONTO');
  await p.getByRole('button', { name: /Atualizar status/ }).click();
  await expectText(p, 'Saldo em aberto');
  log('reparo concluído; alerta de saldo em aberto aparece');

  await p.getByRole('button', { name: /Registrar pagamento ou compra/ }).click();
  await p.selectOption('#payment_method', 'PIX');
  await p.getByRole('button', { name: /^Registrar$/ }).click();
  await expectText(p, 'Recebimento registrado');
  await p.reload();
  const due = await p.getByText('Em aberto').first().locator('xpath=..').innerText();
  if (!due.includes('0,00')) problems.push(`saldo após pagamento: ${due}`);
  await p.selectOption('#to', 'ENTREGUE');
  await Promise.all([p.waitForURL(/\/garantia$/, { timeout: 15000 }), p.getByRole('button', { name: /Atualizar status/ }).click()]);
  await expectText(p, 'dias de garantia');
  await expectText(p, 'Declaro que retirei o equipamento');
  await shot(p, '13-certificado-garantia');
  await p.goto(osUrl);
  await expectText(p, 'Garantia até');
  if ((await p.getByText('2580').count()) > 0) problems.push('senha não foi apagada na entrega');
  await shot(p, '13-os-delivered');
  log('pagamento + entrega; certificado de garantia; senha apagada');

  // O cliente vê o certificado no portal (e não vê o de outra OS)
  await c.goto(`${BASE}/a/assistencia-tech-sp/os/${code}`);
  await expectText(c, 'Garantia em vigor até');
  await Promise.all([c.waitForURL(/\/garantia$/), c.getByText('Certificado de garantia').first().click()]);
  await expectText(c, 'dias de garantia');
  await shot(c, '13b-portal-certificado');
  const otherCert = await c.goto(`${BASE}/a/assistencia-tech-sp/os/OS-2026-000001/garantia`);
  if (otherCert.status() !== 404) problems.push(`certificado de outro cliente respondeu ${otherCert.status()}`);
  log('cliente abre o certificado de garantia no portal; o de outra OS dá 404');

  for (const [url, name, text] of [
    ['/painel/caixa', '14-caixa', 'A receber'],
    ['/painel/relatorios', '15-relatorios', 'Lucro estimado'],
    ['/painel/orcamentos?filtro=todos', '16-orcamentos', 'OS-2026'],
    ['/painel/clientes', '17-clientes', 'João da Silva'],
    ['/painel/configuracoes', '18-configuracoes', 'Endereço do portal'],
    ['/painel/usuarios', '19-equipe', 'Convidar pessoa'],
    ['/painel', '20-dashboard-depois', 'Fluxo de caixa'],
  ]) {
    await p.goto(`${BASE}${url}`);
    await expectText(p, text);
    await shot(p, name);
  }
  log('caixa, relatórios, orçamentos, clientes, configurações, equipe ok');

  // Convite
  await p.goto(`${BASE}/painel/usuarios`);
  await p.fill('#email', 'nova.tecnica@techsp.dev');
  await p.getByRole('button', { name: /Gerar convite/ }).click();
  await expectText(p, '/convite/');
  log('convite gerado');

  // ---------------------------------------------------------------- isolamento na interface
  const rio = await browser.newContext();
  const r = await rio.newPage();
  watch(r, 'tenantB');
  await login(r, 'diego@rapidorio.dev');
  const resp = await r.goto(osUrl);
  if (resp.status() !== 404) problems.push(`tenant B abriu OS do tenant A: HTTP ${resp.status()}`);
  await r.goto(`${BASE}/painel/clientes`);
  if ((await r.getByText('Maria Oliveira').count()) > 0) problems.push('tenant B vê clientes de A');
  log(`tenant B → OS de A: ${resp.status()}; clientes isolados`);

  // ---------------------------------------------------------------- técnico
  const tech = await browser.newContext();
  const t = await tech.newPage();
  watch(t, 'tech');
  await login(t, 'bruno@techsp.dev');
  if ((await t.getByText('Saldo do período').count()) > 0) problems.push('técnico vê financeiro no dashboard');
  await t.goto(`${BASE}/painel/relatorios`);
  await t.waitForURL(/aviso=sem-permissao/);
  await t.goto(`${BASE}/painel/caixa`);
  await expectText(t, 'Meus lançamentos');
  log('técnico sem acesso a financeiro/relatórios');

  // Impressão do orçamento: menu e editor somem
  await p.goto(osUrl + '/orcamento');
  await p.emulateMedia({ media: 'print' });
  await shot(p, '21-orcamento-impressao');
  await p.emulateMedia({ media: 'screen' });

  await browser.close();
  console.log('\nPROBLEMAS:', problems.length ? '\n- ' + problems.join('\n- ') : 'nenhum');
})().catch((e) => {
  console.error('FALHOU:', e.message);
  console.log('PROBLEMAS:', problems);
  process.exit(1);
});
