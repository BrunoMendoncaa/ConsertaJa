# Conserta Já

Sistema SaaS para assistências técnicas de eletrônicos e eletrodomésticos: ordem de serviço, fotos de entrada, orçamento versionado com aprovação pelo celular, portal do cliente, caixa e indicadores. Multi-tenant desde o início, com o isolamento entre assistências garantido **dentro do banco** (RLS + chaves estrangeiras compostas + funções que nunca confiam no `assistance_id` vindo da tela).

> Planejamento completo (decisões, modelo de dados, RLS, fluxos): [`docs/PLANEJAMENTO.md`](docs/PLANEJAMENTO.md).

**Receba → Registre → Fotografe → Diagnostique → Orce → Envie → Cliente aprova → Conserte → Receba → Entregue.**

---

## Stack

| Camada | Uso |
| --- | --- |
| Next.js 16 (App Router) + React 19, **JavaScript** | Telas, Server Components e Server Actions |
| Tailwind CSS 4 | Interface (componentes próprios em `src/components/ui`) |
| Supabase Postgres | Dados, RLS, regras de negócio em funções SQL |
| Supabase Auth | Login da equipe (e-mail e senha) |
| Supabase Storage | Fotos (bucket privado) e logos (bucket público) |
| Zod | Validação de formulários no servidor |
| pgTAP · Vitest · Playwright | Testes de banco, unitários e de ponta a ponta |
| Vercel | Hospedagem |

## Estrutura

```text
supabase/
  migrations/        11 migrations em ordem (base, tenancy, clientes, OS, storage, orçamentos, portal, caixa, permissões, garantia no portal, assinatura)
  instalacao/        as migrations juntas para colar no SQL Editor (gerado por npm run db:sql-instalacao)
  seed.sql           2 assistências fictícias, usuários, OS em vários status, orçamentos e caixa
  tests/database/    195 testes pgTAP (isolamento entre tenants, OS, orçamento, portal, garantia, caixa, assinatura)
src/
  app/               rotas: site, login, onboarding, convite, /painel (equipe) e /a/[slug] (portal do cliente)
  features/          regra de negócio por domínio: actions.js (Server Actions), queries.js, components/
  components/        UI compartilhada e layout
  lib/               clientes Supabase, auth, sessão do portal, dinheiro, telefone, CPF/CNPJ, datas, erros
  proxy.js           renova a sessão e protege /painel (antigo middleware)
tests/               unitários (Vitest) e roteiros de ponta a ponta (Playwright)
docs/                planejamento e arquitetura
```

## Preparar o banco

O app só funciona depois que o banco do Supabase recebe as tabelas, regras e funções (as *migrations*). Se a tela mostrar *"O banco de dados ainda não foi preparado"* ou *"Não foi possível criar a assistência"*, é este passo que falta.

### Opção A — Supabase na nuvem, sem instalar nada (mais simples)

