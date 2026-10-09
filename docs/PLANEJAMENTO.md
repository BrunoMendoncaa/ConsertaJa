# TecnoFix (antes Conserta Já) — Planejamento e Arquitetura

08/10/2026 · Bruno · Cópia do documento vivo: https://claude.ai/code/artifact/90d49dd3-9414-48e8-a259-b80ea2652d2e (diagramas e respostas às decisões ficam lá)

## 1. Resumo e decisões pendentes

O TecnoFix fica de pé com 19 tabelas, isolamento entre assistências garantido em três camadas dentro do banco e um portal do cliente que não exige criar conta. A Fase 1 começa quando você responder as 7 decisões abaixo.

As escolhas de arquitetura que sustentam o resto do documento:

- **O tenant vem do banco, nunca da tela.** A assistência ativa fica em `profiles.active_assistance_id`, validada contra `assistance_members`. Um trigger sobrescreve qualquer `assistance_id` enviado pelo frontend.
- **Chaves estrangeiras compostas** `(assistance_id, id)` tornam impossível ligar a OS da Assistência A a um cliente da Assistência B, mesmo por um script com chave secreta.
- **Portal do cliente sem conta:** telefone + código de acesso da OS (impresso no comprovante ou enviado por link no WhatsApp) no MVP; OTP por WhatsApp/SMS depois, reaproveitando a mesma sessão.
- **Orçamento enviado é imutável:** o envio congela um snapshot com hash. Qualquer alteração gera uma nova versão.
- **O caixa só registra dinheiro real.** "Previsto" e "a receber" são calculados a partir dos orçamentos, nunca lançados como movimentação.

| # | Decisão | Minha recomendação | Alternativa | Sua resposta |
| --- | --- | --- | --- | --- |
| 1 | Lista de status da OS | 10 status enxutos (seção 9) | Manter os 12 originais | Aceito a recomendação |
| 2 | Login do cliente no MVP | Telefone + código de acesso da OS | OTP por SMS/WhatsApp já na Fase 5 (exige provedor pago) | Vamos discutir |
| 3 | Numeração da OS | Reinicia por ano: OS-2026-000001 | Sequência contínua, sem ano | Aceito a recomendação |
| 4 | Cadastro de assistências | Autoatendimento: o usuário se cadastra e cria a assistência | Só você cria as assistências | Aceito a recomendação |
| 5 | Telefone do cliente | Único por assistência (1 telefone = 1 cliente) | Permitir telefone compartilhado (família) | Aceito a recomendação |
| 6 | Técnico vê o financeiro? | Não: caixa e indicadores financeiros só para proprietário/admin | Técnico vê valores das próprias OS | Aceito a recomendação |
| 7 | Entregar com saldo devedor | Permitido, com alerta e registro em auditoria | Bloquear a entrega até quitar | Aceito a recomendação |

## 2. Problemas e ambiguidades nos requisitos

Encontrei 18 pontos; os 5 primeiros afetam segurança e precisam estar resolvidos antes de qualquer tela.