1. Abra o projeto em [supabase.com](https://supabase.com) → **SQL Editor** → **New query**.
2. Cole o conteúdo inteiro de [`supabase/instalacao/01-estrutura.sql`](supabase/instalacao/01-estrutura.sql) e clique em **Run**. Se aparecer o aviso de "operações destrutivas", confirme: o script só cria coisas, e roda tudo numa transação (ou instala completo, ou não altera nada).
3. *(Opcional, só em projeto de teste)* Nova query com [`supabase/instalacao/02-dados-de-teste.sql`](supabase/instalacao/02-dados-de-teste.sql) → **Run**. Cria as assistências e logins de teste listados abaixo.
4. Em **Authentication → URL Configuration**: *Site URL* = `http://localhost:3000` (ou o seu domínio) e, em *Redirect URLs*, `http://localhost:3000/**`.

Contas criadas antes do passo 2 continuam valendo: o script cria o perfil que faltava. Os dois arquivos são gerados a partir das migrations com `npm run db:sql-instalacao` (rode de novo sempre que criar uma migration nova).

### Opção B — Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push                 # estrutura
npx supabase db push --include-seed  # estrutura + dados de teste (só em projeto de teste)
```

### Atualizando um banco que já está em uso

Quando chegar uma migration nova em `supabase/migrations/`, cole **só ela** no SQL Editor e rode (na ordem do nome, se forem várias). Os scripts de `supabase/instalacao/` são para banco vazio e se recusam a rodar de novo.

| Migration | O que muda |
| --- | --- |
| `20261008130000_portal_warranty.sql` | Cliente abre o certificado de garantia no portal; o código da OS continua valendo durante a garantia. |
| `20261008140000_billing.sql` | Teste grátis de 14 dias e assinatura pelo Mercado Pago (quem já usa ganha 14 dias a partir da aplicação). |

## Assinatura do Conserta Já (Mercado Pago)

- **Teste grátis de 14 dias, sem cartão**, a partir do cadastro da assistência. Outra assistência do mesmo dono não ganha teste novo.
- **Plano único:** R$ 49/mês ou R$ 490/ano (valores em `src/lib/billing.js`).
- **Sem assinatura** (teste acabou ou pagamento atrasado há mais de 7 dias): a equipe continua vendo, concluindo, entregando e recebendo, mas **não abre OS nova nem convida pessoas**. O portal dos clientes continua no ar. A regra fica no banco (`private.billing_access`).
- O dono ou administrador assina em **Meu plano**: o sistema cria a assinatura no Mercado Pago e leva para o pagamento lá. Na volta, e a cada aviso (webhook), o sistema **consulta a API do Mercado Pago** antes de liberar a conta; nada é liberado só pela URL ou pelo corpo do aviso.

### Configurar

1. Em [Mercado Pago Developers](https://www.mercadopago.com.br/developers) → **Suas integrações** → sua aplicação (produto Assinaturas), copie o **Access Token** para `MP_ACCESS_TOKEN` (no `.env` e na Vercel).
2. Com o sistema publicado, em **Webhooks → Configurar notificações**, cadastre `https://SEU-DOMINIO/api/mercadopago/webhook`, marque **Planos e assinaturas** e copie a **assinatura secreta** para `MP_WEBHOOK_SECRET`.
3. Aplique a migration `20261008140000_billing.sql` (tabela em "Atualizando um banco que já está em uso").

### Testar sem cobrar de verdade

1. Em **Suas integrações → Contas de teste**, crie um **vendedor** e um **comprador**.
2. Use as credenciais do **vendedor de teste** em `MP_ACCESS_TOKEN`.
3. Em **Meu plano**, informe o **e-mail do comprador de teste**, clique em Assinar e, no Mercado Pago, entre com o comprador de teste e pague com um cartão de teste.
4. Volte ao sistema: a conta é liberada quando o pagamento aparece como aprovado (botão **Verificar pagamento**, se o webhook ainda não estiver configurado).

> Credenciais que começam com `APP_USR-` da sua conta principal são de **produção**: cobram de verdade.

## Rodando localmente

Pré-requisitos: **Node 20.9+**. Para o Supabase local, **Docker** e a **Supabase CLI** (`npx supabase`); se preferir usar um projeto na nuvem, pule o `supabase start`/`db reset` e prepare o banco pela [Opção A](#opção-a--supabase-na-nuvem-sem-instalar-nada-mais-simples).

```bash
npm install
npx supabase start          # sobe Postgres, Auth, Storage e API locais
npx supabase db reset       # aplica as migrations e o seed
cp .env.example .env.local  # preencha com os valores do "npx supabase status"
npm run dev                 # http://localhost:3000
```

No `.env.local`, use a *API URL*, a *Publishable key* (ou `anon key`) e a *Secret key* (ou `service_role key`) que o `npx supabase status` mostra.

### Acessos de teste (seed)

Senha de todos: `consertaja123`

| E-mail | Papel | Assistência |
| --- | --- | --- |
| ana@techsp.dev | Proprietária | Assistência Tech São Paulo |
| bruno@techsp.dev | Técnico | Assistência Tech São Paulo |
| carla@techsp.dev | Atendente | Assistência Tech São Paulo |
| diego@rapidorio.dev | Proprietário | Conserta Rápido Rio (para testar isolamento) |

Portal do cliente: abra `http://localhost:3000/a/assistencia-tech-sp?c=TESTE7` e informe o telefone `(11) 98765-4321` (João da Silva). Há um orçamento esperando aprovação.

## Testes

```bash
npm run db:test   # pgTAP: o teste mais importante é 01_tenant_isolation (A não acessa nada de B)
npm test          # Vitest: dinheiro, telefone, CPF/CNPJ, datas, mensagens de erro, permissões do caixa
```

Ponta a ponta (opcional): com o banco resetado e o app rodando (`npm run build && npm start`):

```bash
npm i -D playwright && npx playwright install chromium
node tests/e2e/fluxo-equipe-e-portal.js
node tests/e2e/cadastro-convite-recusa.js
```

Os roteiros cobrem: login, abertura de OS pelo assistente, upload de foto, comprovante com QR, orçamento com cálculo no banco, envio, aprovação e recusa pelo portal no celular, nova versão, decisão no balcão, pagamento, entrega, cancelamento, anulação no caixa, cadastro + onboarding, convite de equipe, e tentativas de acesso cruzado entre assistências e entre clientes.

## Deploy em produção

### 1. Supabase

1. Crie o projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. Aplique o banco:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push          # NÃO rode o seed em produção
   ```
   Os buckets `service-order-photos` (privado) e `logos` (público) são criados pela migration.
3. **Authentication → URL Configuration**: *Site URL* = `https://seu-dominio.com.br`; *Redirect URLs* = `https://seu-dominio.com.br/auth/confirm`.
4. **Authentication → SMTP**: configure um SMTP próprio (ex.: Resend). O envio padrão do Supabase é só para testes e tem limite baixo.
5. (Recomendado) **Database → Extensions**: ative `pg_cron` e agende a limpeza de sessões/tentativas do portal:
   ```sql
   select cron.schedule('limpeza-portal', '15 3 * * *', $$select private.cleanup_portal()$$);
   ```

### 2. Vercel

1. Importe o repositório.
2. Variáveis de ambiente (Production e Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (**somente servidor**, nunca com prefixo `NEXT_PUBLIC_`)
   - `NEXT_PUBLIC_SITE_URL` = `https://seu-dominio.com.br`
3. Deploy. Configure o domínio próprio.

## Segurança: como o isolamento funciona

- **Tenant vindo do banco:** `profiles.active_assistance_id` + vínculo ativo em `assistance_members`. O trigger `enforce_tenant` sobrescreve qualquer `assistance_id` que a API tente gravar, e o privilégio de coluna nem permite enviá-lo.
- **RLS em todas as tabelas**, sem nenhuma policy para `anon`. Funções nas policies são chamadas como `(select ...)` para rodar uma vez por consulta.
- **FKs compostas** `(assistance_id, id)`: o próprio Postgres recusa ligar OS, equipamento, orçamento, item, foto ou lançamento a registros de outra assistência.
- **Portal do cliente sem conta:** telefone + código de 6 caracteres da OS. Sessão própria (token no cookie `httpOnly`, banco guarda só o hash), limite de tentativas e funções `portal_*` que tiram assistência e cliente **da sessão**. Trocar o código da OS na URL devolve "não encontrada".
- **Orçamento imutável:** o envio congela um snapshot com hash SHA-256; o cliente aprova informando o hash do que viu. Mudar algo cria nova versão.
- **Caixa só com dinheiro real**; previsto e a receber são calculados. Nada é apagado: lançamentos errados são anulados com motivo.
- **Chave secreta** usada só em `src/lib/supabase/admin.js` (`server-only`), apenas para assinar URLs de fotos já autorizadas pelo banco.
- **Auditoria** (`audit_logs`) com eventos semânticos (orçamento enviado/aprovado/recusado, OS cancelada/entregue, lançamento anulado…). Anonimização LGPD apaga os dados pessoais também da trilha.

### Regras para novas migrations

1. `alter table ... enable row level security` + policies por `assistance_id = (select private.current_assistance_id())`.
2. Colunas `assistance_id ... default private.current_assistance_id()` + trigger `a_enforce_tenant`.
3. FKs para tabelas de tenant sempre compostas `(assistance_id, x_id)`.
4. Views com `with (security_invoker = true)`.
5. Funções `security definer` só quando necessário, sempre com `set search_path = ''` e filtro explícito por tenant.
6. Ao final: `revoke all on <nova tabela> from anon;` e `grant execute` só nas funções que a tela usa.
7. Escreva o teste pgTAP de isolamento da nova tabela antes de criar a tela.

## Papéis

| Função | Pode |
| --- | --- |
| Proprietário | Tudo, inclusive equipe, configurações, caixa e relatórios |
| Administrador | Igual ao proprietário, exceto convidar administradores e alterar proprietários |
| Técnico | OS, diagnóstico, orçamentos, fotos, senha de desbloqueio, compra de peças e recebimentos. Não vê saldo nem relatórios |
| Atendente | Clientes, abertura e entrega de OS, recebimentos, decisão do cliente no balcão |

## Próximos passos (fora do escopo atual, com os ganchos prontos)

OTP por WhatsApp/SMS no portal (`login_method = 'OTP'`), notificações automáticas, retorno em garantia (`parent_service_order_id`), PDF de OS/orçamento (bucket `documents`), cobrança do SaaS (`plan`, `subscription_status`), estoque de peças, comissão de técnicos, múltiplas unidades, nota fiscal e PWA.