| # | Ponto | Problema | Proposta |
| --- | --- | --- | --- |
| 1 | Login do cliente por telefone | Só o telefone é adivinhável. OTP exige provedor pago de SMS/WhatsApp desde o dia 1. | MVP: telefone + código de acesso de 6 caracteres da OS. OTP entra depois sem mudar a sessão. |
| 2 | "Garantido pelo RLS" no portal | RLS filtra linhas, não colunas: o cliente veria observações internas, custos e fornecedor da própria OS. | Tabelas fechadas para anônimos. O portal lê por funções do banco que validam sessão + assistência + cliente e devolvem só colunas públicas. |
| 3 | Fotos privadas no portal | Gerar URL assinada exige permissão no Storage, e o cliente não tem conta. | O servidor assina a URL apenas dos caminhos que a função do banco autorizou para aquela sessão. |
| 4 | Senha/padrão de desbloqueio | Técnicos de celular pedem a senha do aparelho; não está previsto e é dado muito sensível. | Tabela separada, só técnico/admin leem, apagada automaticamente na entrega ou cancelamento. |
| 5 | LGPD | Telefone, CPF, endereço e fotos são dados pessoais. | Termo na entrada da OS, anonimização do cliente em vez de exclusão quando houver OS ou financeiro. |
| 6 | Status da OS misturam o orçamento | ORCAMENTO\_PENDENTE/APROVADO/REPROVADO repetem o status do orçamento; PRONTO e AGUARDANDO\_RETIRADA são o mesmo estado. | OS descreve o trabalho; o orçamento tem status próprio e move a OS por gatilho. 10 status (seção 9). |
| 7 | Desfecho da OS | Não há como dizer "devolvido sem reparo" ou "reparo inviável". | Campo `outcome`: REPARADO, NAO\_REPARADO\_RECUSADO, NAO\_REPARADO\_INVIAVEL. |
| 8 | Acessórios e condição de entrada | Aparecem no equipamento e na OS. Mudam a cada visita. | Ficam só na OS. |
| 9 | `tipo` e `categoria` do equipamento | Mesma informação duas vezes. | Só categoria, em tabela (permite novas categorias sem migration). |
| 10 | Tabelas `budgets`, `payments`, `parts` | `budgets` não guarda nada que não seja derivável das versões; `payments` duplica o caixa; `parts` só faz sentido com estoque. | Ficam `budget_versions` + `budget_items` e `cash_transactions`. Estoque fica para o futuro. |
| 11 | "Pagamento de serviço" x "pagamento de orçamento" | São o mesmo dinheiro. | Uma categoria: Recebimento de OS (aceita pagamento parcial e sinal). |
| 12 | "Previsto" no caixa | Se lançado como movimentação, duplica quando o pagamento entra. | Previsto e a receber são consultas sobre os orçamentos, nunca lançamentos. |
| 13 | Orçamento complementar | Defeito novo achado durante o reparo não está previsto. | Nova versão. Se for recusada, a última versão aprovada continua valendo. |
| 14 | Aprovação no balcão ou por telefone | Só a aprovação pelo portal está prevista. | Atendente registra a decisão com canal e usuário responsável. |
| 15 | Taxa de diagnóstico | Comum quando o orçamento é recusado. Em regra não se cobra orçamento; a exceção é serviço com desmontagem ou deslocamento, informado antes ([MPCE/Decon](https://mpce.mp.br/decon/duvidas/servicos/cobranca-por-orcamento-e-legal/)). | Taxa configurável por assistência, exibida no comprovante de entrada. |
| 16 | Conteúdo mínimo do orçamento | O CDC pede mão de obra e materiais discriminados, condições de pagamento e datas; sem estipulação, validade de 10 dias ([MPCE/Decon](https://mpce.mp.br/decon/duvidas/servicos/cobranca-por-orcamento-e-legal/)). | Validade padrão de 10 dias e prazo obrigatório ao enviar. Vale confirmar os textos com um advogado. |
| 17 | "Faturamento" e "ticket médio" | Não está definido se é por recebimento ou por serviço concluído. | Faturamento = recebimentos no período. Ticket médio = total aprovado das OS entregues ÷ nº de OS entregues. |
| 18 | Slug da assistência | Mudar o slug quebra links e QR codes já entregues. | Slug fixo após a criação; mudança só pelo suporte, com redirecionamento. |

Dois pontos operacionais ficam fora da tabela: o e-mail padrão do Supabase Auth serve só para testes, então produção precisa de SMTP próprio; e a cobrança do próprio SaaS (planos, trial) não está nos requisitos, então deixo só as colunas `plan` e `subscription_status` prontas.

## 3. Melhorias propostas

Além das correções acima, proponho 10 melhorias de baixo custo que entram nas fases já previstas.

- **Comprovante de entrada com QR code e código de acesso** (Fase 3): página imprimível e botão "Enviar no WhatsApp" via link `wa.me` com a mensagem pronta. Custo zero de API.
- **Snapshot + hash do orçamento enviado** (Fase 4): prova exatamente o que o cliente aprovou, mesmo que a assistência mude endereço ou preços depois.
- **Fotos de saída** além das de entrada: registram o estado do aparelho na entrega.
- **Compressão de imagem no navegador** antes do upload: fotos de celular de 4–12 MB caem para algumas centenas de KB e perdem os metadados de GPS.
- **Checklist de condição de entrada** (liga, tela trincada, oxidação, riscos), guardado em `jsonb` para poder variar por categoria depois.
- **Busca única** por telefone, nome, CPF, IMEI ou nº de série, com índice trigram por assistência.
- **Garantia calculada:** `warranty_until` = data de entrega + dias de garantia da versão aprovada. Retorno em garantia abre nova OS ligada à original (campo já criado, tela no futuro).
- **Estorno lógico no caixa:** nenhum lançamento é apagado; um lançamento errado é anulado com motivo e usuário.
- **Erros amigáveis com rastreio:** códigos do Postgres viram mensagens em português; o log técnico guarda um ID que aparece discretamente na tela para suporte.
- **Testes de isolamento no CI:** os testes pgTAP de "Tenant A não enxerga Tenant B" rodam a cada migration.

## 4. Modelo de dados

São 19 tabelas, criadas fase a fase; cada uma tem um motivo listado abaixo e nenhuma existe só "para o futuro".

| Tabela | Guarda | Fase |
| --- | --- | --- |
| `assistances` | A assistência (tenant): identidade, contato, padrões de orçamento, plano | 1 |
| `profiles` | Usuário interno (1:1 com `auth.users`) e assistência ativa | 1 |
| `assistance_members` | Vínculo usuário ↔ assistência com papel | 1 |
| `assistance_invitations` | Convites para técnicos e atendentes | 1 |
| `assistance_counters` | Contadores por assistência (numeração da OS sem concorrência) | 1 |
| `audit_logs` | Trilha de auditoria (só inserção) | 1 |
| `customers` | Clientes | 2 |
| `equipment_categories` | Categorias padrão + personalizadas por assistência | 2 |
| `equipment` | Equipamentos do cliente | 2 |
| `service_orders` | Ordens de serviço | 3 |
| `service_order_status_history` | Histórico de status (também alimenta a linha do tempo do portal) | 3 |
| `service_order_photos` | Metadados das fotos (arquivo no Storage) | 3 |
| `service_order_secrets` | Senha de desbloqueio, apagada na entrega (opcional) | 3 |
| `budget_versions` | Cada versão do orçamento, com totais, snapshot e decisão | 4 |
| `budget_items` | Itens (serviço/peça) de uma versão | 4 |
| `portal_sessions` | Sessões do cliente no portal | 5 |
| `portal_login_attempts` | Tentativas de login (limite contra força bruta) | 5 |
| `suppliers` | Fornecedores | 6 |
| `cash_transactions` | Entradas e saídas reais de dinheiro | 6 |

Convenções aplicadas em todas as tabelas:

- Chave primária `uuid` com `gen_random_uuid()`.
- `assistance_id not null` em toda tabela de tenant, com default `private.current_assistance_id()` e um trigger que sobrescreve o valor enviado e bloqueia mudança posterior.
- Tabelas "pai" têm `unique (assistance_id, id)` para servirem de alvo a FKs compostas (seção 5).
- Dinheiro em `numeric(12,2)`, quantidade em `numeric(10,3)`. Nunca `float`.
- `created_at` e `updated_at` em `timestamptz`; trigger `set_updated_at`.
- Conjuntos fechados (status, categoria) como `text` + `check`: mais fácil de evoluir do que `enum`.
- Nomes de tabela e coluna em inglês; rótulos da interface em português.

### 4.1 Tenancy e usuários

```sql
create schema if not exists private;          -- funções auxiliares, fora da API REST
create extension if not exists pg_trgm;
create extension if not exists btree_gin;
create extension if not exists citext;

create table public.assistances (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(name) between 2 and 120),
  slug             text not null unique
                   check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 50),
  legal_name       text,
  document         text check (document ~ '^([0-9]{11}|[0-9]{14})$'),  -- CPF/CNPJ
  phone            text,
  whatsapp         text,
  email            citext,
  address          jsonb not null default '{}',   -- cep, rua, numero, bairro, cidade, uf
  logo_path        text,                          -- bucket público "logos"
  brand_color      text check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  business_hours   text,
  welcome_message  text,
  warranty_policy  text,
  entry_terms      text,                          -- termo impresso no comprovante
  default_budget_validity_days int not null default 10 check (default_budget_validity_days between 1 and 90),
  default_warranty_days        int not null default 90 check (default_warranty_days between 0 and 3650),
  diagnosis_fee    numeric(12,2) not null default 0 check (diagnosis_fee >= 0),
  settings         jsonb not null default '{}',   -- ex.: {"portal_show_photos": true}
  plan             text not null default 'trial',
  subscription_status text not null default 'trialing'
                   check (subscription_status in ('trialing','active','past_due','suspended','canceled')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text not null default '',
  phone                text,
  active_assistance_id uuid references public.assistances(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.assistance_members (
  assistance_id uuid not null references public.assistances(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role          text not null check (role in ('owner','admin','technician','attendant')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  primary key (assistance_id, user_id)
);
create index on public.assistance_members (user_id);

create table public.assistance_invitations (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid not null references public.assistances(id) on delete cascade,
  email         citext not null,
  role          text not null check (role in ('admin','technician','attendant')),
  token_hash    bytea not null unique,           -- sha256 do token do link
  invited_by    uuid not null references public.profiles(id),
  expires_at    timestamptz not null default now() + interval '7 days',
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create unique index on public.assistance_invitations (assistance_id, email)
  where accepted_at is null and revoked_at is null;

create table public.assistance_counters (
  assistance_id uuid not null references public.assistances(id) on delete cascade,
  key           text not null,                   -- ex.: 'service_order:2026'
  last_value    bigint not null default 0,
  primary key (assistance_id, key)
);

create table public.audit_logs (
  id            bigint generated always as identity primary key,
  assistance_id uuid not null references public.assistances(id) on delete cascade,
  table_name    text not null,
  record_id     uuid,
  action        text not null,    -- INSERT/UPDATE/DELETE ou evento: BUDGET_SENT, BUDGET_APPROVED...
  actor_user_id uuid,
  actor_portal_session_id uuid,
  changes       jsonb,            -- só o que mudou: {"campo": [antes, depois]}
  created_at    timestamptz not null default now()
);
create index on public.audit_logs (assistance_id, table_name, record_id, created_at desc);
```

### 4.2 Clientes e equipamentos

```sql
create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  assistance_id   uuid not null default private.current_assistance_id()
                  references public.assistances(id) on delete cascade,
  name            text not null check (length(name) between 2 and 150),
  phone           text not null,                       -- como foi digitado
  phone_e164      text generated always as (private.normalize_br_phone(phone)) stored,
  phone_secondary text,
  email           citext,
  document        text check (document ~ '^([0-9]{11}|[0-9]{14})$'),  -- CPF/CNPJ só dígitos
  address         jsonb not null default '{}',
  notes           text,
  anonymized_at   timestamptz,                         -- LGPD
  created_by      uuid default auth.uid() references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (phone_e164 is not null),                      -- telefone inválido = erro
  unique (assistance_id, id),
  unique (assistance_id, phone_e164)                   -- decisão 5
);
create unique index on public.customers (assistance_id, document) where document is not null;
create index on public.customers using gin (assistance_id, name gin_trgm_ops);

create table public.equipment_categories (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid references public.assistances(id) on delete cascade,  -- null = padrão do sistema
  name          text not null,
  sort_order    int not null default 0,
  active        boolean not null default true,
  unique nulls not distinct (assistance_id, name)
);

create table public.equipment (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid not null default private.current_assistance_id(),
  customer_id   uuid not null,
  category_id   uuid not null references public.equipment_categories(id),
  brand         text,
  model         text,
  serial_number text,
  imei          text check (imei ~ '^[0-9]{15}$'),
  color         text,
  description   text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (assistance_id, id),
  unique (assistance_id, customer_id, id),              -- alvo da FK da OS
  foreign key (assistance_id, customer_id) references public.customers (assistance_id, id)
);
create index on public.equipment (assistance_id, customer_id);
create index on public.equipment (assistance_id, imei) where imei is not null;
create index on public.equipment (assistance_id, serial_number) where serial_number is not null;
-- trigger: category_id precisa ser padrão (assistance_id null) ou da mesma assistência
```

### 4.3 Ordem de serviço

```sql
create table public.service_orders (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null default private.current_assistance_id(),
  customer_id      uuid not null,
  equipment_id     uuid not null,
  year             int  not null,             -- preenchidos pelo trigger de numeração
  number           int  not null,
  code             text generated always as ('OS-' || year || '-' || lpad(number::text, 6, '0')) stored,
  status           text not null default 'RECEBIDO' check (status in (
                     'RECEBIDO','EM_DIAGNOSTICO','AGUARDANDO_APROVACAO','ORCAMENTO_RECUSADO',
                     'APROVADO','AGUARDANDO_PECA','EM_MANUTENCAO','PRONTO','ENTREGUE','CANCELADO')),
  outcome          text check (outcome in ('REPARADO','NAO_REPARADO_RECUSADO','NAO_REPARADO_INVIAVEL')),
  priority         text not null default 'NORMAL' check (priority in ('BAIXA','NORMAL','ALTA','URGENTE')),
  reported_issue   text not null,
  entry_condition  jsonb not null default '{}',   -- checklist: {"liga": false, "tela_trincada": true}
  entry_condition_notes text,
  accessories      text[] not null default '{}',
  diagnosis        text,                          -- vai para o orçamento
  solution         text,
  customer_notes   text,                          -- visível no portal
  internal_notes   text,                          -- nunca sai da equipe
  access_code      text not null default private.generate_access_code(),  -- 6 caracteres sem ambíguos
  technician_id    uuid,
  received_at      timestamptz not null default now(),
  estimated_completion_at timestamptz,
  completed_at     timestamptz,
  delivered_at     timestamptz,
  warranty_until   date,
  cancel_reason    text,
  parent_service_order_id uuid,                   -- retorno em garantia (futuro)
  created_by       uuid default auth.uid() references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (assistance_id, id),
  unique (assistance_id, year, number),
  foreign key (assistance_id, customer_id) references public.customers (assistance_id, id),
  foreign key (assistance_id, customer_id, equipment_id)
    references public.equipment (assistance_id, customer_id, id),          -- equipamento é DESTE cliente
  foreign key (assistance_id, technician_id)
    references public.assistance_members (assistance_id, user_id),         -- técnico é DESTA assistência
  foreign key (assistance_id, parent_service_order_id)
    references public.service_orders (assistance_id, id),
  check (status <> 'CANCELADO' or cancel_reason is not null),
  check (status <> 'ENTREGUE' or (delivered_at is not null and outcome is not null))
);
create index on public.service_orders (assistance_id, status);
create index on public.service_orders (assistance_id, received_at desc);
create index on public.service_orders (assistance_id, customer_id);

create table public.service_order_status_history (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null,
  service_order_id uuid not null,
  from_status      text,
  to_status        text not null,
  note             text,
  visible_to_customer boolean not null default true,
  changed_by       uuid references public.profiles(id),   -- null quando veio do portal/sistema
  changed_via      text not null check (changed_via in ('STAFF','PORTAL','SYSTEM')),
  created_at       timestamptz not null default now(),
  foreign key (assistance_id, service_order_id)
    references public.service_orders (assistance_id, id) on delete cascade
);
create index on public.service_order_status_history (assistance_id, service_order_id, created_at);

create table public.service_order_photos (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null default private.current_assistance_id(),
  service_order_id uuid not null,
  storage_path     text not null unique,     -- {assistance_id}/{service_order_id}/{uuid}.webp
  stage            text not null default 'ENTRADA' check (stage in ('ENTRADA','DIAGNOSTICO','SAIDA')),
  kind             text not null default 'OUTRO' check (kind in ('FRENTE','TRASEIRA','LATERAL','TELA',
                     'CONECTOR','ETIQUETA','NUMERO_SERIE','DANO','ACESSORIO','OUTRO')),
  description      text,
  visible_to_customer boolean not null default true,
  mime_type        text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes       int  not null check (size_bytes between 1 and 10485760),   -- até 10 MB
  uploaded_by      uuid default auth.uid() references public.profiles(id),
  created_at       timestamptz not null default now(),
  foreign key (assistance_id, service_order_id) references public.service_orders (assistance_id, id),
  check (storage_path like assistance_id::text || '/' || service_order_id::text || '/%')
);

create table public.service_order_secrets (      -- opcional (problema 4)
  service_order_id uuid primary key,
  assistance_id    uuid not null default private.current_assistance_id(),
  unlock_code      text not null,               -- senha/PIN/padrão informado pelo cliente
  created_by       uuid default auth.uid() references public.profiles(id),
  created_at       timestamptz not null default now(),
  foreign key (assistance_id, service_order_id)
    references public.service_orders (assistance_id, id) on delete cascade
);
-- trigger: ao ir para ENTREGUE ou CANCELADO, apaga a linha correspondente
```

### 4.4 Orçamento

Cada linha de `budget_versions` é uma versão. Valores calculados (`subtotal`, `items_subtotal`, `total`) nunca vêm do frontend: o item usa coluna gerada e a versão é recalculada por trigger.

```sql
create table public.budget_versions (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null default private.current_assistance_id(),
  service_order_id uuid not null,
  version          int  not null,               -- 1, 2, 3... definido pela função que cria a versão
  status           text not null default 'RASCUNHO' check (status in
                     ('RASCUNHO','ENVIADO','APROVADO','RECUSADO','SUBSTITUIDO','CANCELADO')),
  items_subtotal   numeric(12,2) not null default 0,                      -- trigger
  discount_amount  numeric(12,2) not null default 0 check (discount_amount >= 0),
  surcharge_amount numeric(12,2) not null default 0 check (surcharge_amount >= 0),
  total            numeric(12,2) not null default 0 check (total >= 0),  -- trigger
  estimated_days   int check (estimated_days > 0),
  warranty_days    int check (warranty_days >= 0),
  payment_terms    text,
  valid_until      date,
  customer_notes   text,
  technical_notes  text,
  internal_notes   text,                        -- nunca vai ao snapshot
  snapshot         jsonb,                       -- documento congelado no envio
  content_hash     text,                        -- sha256 do snapshot
  sent_at          timestamptz,
  sent_by          uuid references public.profiles(id),
  decided_at       timestamptz,
  decision_channel text check (decision_channel in ('PORTAL','BALCAO','TELEFONE','WHATSAPP')),
  decided_by_user  uuid references public.profiles(id),   -- equipe registrou a decisão
  decided_by_session uuid,                                -- FK para portal_sessions (Fase 5)
  decision_ip      inet,
  decision_user_agent text,
  refusal_reason   text,
  created_by       uuid default auth.uid() references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (assistance_id, id),
  unique (service_order_id, version),
  foreign key (assistance_id, service_order_id) references public.service_orders (assistance_id, id),
  check (status <> 'RECUSADO' or length(refusal_reason) >= 3),
  check (status = 'RASCUNHO' or (snapshot is not null and content_hash is not null and sent_at is not null
         and valid_until is not null and estimated_days is not null))
);
-- no máximo UMA versão aberta (rascunho ou aguardando cliente) por OS
create unique index on public.budget_versions (service_order_id) where status in ('RASCUNHO','ENVIADO');

create table public.budget_items (
  id                uuid primary key default gen_random_uuid(),
  assistance_id     uuid not null default private.current_assistance_id(),
  budget_version_id uuid not null,
  position          int  not null default 0,
  kind              text not null check (kind in ('SERVICO','PECA')),
  description       text not null check (length(description) between 1 and 300),
  quantity          numeric(10,3) not null check (quantity > 0),
  unit_price        numeric(12,2) not null check (unit_price >= 0),
  discount_amount   numeric(12,2) not null default 0 check (discount_amount >= 0),
  subtotal          numeric(12,2) generated always as
                      (round(quantity * unit_price, 2) - discount_amount) stored,
  created_at        timestamptz not null default now(),
  foreign key (assistance_id, budget_version_id)
    references public.budget_versions (assistance_id, id) on delete cascade,
  check (discount_amount <= round(quantity * unit_price, 2))
);
-- triggers: (1) bloqueia insert/update/delete de itens se a versão não for RASCUNHO;
-- (2) recalcula items_subtotal e total = items_subtotal - discount_amount + surcharge_amount;
-- (3) bloqueia update de qualquer coluna de conteúdo da versão fora de RASCUNHO.
```

### 4.5 Portal do cliente

```sql
create table public.portal_sessions (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid not null,
  customer_id   uuid not null,
  token_hash    bytea not null unique,          -- sha256 do token guardado no cookie
  login_method  text not null check (login_method in ('ACCESS_CODE','OTP')),
  ip            inet,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '30 days',
  revoked_at    timestamptz,
  foreign key (assistance_id, customer_id) references public.customers (assistance_id, id) on delete cascade
);

create table public.portal_login_attempts (
  id            bigint generated always as identity primary key,
  assistance_id uuid not null references public.assistances(id) on delete cascade,
  phone_e164    text,
  ip            inet,
  success       boolean not null,
  created_at    timestamptz not null default now()
);
create index on public.portal_login_attempts (assistance_id, phone_e164, created_at desc);
create index on public.portal_login_attempts (ip, created_at desc);

alter table public.budget_versions
  add foreign key (decided_by_session) references public.portal_sessions(id);
```

### 4.6 Financeiro

```sql
create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid not null default private.current_assistance_id()
                references public.assistances(id) on delete cascade,
  name          text not null,
  phone         text,
  document      text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (assistance_id, id),
  unique (assistance_id, name)
);

create table public.cash_transactions (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null default private.current_assistance_id(),
  direction        text not null check (direction in ('IN','OUT')),
  category         text not null check (category in (
                     'RECEBIMENTO_OS','TAXA_DIAGNOSTICO','OUTRO_RECEBIMENTO',
                     'COMPRA_PECA','FORNECEDOR','DESPESA_OPERACIONAL','ESTORNO','OUTRA_SAIDA')),
  amount           numeric(12,2) not null check (amount > 0),
  occurred_at      timestamptz not null default now(),
  payment_method   text not null check (payment_method in
                     ('DINHEIRO','PIX','CARTAO_CREDITO','CARTAO_DEBITO','TRANSFERENCIA','BOLETO','OUTRO')),
  description      text not null,
  quantity         numeric(10,3),               -- compra de peça
  service_order_id uuid,
  supplier_id      uuid,
  created_by       uuid not null default auth.uid() references public.profiles(id),
  created_at       timestamptz not null default now(),
  voided_at        timestamptz,                 -- estorno lógico: nada é apagado
  voided_by        uuid references public.profiles(id),
  void_reason      text,
  foreign key (assistance_id, service_order_id) references public.service_orders (assistance_id, id),
  foreign key (assistance_id, supplier_id) references public.suppliers (assistance_id, id),
  check ((direction = 'IN') = (category in ('RECEBIMENTO_OS','TAXA_DIAGNOSTICO','OUTRO_RECEBIMENTO'))),
  check (category not in ('RECEBIMENTO_OS','TAXA_DIAGNOSTICO','ESTORNO') or service_order_id is not null),
  check ((voided_at is null) = (void_reason is null))
);
create index on public.cash_transactions (assistance_id, occurred_at desc);
create index on public.cash_transactions (assistance_id, service_order_id);
```

## 5. Relacionamentos e integridade entre tenants

O isolamento não depende só do RLS: as FKs compostas fazem o próprio Postgres recusar qualquer ligação entre assistências, mesmo vinda de um script com chave secreta.

&#91;embedded content: relacionamentos principais · 12 tabelas dentro do tenant\]

A OS aponta para `equipment (assistance_id, customer_id, id)`: se o equipamento não for daquele cliente, naquela assistência, o insert falha. Ficam fora do desenho, mas seguem a mesma regra: `assistance_invitations`, `assistance_counters`, `audit_logs`, `equipment_categories`, `service_order_secrets` e `portal_login_attempts`.

| Regra (item 27 dos requisitos) | Como o banco garante |
| --- | --- |
| OS sem assistência | `assistance_id not null` + default + trigger que sobrescreve o valor enviado |
| Cliente de outra assistência | FK `(assistance_id, customer_id)` → `customers (assistance_id, id)` |
| Equipamento de outro cliente | FK `(assistance_id, customer_id, equipment_id)` → `equipment (assistance_id, customer_id, id)` |
| Técnico de outra assistência | FK `(assistance_id, technician_id)` → `assistance_members` |
| Orçamento de outra OS | FK `(assistance_id, service_order_id)` → `service_orders` |
| Item de outro orçamento | FK `(assistance_id, budget_version_id)` → `budget_versions` |
| Movimentação de outra assistência | FKs compostas para OS e fornecedor + RLS |
| Foto na pasta de outra assistência | `check` exige `storage_path` iniciando em `{assistance_id}/{service_order_id}/` + policy do Storage |
| Acesso cruzado em geral | RLS em todas as tabelas + testes pgTAP a cada migration |

## 6. Estratégia de RLS e Storage

Toda tabela tem RLS ligado e nenhuma policy para `anon`. A equipe enxerga apenas a assistência ativa; o cliente nunca toca nas tabelas, só em funções do portal que validam a sessão.

### 6.1 Funções auxiliares

Ficam no schema `private`, que não é exposto pela API REST do Supabase.

```sql
-- Assistência ativa do usuário logado, somente se o vínculo estiver ativo
create function private.current_assistance_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.assistance_id
  from public.profiles p
  join public.assistance_members m
    on m.assistance_id = p.active_assistance_id and m.user_id = p.id and m.active
  where p.id = (select auth.uid())
$$;

create function private.has_role(roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assistance_members m
    where m.user_id = (select auth.uid())
      and m.assistance_id = private.current_assistance_id()
      and m.active and m.role = any (roles))
$$;

-- Trigger em toda tabela de tenant: ignora o assistance_id enviado e impede troca de tenant
create function private.enforce_tenant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then                 -- usuário da equipe
      new.assistance_id := private.current_assistance_id();
      if new.assistance_id is null then
        raise exception 'Nenhuma assistência ativa' using errcode = '42501';
      end if;
    end if;                                        -- funções do portal já definem pela sessão
  elsif new.assistance_id is distinct from old.assistance_id then
    raise exception 'assistance_id não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end $$;
```

Três escolhas por trás disso:

- **Consulta ao vínculo, não claim no JWT.** Remover um técnico corta o acesso na hora; com claim no token, ele continuaria entrando até o token expirar.
- **Uma assistência ativa por vez.** Quem pertence a duas assistências troca pela função `switch_assistance()`, que confere o vínculo. Nunca vê as duas juntas.
- **`(select ...)` em volta das funções** nas policies: o Postgres avalia uma vez por consulta, e não uma vez por linha. Com índice em `assistance_id`, isso escala para milhares de assistências.

### 6.2 Modelo de policy (repetido em cada tabela)

```sql
alter table public.customers enable row level security;

create policy customers_select on public.customers for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));

create policy customers_insert on public.customers for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id()));

create policy customers_update on public.customers for update to authenticated
  using      (assistance_id = (select private.current_assistance_id()))
  with check (assistance_id = (select private.current_assistance_id()));

create policy customers_delete on public.customers for delete to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin'])));

revoke all on all tables in schema public from anon;   -- defesa extra
```

Colunas sensíveis são protegidas também por privilégio de coluna. Exemplo: `revoke update on service_orders from authenticated` seguido de `grant update (priority, reported_issue, diagnosis, ...)`, sem `status`, `number`, `year` ou `access_code`. Assim o status só muda pela função que valida a transição.

### 6.3 Permissões por papel

Papéis: **owner** (proprietário), **admin** (gerente), **técnico**, **atendente**. "Todos" = qualquer membro ativo da assistência ativa.

| Tabela | Ler | Criar | Alterar | Excluir |
| --- | --- | --- | --- | --- |
| `assistances` | Todos | Só via `create_assistance()` | owner, admin | Ninguém (suporte) |
| `profiles` | Próprio + colegas | Trigger do Auth | Próprio; assistência ativa só via `switch_assistance()` | Ninguém |
| `assistance_members` | Todos | Via `accept_invitation()` | owner, admin (nunca o último owner) | Ninguém: desativa |
| `assistance_invitations` | owner, admin | owner, admin | owner, admin (revogar) | Ninguém |
| `assistance_counters` | Ninguém | Só funções | Só funções | Ninguém |
| `audit_logs` | owner, admin | Só triggers | Ninguém | Ninguém |
| `customers` | Todos | Todos | Todos | owner, admin (só sem OS; senão anonimiza) |
| `equipment_categories` | Padrão + próprias | owner, admin | owner, admin | Ninguém: desativa |
| `equipment` | Todos | Todos | Todos | owner, admin (só sem OS) |
| `service_orders` | Todos | Via `create_service_order()` | Todos (colunas liberadas); status via função | Ninguém: cancela |
| `service_order_status_history` | Todos | Só trigger | Ninguém | Ninguém |
| `service_order_photos` | Todos | Todos | Descrição e visibilidade | owner, admin |
| `service_order_secrets` | owner, admin, técnico | Todos | owner, admin, técnico | Trigger na entrega |
| `budget_versions` | Todos | owner, admin, técnico (via função) | Mesmos, só em RASCUNHO; envio e decisão via função | Ninguém |
| `budget_items` | Todos | owner, admin, técnico (versão em RASCUNHO) | Idem | Idem |
| `portal_sessions` | Ninguém | Funções do portal | Revogar via função | Ninguém |
| `portal_login_attempts` | Ninguém | Funções do portal | Ninguém | Job de limpeza |
| `suppliers` | Todos | owner, admin, técnico | owner, admin, técnico | Ninguém |
| `cash_transactions` | owner, admin: tudo; demais: só o que criaram | owner, admin: tudo; atendente: recebimentos; técnico: compra de peça | Só anulação via função (owner, admin) | Ninguém |

### 6.4 Funções de negócio (RPC)

Regra: `security invoker` por padrão, para o RLS valer dentro da função. `security definer` só quando a função precisa fazer algo que o usuário não pode fazer direto, e nesse caso sempre com `set search_path = ''`, filtro explícito por `current_assistance_id()`, checagem de papel e `revoke execute ... from public`.

| Função | Tipo | O que faz em uma transação |
| --- | --- | --- |
| `create_assistance(name, slug)` | definer | Valida slug (formato + lista de reservados), cria assistência, vínculo owner e ativa |
| `switch_assistance(id)` | definer | Troca a assistência ativa se houver vínculo ativo |
| `accept_invitation(token)` | definer | Confere hash, validade e e-mail do usuário logado; cria o vínculo |
| `create_service_order(...)` | definer | Cria cliente e equipamento se novos, reserva o número no contador, cria OS e histórico inicial |
| `change_service_order_status(id, novo, nota)` | definer | Valida a transição (seção 9), papel e pré-condições; grava histórico e auditoria |
| `create_budget_version(os_id)` | invoker | Cria versão N+1 copiando os itens da anterior; marca a anterior ENVIADO como SUBSTITUIDO |
| `send_budget_version(id)` | definer | Monta o snapshot, calcula o hash, define validade, muda OS para AGUARDANDO\_APROVACAO |
| `staff_decide_budget(id, decisão, canal, motivo)` | definer | Registra aprovação/recusa feita no balcão ou por telefone |
| `void_cash_transaction(id, motivo)` | definer | Anula um lançamento (owner, admin) |
| `portal_*` | definer | Ver 6.5 |

### 6.5 Portal do cliente

O cliente não é um usuário do Supabase Auth. O acesso dele é uma sessão própria, guardada em `portal_sessions`, e toda leitura passa por funções que:

1. Recebem o token (vindo do cookie httpOnly, lido no servidor Next.js) e comparam o sha256 com `token_hash`.
2. Recusam sessão expirada ou revogada.
3. Tiram `assistance_id` e `customer_id` **da sessão**, nunca de parâmetro.
4. Devolvem só colunas públicas: nada de `internal_notes`, custos, fornecedor ou `access_code`.

```sql
create function public.portal_list_orders(p_token text)
returns table (code text, status text, category text, brand text, model text,
               received_at timestamptz, estimated_completion_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare s public.portal_sessions;
begin
  s := private.portal_session(p_token);   -- valida hash, expiração e revogação; erro se inválida
  return query
    select so.code, so.status, c.name, e.brand, e.model, so.received_at, so.estimated_completion_at
    from public.service_orders so
    join public.equipment e            on e.id = so.equipment_id
    join public.equipment_categories c on c.id = e.category_id
    where so.assistance_id = s.assistance_id     -- tenant vem da sessão
      and so.customer_id   = s.customer_id       -- cliente vem da sessão
    order by so.received_at desc;
end $$;
revoke execute on function public.portal_list_orders(text) from public;
grant execute on function public.portal_list_orders(text) to anon;
```

A proteção contra troca de ID na URL vem daí: `portal_get_order(token, 'OS-2026-000124')` de outro cliente devolve vazio, e a tela mostra "OS não encontrada", a mesma resposta de uma OS inexistente.

### 6.6 Storage

| Bucket | Acesso | Caminho | Limites | Quem grava |
| --- | --- | --- | --- | --- |
| `service-order-photos` | Privado, URL assinada de 10 min | `{assistance_id}/{service_order_id}/{uuid}.webp` | 10 MB; JPEG, PNG, WebP | Equipe da assistência |
| `logos` | Leitura pública | `{assistance_id}/logo.{ext}` | 2 MB; PNG, JPEG, WebP (sem SVG, que pode carregar script) | owner, admin |
| `documents` | Privado (futuro: PDF de OS e orçamento) | `{assistance_id}/...` | A definir | Funções do servidor |

```sql
create policy os_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'service-order-photos'
         and (storage.foldername(name))[1] = (select private.current_assistance_id())::text);

create policy os_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'service-order-photos'
              and (storage.foldername(name))[1] = (select private.current_assistance_id())::text);

create policy os_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'service-order-photos'
         and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
         and (select private.has_role(array['owner','admin'])));
```

No portal, o servidor assina as URLs com a chave secreta apenas para os caminhos que `portal_get_order` devolveu para aquela sessão, e só se a assistência liberou fotos ao cliente.

### 6.7 Chaves e segredos

- **Navegador:** só `NEXT_PUBLIC_SUPABASE_URL` e a chave *publishable* (equivalente à antiga `anon`).
- **Servidor:** `SUPABASE_SECRET_KEY` (equivalente à antiga `service_role`) apenas em `lib/supabase/admin.js`, com `import 'server-only'`, usada para assinar URLs do portal e enviar convites. Nunca com prefixo `NEXT_PUBLIC_`.
- `.env.local` fora do Git; `.env.example` versionado sem valores; segredos de produção nas variáveis de ambiente da Vercel.

## 7. Arquitetura da aplicação

Next.js na Vercel faz a ponte e o Supabase guarda e protege os dados: o servidor Next.js nunca é a única barreira de segurança.

&#91;embedded content: arquitetura · navegador, Next.js na Vercel e Supabase\]

O painel lê e grava com a sessão do próprio usuário, então o RLS vale em toda consulta. O portal não tem usuário no Supabase: as rotas do servidor leem o cookie e só conseguem chamar as funções `portal_*`. A chave secreta existe em um único arquivo e só assina URLs de fotos já autorizadas.

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Front-end | Next.js (App Router), React, JavaScript | Server Components mantêm consultas e tokens fora do navegador |
| Interface | Tailwind CSS + shadcn/ui (modo JavaScript) | Visual moderno, componentes acessíveis, sem dependência pesada |
| Validação | Zod | Mesmas regras no formulário e na Server Action |
| Banco | Supabase Postgres + RLS + funções SQL | Isolamento e regras críticas no banco |
| Login da equipe | Supabase Auth (e-mail e senha) | Pronto, com recuperação de senha |
| Arquivos | Supabase Storage, buckets privados | Policies por pasta de assistência |
| Rotinas | pg\_cron | Limpar tentativas de login e sessões expiradas |
| Hospedagem | Vercel, com preview por branch | Cada fase é validada numa URL própria |
| Testes | pgTAP (banco), Vitest (JS), Playwright (e2e) | O isolamento é testado no banco, onde ele vive |

Regras de implementação:

- **Leitura** em Server Components, com o cliente Supabase do usuário.
- **Escrita** em Server Actions: valida com Zod → chama a função SQL ou o insert → traduz o erro → `revalidatePath`.
- **Upload de fotos** vai direto do navegador para o Storage, protegido pela policy da pasta; a action só grava o metadado. Assim arquivos grandes não passam pelas funções da Vercel.
- **CSRF:** Server Actions conferem a origem; o cookie do portal é `SameSite=Lax`, `Secure`, `httpOnly`; decisões só por POST.
- **XSS:** o React escapa texto por padrão; `dangerouslySetInnerHTML` é proibido com dado de usuário; termos e mensagens da assistência são exibidos como texto puro.
- **Erros:** `lib/errors.js` traduz `23505` (duplicado), `23503` (referência inválida), `42501` (sem permissão) e `P0001` (regra de negócio com mensagem própria). O log técnico guarda o erro original com um ID de requisição.

## 8. Estrutura de pastas

O código se organiza por domínio (`features/`), não por tipo de arquivo; as rotas em `app/` só compõem telas e chamam o domínio.

```text
conserta-ja/
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                      # uma por assunto (nome real com timestamp do CLI)
│  │  ├─ 0001_base.sql                  # extensões, schema private, helpers, triggers genéricos
│  │  ├─ 0002_tenancy.sql               # assistances, profiles, members, invitations, counters, audit
│  │  ├─ 0003_customers_equipment.sql
│  │  ├─ 0004_service_orders.sql
│  │  ├─ 0005_storage.sql               # buckets e policies
│  │  ├─ 0006_budgets.sql
│  │  ├─ 0007_portal.sql
│  │  └─ 0008_finance.sql
│  ├─ seed.sql                          # 2 assistências fictícias, para testar isolamento
│  └─ tests/                            # pgTAP (supabase test db)
│     ├─ 01_tenant_isolation.test.sql
│     ├─ 02_service_orders.test.sql
│     ├─ 03_budgets.test.sql
│     ├─ 04_portal.test.sql
│     └─ 05_finance.test.sql
├─ src/
│  ├─ app/                              # rotas do App Router
│  │  ├─ (site)/page.js                 # landing
│  │  ├─ (auth)/entrar, cadastro, recuperar-senha
│  │  ├─ auth/callback/route.js
│  │  ├─ onboarding/page.js
│  │  ├─ convite/[token]/page.js
│  │  ├─ painel/                        # área da assistência (layout protegido)
│  │  └─ a/[slug]/                      # portal do cliente
│  ├─ features/                         # regra de negócio por domínio
│  │  ├─ tenancy/                       # assistência, membros, convites
│  │  │  ├─ queries.js                  # leituras (server-only)
│  │  │  ├─ actions.js                  # Server Actions: valida, chama RPC, traduz erro
│  │  │  ├─ schemas.js                  # validação Zod
│  │  │  └─ components/
│  │  ├─ customers/
│  │  ├─ equipment/
│  │  ├─ service-orders/
│  │  ├─ budgets/
│  │  ├─ portal/
│  │  ├─ finance/
│  │  └─ dashboard/
│  ├─ components/
│  │  ├─ ui/                            # shadcn/ui em JavaScript
│  │  └─ layout/                        # AppShell, Sidebar, PortalShell
│  ├─ lib/
│  │  ├─ supabase/
│  │  │  ├─ server.js                   # cliente com a sessão do usuário (RLS vale)
│  │  │  ├─ browser.js                  # cliente do navegador (upload de fotos)
│  │  │  └─ admin.js                    # chave secreta, import 'server-only'
│  │  ├─ portal-session.js              # cookie httpOnly do portal
│  │  ├─ errors.js                      # código Postgres → mensagem amigável
│  │  ├─ logger.js
│  │  └─ money.js, phone.js, document.js, dates.js
│  └─ proxy.js                          # renova sessão e protege /painel (middleware.js no Next < 16)
├─ tests/                               # Vitest (unitários); Playwright (e2e) a partir da Fase 5
├─ .env.example
├─ jsconfig.json                        # alias @/
└─ README.md
```

- **Telas não falam com o banco direto.** Uma página chama `features/*/queries.js` para ler e um formulário chama `features/*/actions.js` para gravar.
- **Regra de negócio crítica fica no banco** (cálculo, numeração, transição de status, imutabilidade). O JavaScript valida formato para dar resposta rápida, mas não é a última palavra.
- **JSDoc** só nas funções de `lib/` e nas actions, para o editor sugerir tipos sem precisar de TypeScript.

## 9. Fluxo da OS

A OS passa por 10 status e só muda de um para outro pela função `change_service_order_status`, que recusa qualquer transição fora da tabela abaixo.

&#91;embedded content: máquina de estados da OS · 10 status\]

Os três status ligados ao orçamento (aguardando aprovação, aprovado, recusado) mudam sozinhos quando o orçamento é enviado ou decidido. Cada mudança grava uma linha em `service_order_status_history` com quem, quando, de onde (equipe, portal ou sistema) e a nota.

| De | Para | Quem | Condição e efeito |
| --- | --- | --- | --- |
| RECEBIDO | EM\_DIAGNOSTICO | Técnico | — |
| EM\_DIAGNOSTICO | AGUARDANDO\_APROVACAO | Automático | Ao enviar a versão do orçamento |
| EM\_DIAGNOSTICO | PRONTO | Técnico | Diagnóstico preenchido; `outcome = NAO_REPARADO_INVIAVEL` |
| AGUARDANDO\_APROVACAO | APROVADO | Automático | Aprovação pelo portal ou registrada no balcão |
| AGUARDANDO\_APROVACAO | ORCAMENTO\_RECUSADO | Automático | Recusa com motivo |
| ORCAMENTO\_RECUSADO | AGUARDANDO\_APROVACAO | Automático | Ao enviar nova versão |
| ORCAMENTO\_RECUSADO | PRONTO | Técnico, atendente | `outcome = NAO_REPARADO_RECUSADO`; taxa de diagnóstico, se houver |
| ORCAMENTO\_RECUSADO | EM\_MANUTENCAO | Técnico | Só se existir versão anterior aprovada (complemento recusado) |
| APROVADO | EM\_MANUTENCAO ou AGUARDANDO\_PECA | Técnico | — |
| EM\_MANUTENCAO | AGUARDANDO\_PECA (e volta) | Técnico | — |
| EM\_MANUTENCAO | AGUARDANDO\_APROVACAO | Automático | Ao enviar versão complementar |
| EM\_MANUTENCAO | PRONTO | Técnico | Solução preenchida; `outcome = REPARADO`; grava `completed_at` |
| PRONTO | EM\_MANUTENCAO | Técnico | Reabrir antes da retirada; nota obrigatória |
| PRONTO | ENTREGUE | Atendente ou superior | Grava `delivered_at` e `warranty_until`; alerta de saldo devedor; apaga a senha de desbloqueio |
| Qualquer, exceto ENTREGUE | CANCELADO | owner, admin | Motivo obrigatório; versão de orçamento aberta vira CANCELADO |

## 10. Fluxo do orçamento

Um orçamento é uma sequência de versões; só o rascunho é editável, e o valor que vale para a OS é o da versão aprovada mais recente.

&#91;embedded content: ciclo de vida de uma versão do orçamento · 6 status\]

Passo a passo:

1. O técnico registra o diagnóstico e cria a versão 1 em RASCUNHO. A cada item salvo, o banco recalcula subtotal e total.
2. **Enviar** (`send_budget_version`): exige ao menos 1 item, prazo e validade (padrão: 10 dias). Congela o snapshot (cabeçalho da assistência, cliente, equipamento, problema, diagnóstico, itens, totais e condições) e grava o sha256. A OS vai para AGUARDANDO\_APROVACAO e a tela oferece o link pronto para o WhatsApp.
3. **Cliente decide** no portal (`portal_decide_budget`). A função confere que a versão é da sessão, está ENVIADO, dentro da validade e que o hash é o mesmo que a tela exibiu. Se a assistência criou outra versão nesse meio-tempo, a decisão é recusada com "Este orçamento foi atualizado".
4. **Aprovação** grava data, canal, IP, navegador, sessão, versão e hash. **Recusa** grava o mesmo mais o motivo obrigatório.
5. **Balcão ou telefone:** a equipe registra a decisão com `staff_decide_budget`, informando o canal; fica gravado quem registrou.
6. **Mudar algo** = `create_budget_version`: cria a versão N+1 copiando os itens. Se a anterior estava ENVIADO, vira SUBSTITUIDO; se estava APROVADO ou RECUSADO, fica como está.
7. **Validade vencida** não é um status gravado: é calculada na leitura. O portal mostra "Orçamento vencido, fale com a assistência" e a equipe reenvia como nova versão.

Cálculo feito no banco, sempre em `numeric`:

```latex
\text{subtotal}_i = \operatorname{round}(q_i \times p_i,\ 2) - d_i \qquad \text{total} = \sum_i \text{subtotal}_i - \text{desconto} + \text{acréscimo}
```

O exemplo dos requisitos, como fica gravado na OS-2026-000123:

| Versão | Total | Status final | O que aconteceu |
| --- | --- | --- | --- |
| 2 | R$ 650,00 | APROVADO | Nova proposta enviada; cliente aprovou pelo portal. É o valor vigente da OS. |
| 1 | R$ 500,00 | RECUSADO | Cliente recusou com motivo. Continua consultável, sem nenhuma alteração. |

## 11. Fluxo financeiro

O caixa só recebe dois tipos de fato: dinheiro que entrou e dinheiro que saiu. "Previsto" e "a receber" são consultas sobre os orçamentos, então nunca duplicam quando o pagamento chega.

&#91;embedded content: fluxo financeiro · 4 eventos, 5 indicadores\]

O exemplo dos requisitos, passo a passo: orçamento de R$ 800 enviado → previsto R$ 800. Aprovado → a receber R$ 800. PIX de R$ 800 registrado em 08/10/2026 → entrada de R$ 800 e a receber cai para R$ 0. Compra do display por R$ 350 ligada à OS → saída de R$ 350 e lucro estimado da OS de R$ 450.

| Indicador | Regra | Fonte |
| --- | --- | --- |
| Previsto | Soma do total das versões ENVIADO, dentro da validade, de OS não canceladas | `budget_versions` |
| A receber | Por OS: total da versão aprovada mais recente − entradas da OS; só valores acima de zero; OS não cancelada | `budget_versions` + `cash_transactions` |
| Entradas | Soma dos IN não anulados com `occurred_at` no período | `cash_transactions` |
| Saídas | Soma dos OUT não anulados no período | `cash_transactions` |
| Saldo | Entradas − saídas | — |
| Faturamento | Entradas das categorias RECEBIMENTO\_OS e TAXA\_DIAGNOSTICO no período | `cash_transactions` |
| Lucro estimado da OS | Entradas da OS − saídas da OS | `cash_transactions` |
| Ticket médio | Total aprovado das OS entregues no período ÷ nº dessas OS | `budget_versions` + `service_orders` |

Regras do caixa:

- **Pagamento parcial e sinal** são vários lançamentos IN na mesma OS; o "a receber" se ajusta sozinho.
- **Pagamento acima do aprovado** gera alerta na tela, não bloqueio.
- **Erro de lançamento** se corrige anulando (motivo obrigatório) e lançando de novo; nada é apagado ou editado.
- **Devolução ao cliente** é um OUT na categoria ESTORNO, ligado à OS.
- **Views com `security_invoker = true`**: sem essa opção, uma view no Postgres ignora o RLS de quem consulta. Os totais por OS ficam em `v_service_order_financials` e o dashboard em `dashboard_summary(de, ate)`.

## 12. Fluxo de acesso do cliente

No MVP o cliente entra com telefone + código de acesso de 6 caracteres impresso no comprovante (ou já embutido no link do QR e do WhatsApp); a sessão vale 30 dias e só abre as OS dele naquela assistência.

&#91;embedded content: acesso do cliente · entrar, navegar, decidir\]

Regras de segurança do portal:

- **Erro genérico:** "Telefone ou código não conferem". A tela nunca revela se o telefone existe.
- **Limites:** 5 tentativas erradas por telefone em 15 minutos e 20 por IP por hora; depois disso, bloqueio de 15 minutos. Se houver abuso, entra um captcha (Cloudflare Turnstile).
- **Código de acesso:** 6 caracteres de um alfabeto de 31 símbolos sem ambíguos (sem 0, O, 1, I, L): 887 milhões de combinações. Vale enquanto a OS estiver aberta e até 90 dias após a entrega.
- **Sessão:** token aleatório de 32 bytes; o banco guarda só o hash. Cookie `httpOnly`, `Secure`, `SameSite=Lax`, com `path=/a/[slug]`: uma sessão por assistência. Sair revoga a sessão; trocar o telefone do cliente revoga todas as dele.
- **Escopo:** a sessão enxerga todas as OS daquele cliente naquela assistência, e nada de outra assistência, mesmo que o telefone seja o mesmo.
- **Evolução para OTP:** a tela troca "código da OS" por "código enviado por WhatsApp/SMS". Entra uma tabela de desafios OTP e a função `portal_request_otp`; a sessão e todas as funções de leitura continuam iguais.

## 13. Rotas

São 29 rotas em três áreas. No portal a URL usa o código da OS (`OS-2026-000123`); no painel, o `id`. Em ambos o acesso é decidido pelo banco, não pela URL.

| Rota | Tela | Quem acessa | Fase |
| --- | --- | --- | --- |
| `/` | Landing page | Público | 1 |
| `/entrar` | Login da equipe | Público | 1 |
| `/cadastro` | Criar conta | Público | 1 |
| `/recuperar-senha` | Recuperar senha | Público | 1 |
| `/auth/callback` | Retorno do Supabase Auth (route handler) | Público | 1 |
| `/onboarding` | Criar minha assistência | Logado sem assistência | 1 |
| `/convite/[token]` | Aceitar convite | Logado | 1 |
| `/painel` | Dashboard (bloco financeiro só owner/admin) | Equipe | 1 (vazio), 7 |
| `/painel/usuarios` | Equipe, papéis e convites | owner, admin | 1 |
| `/painel/configuracoes` | Abas: assistência, contato, portal, padrões de orçamento, categorias | owner, admin | 1 |
| `/painel/minha-conta` | Perfil do usuário | Equipe | 1 |
| `/painel/clientes` | Lista e busca | Equipe | 2 |
| `/painel/clientes/[id]` | Cliente, equipamentos e OS | Equipe | 2 |
| `/painel/equipamentos` | Lista e busca (IMEI, série) | Equipe | 2 |
| `/painel/equipamentos/[id]` | Equipamento e histórico de OS | Equipe | 2 |
| `/painel/os` | Lista com filtros por status, técnico e período | Equipe | 3 |
| `/painel/os/nova` | Abertura em 5 passos | Equipe | 3 |
| `/painel/os/[id]` | Detalhe: dados, fotos, status, histórico | Equipe | 3 |
| `/painel/os/[id]/comprovante` | Comprovante imprimível com QR e código | Equipe | 3 |
| `/painel/os/[id]/orcamento` | Editor e versões do orçamento | owner, admin, técnico | 4 |
| `/painel/orcamentos` | Orçamentos por status | Equipe | 4 |
| `/a/[slug]` | Identificação: telefone + código (o QR já traz `?c=`) | Público | 5 |
| `/a/[slug]/os` | Meus equipamentos e OS | Sessão do portal | 5 |
| `/a/[slug]/os/[code]` | Status, linha do tempo e fotos | Sessão do portal | 5 |
| `/a/[slug]/os/[code]/orcamento` | Proposta com aprovar e recusar | Sessão do portal | 5 |
| `/a/[slug]/sair` | Encerra a sessão (route handler) | Sessão do portal | 5 |
| `/painel/caixa` | Movimentações e resumo | owner, admin (demais: próprios lançamentos) | 6 |
| `/painel/fornecedores` | Fornecedores | owner, admin, técnico | 6 |
| `/painel/relatorios` | Relatórios | owner, admin | 7 |

"Configurações" e "Minha assistência" viraram uma tela só, com abas; "Minha conta" é do usuário, não da assistência. O `proxy.js` só redireciona quem não está logado; a autorização de verdade continua no banco.

## 14. Componentes principais

O componente mais importante é o `BudgetDocument`: um único renderizador da proposta usado na prévia do técnico, no portal e na impressão, sempre a partir do snapshot.

| Componente | Domínio | Responsabilidade |
| --- | --- | --- |
| `AppShell`, `Sidebar`, `TenantSwitcher` | Layout | Estrutura do painel; menu filtrado pelo papel; troca de assistência |
| `PortalShell` | Layout | Cabeçalho com logo, cores e contato da assistência; mobile primeiro |
| `StatusBadge` | Compartilhado | Cor e rótulo em português para status de OS e de orçamento |
| `MoneyInput`, `MoneyText` | Compartilhado | Digitação em centavos e exibição em R$ pt-BR, sem `float` |
| `PhoneInput`, `DocumentInput` | Compartilhado | Máscara e validação de telefone e CPF/CNPJ |
| `PeriodFilter`, `KpiCard`, `DataTable`, `EmptyState`, `ConfirmDialog`, `ErrorState` | Compartilhado | Blocos de lista, filtro e feedback |
| `CustomerSearch` | Clientes | Busca única por telefone, nome, CPF; atalho "Novo cliente" |
| `CustomerForm`, `EquipmentForm`, `EquipmentPicker` | Clientes / Equip. | Cadastro e escolha de equipamento do cliente |
| `NewServiceOrderWizard` | OS | 5 passos: cliente, equipamento, entrada, fotos, revisão |
| `ConditionChecklist`, `AccessoriesChecklist` | OS | Checklists de entrada com campo livre |
| `PhotoUploader`, `PhotoGallery` | OS | Câmera traseira, compressão, progresso; galeria com URL assinada |
| `StatusTimeline` | OS / Portal | Linha do tempo; no portal só eventos visíveis ao cliente |
| `StatusChangeDialog` | OS | Oferece só as transições permitidas, com nota opcional |
| `AccessCard` | OS | Código de acesso, link, QR e botão "Enviar no WhatsApp" |
| `BudgetEditor` (`ItemsTable`, `ItemRow`, `TotalsPanel`) | Orçamento | Edição do rascunho; totais oficiais vêm do banco após salvar |
| `BudgetVersionList` | Orçamento | Versões com status, total e decisão |
| `BudgetDocument` | Orçamento / Portal | A proposta profissional (cabeçalho, problema, diagnóstico, itens, totais, condições) |
| `BudgetDecisionPanel` | Portal | Aprovar com aceite; recusar com motivo obrigatório |
| `PortalLoginForm`, `PortalOrderCard` | Portal | Identificação e lista de equipamentos/OS |
| `CashTransactionForm`, `CashSummaryCards` | Caixa | Lançamento de entrada/saída; cartões de entradas, saídas, saldo, previsto, a receber |
| `ServiceOrderFinancials` | Caixa / OS | Aprovado, recebido, custos e lucro estimado de uma OS |

Bibliotecas previstas: Tailwind CSS, shadcn/ui no modo JavaScript, lucide-react (ícones), Zod (validação), browser-image-compression (fotos) e uma biblioteca de QR code. Nada de gerenciador de estado global no início: Server Components + Server Actions bastam.

## 15. Plano de implementação

São 7 fases, e cada uma só termina com migrations e testes passando, uma demonstração em preview da Vercel e a sua validação.

1. **Fase 1 — Fundação**
   - Entregas: projeto Next.js em JavaScript com Tailwind e shadcn/ui; Supabase local via CLI; migrations 0001 e 0002 com RLS; cadastro, login e recuperação de senha; onboarding com `create_assistance`; layout do painel; Configurações (identidade, contato, logo); Usuários (convite por link, papéis, desativar); mapa de erros amigáveis; `.env.example`; seed com 2 assistências; CI rodando os testes pgTAP.
   - Pronto quando: um usuário da Assistência A não lê, cria, altera nem apaga nada da Assistência B em nenhuma tabela da fase; um técnico desativado perde o acesso na requisição seguinte; slug inválido ou reservado é recusado.
2. **Fase 2 — Clientes e equipamentos**
   - Entregas: cadastro, edição e busca de clientes e equipamentos; categorias; telefone normalizado; anonimização LGPD.
   - Pronto quando: telefone repetido é recusado na mesma assistência e aceito em outra; equipamento apontando para cliente de outra assistência é recusado pela FK mesmo com a chave secreta.
3. **Fase 3 — Ordens de serviço**
   - Entregas: abertura em 5 passos; numeração por contador; máquina de estados; histórico; fotos com compressão no Storage privado; comprovante com QR e código de acesso; senha de desbloqueio (se aprovada).
   - Pronto quando: 50 OS criadas em paralelo recebem números únicos e sem buracos; transição inválida é recusada pelo banco; foto da Assistência A não abre para a B.
4. **Fase 4 — Orçamentos**
   - Entregas: editor de itens; cálculo no banco; versões; envio com snapshot e hash; decisão registrada no balcão; `BudgetDocument`.
   - Pronto quando: um `total` enviado pelo navegador é ignorado; item de versão enviada não pode ser alterado; nova versão preserva a anterior intacta; casos de arredondamento (3 × R$ 33,33 = R$ 99,99) batem.
5. **Fase 5 — Portal do cliente**
   - Entregas: identificação por telefone + código; sessão; lista; detalhe; proposta; aprovar e recusar; limite de tentativas.
   - Pronto quando: trocar o código da OS na URL nunca mostra OS de outro cliente; a 6ª tentativa errada em 15 minutos é bloqueada; a aprovação grava data, IP, sessão, versão e hash.
6. **Fase 6 — Caixa**
   - Entregas: lançamentos de entrada e saída; fornecedores; anulação; financeiro por OS; previsto e a receber.
   - Pronto quando: previsto e a receber batem com os orçamentos do seed; lançamento anulado sai do saldo e continua na auditoria; técnico não vê o saldo.
7. **Fase 7 — Dashboard e relatórios**
   - Entregas: indicadores de OS e financeiros; filtros hoje, semana, mês e período; relatórios simples.
   - Pronto quando: cada número do dashboard bate com uma consulta SQL de conferência sobre o seed.

Fica para depois, com o gancho já no modelo: OTP por WhatsApp/SMS (`login_method = 'OTP'`), retorno em garantia (`parent_service_order_id`), PDF de OS e orçamento (bucket `documents`), cobrança do SaaS (`plan`, `subscription_status`), estoque (`part_id` futuro em `budget_items`), notificações, nota fiscal, comissão, múltiplas unidades e PWA.
