-- Caixa: permissões por papel, previsto, a receber, anulação e indicadores
-- Gerado a partir de um fixture comum. Rode com: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select * from no_plan();

-- ---------------------------------------------------------------------------
-- Fixture comum: duas assistências (A e B) com IDs fixos.
-- Assistência A: owner ...a01, técnico ...a02, atendente ...a03
-- Assistência B: owner ...b01
-- O cliente A1 e o cliente B1 têm o MESMO telefone (são pessoas em tenants diferentes).
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000a01', 'owner.a@test.dev',     '{"full_name":"Owner A"}'),
  ('a0000000-0000-4000-8000-000000000a02', 'tech.a@test.dev',      '{"full_name":"Tech A"}'),
  ('a0000000-0000-4000-8000-000000000a03', 'attendant.a@test.dev', '{"full_name":"Attendant A"}'),
  ('b0000000-0000-4000-8000-000000000b01', 'owner.b@test.dev',     '{"full_name":"Owner B"}');

insert into public.assistances (id, name, slug) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'Tenant A', 'tenant-a-test'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'Tenant B', 'tenant-b-test');

insert into public.assistance_members (assistance_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000a01', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000a02', 'technician'),
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000a03', 'attendant'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'b0000000-0000-4000-8000-000000000b01', 'owner');

update public.profiles set active_assistance_id = 'aaaaaaaa-0000-4000-8000-000000000000'
 where id in ('a0000000-0000-4000-8000-000000000a01','a0000000-0000-4000-8000-000000000a02','a0000000-0000-4000-8000-000000000a03');
update public.profiles set active_assistance_id = 'bbbbbbbb-0000-4000-8000-000000000000'
 where id = 'b0000000-0000-4000-8000-000000000b01';

insert into public.customers (id, assistance_id, name, phone) values
  ('ac000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000000', 'Cliente A1', '(11) 91111-1111'),
  ('ac000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000000', 'Cliente A2', '(11) 92222-2222'),
  ('bc000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000000', 'Cliente B1', '(11) 91111-1111');

insert into public.equipment (id, assistance_id, customer_id, category_id, brand, model) values
  ('ae000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000000', 'ac000000-0000-4000-8000-000000000001',
   (select id from public.equipment_categories where assistance_id is null and name = 'Celular'), 'Apple', 'iPhone A1'),
  ('ae000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000000', 'ac000000-0000-4000-8000-000000000002',
   (select id from public.equipment_categories where assistance_id is null and name = 'Celular'), 'Samsung', 'Galaxy A2'),
  ('be000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000000', 'bc000000-0000-4000-8000-000000000001',
   (select id from public.equipment_categories where assistance_id is null and name = 'Notebook'), 'Dell', 'Notebook B1');

insert into public.service_orders (id, assistance_id, customer_id, equipment_id, reported_issue, access_code, internal_notes) values
  ('a5000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000000', 'ac000000-0000-4000-8000-000000000001',
   'ae000000-0000-4000-8000-000000000001', 'Tela quebrada', 'AAAAA2', 'Nota interna A'),
  ('a5000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000000', 'ac000000-0000-4000-8000-000000000002',
   'ae000000-0000-4000-8000-000000000002', 'Não carrega', 'AAAAA3', null),
  ('b5000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000000', 'bc000000-0000-4000-8000-000000000001',
   'be000000-0000-4000-8000-000000000001', 'Teclado falhando', 'BBBBB2', 'Nota interna B');


-- Orçamento aprovado de 500 na OS A1 e enviado (pendente) de 300 na OS A2
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
set local role authenticated;

select public.create_budget_version('a5000000-0000-4000-8000-000000000001');
insert into public.budget_items (budget_version_id, kind, description, quantity, unit_price)
select id, 'SERVICO', 'Reparo', 1, 500 from public.budget_versions where service_order_id = 'a5000000-0000-4000-8000-000000000001';
update public.budget_versions set estimated_days = 2;
select public.send_budget_version((select id from public.budget_versions where service_order_id = 'a5000000-0000-4000-8000-000000000001'), null);
select public.staff_decide_budget((select id from public.budget_versions where service_order_id = 'a5000000-0000-4000-8000-000000000001'), 'APROVADO', 'BALCAO', null);

select public.create_budget_version('a5000000-0000-4000-8000-000000000002');
insert into public.budget_items (budget_version_id, kind, description, quantity, unit_price)
select id, 'SERVICO', 'Reparo', 1, 300 from public.budget_versions where service_order_id = 'a5000000-0000-4000-8000-000000000002';
update public.budget_versions set estimated_days = 2 where service_order_id = 'a5000000-0000-4000-8000-000000000002';
select public.send_budget_version((select id from public.budget_versions where service_order_id = 'a5000000-0000-4000-8000-000000000002'), null);

-- Permissões de lançamento
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a03","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$insert into public.cash_transactions (direction, category, amount, payment_method, description, service_order_id)
  values ('IN', 'RECEBIMENTO_OS', 200, 'PIX', 'Sinal', 'a5000000-0000-4000-8000-000000000001')$$, 'atendente registra recebimento');
select throws_ok($$insert into public.cash_transactions (direction, category, amount, payment_method, description)
  values ('OUT', 'DESPESA_OPERACIONAL', 50, 'PIX', 'Café')$$, '42501', null, 'atendente não lança despesa');
select throws_ok($$insert into public.cash_transactions (direction, category, amount, payment_method, description, service_order_id)
  values ('OUT', 'RECEBIMENTO_OS', 10, 'PIX', 'Errado', 'a5000000-0000-4000-8000-000000000001')$$, '23514', null, 'direção precisa bater com a categoria');
select throws_ok($$insert into public.cash_transactions (direction, category, amount, payment_method, description, service_order_id)
  values ('IN', 'RECEBIMENTO_OS', -5, 'PIX', 'Negativo', 'a5000000-0000-4000-8000-000000000001')$$, '23514', null, 'valor precisa ser positivo');
select throws_ok($$insert into public.cash_transactions (direction, category, amount, payment_method, description, created_by)
  values ('IN', 'OUTRO_RECEBIMENTO', 5, 'PIX', 'Forjado', 'a0000000-0000-4000-8000-000000000a01')$$, '42501', null, 'não dá para lançar em nome de outro');

reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$insert into public.cash_transactions (direction, category, amount, payment_method, description, service_order_id, quantity)
  values ('OUT', 'COMPRA_PECA', 120, 'PIX', 'Peça', 'a5000000-0000-4000-8000-000000000001', 1)$$, 'técnico registra compra de peça');
select results_eq($$select count(*)::int from public.cash_transactions$$, array[1], 'técnico vê só o que lançou');
select results_eq($$select (public.dashboard_summary(current_date, current_date) ->> 'can_see_finance')::boolean$$, array[false],
  'técnico não vê o financeiro no dashboard');
select results_eq($$select public.dashboard_summary(current_date, current_date) -> 'finance'$$, array['null'::jsonb],
  'bloco financeiro vem vazio para o técnico');
select results_eq($$select (public.service_order_balance('a5000000-0000-4000-8000-000000000001') ->> 'balance_due')::numeric$$,
  array[300::numeric], 'saldo a receber da OS (500 aprovados − 200 recebidos)');
select throws_ok($$select public.void_cash_transaction((select id from public.cash_transactions limit 1), 'Erro')$$,
  '42501', null, 'técnico não anula lançamento');
select throws_ok($$select public.report_summary(current_date, current_date)$$, '42501', null, 'técnico não abre relatórios');

reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a01","role":"authenticated"}', true);
set local role authenticated;

insert into public.cash_transactions (direction, category, amount, payment_method, description)
values ('OUT', 'DESPESA_OPERACIONAL', 80, 'BOLETO', 'Internet');
select results_eq($$select count(*)::int from public.cash_transactions$$, array[3], 'dono vê todos os lançamentos');

create temp table _d on commit drop as select public.dashboard_summary(current_date, current_date) as d;
select results_eq($$select (d -> 'finance' ->> 'inflow')::numeric, (d -> 'finance' ->> 'outflow')::numeric, (d -> 'finance' ->> 'balance')::numeric from _d$$,
  $$values (200::numeric, 200::numeric, 0::numeric)$$, 'entradas, saídas e saldo do dia');
select results_eq($$select (d -> 'finance' ->> 'forecast')::numeric from _d$$, array[300::numeric], 'previsto = orçamento enviado de 300');
select results_eq($$select (d -> 'finance' ->> 'receivable')::numeric from _d$$, array[300::numeric], 'a receber = 500 aprovados − 200');

select lives_ok($$select public.void_cash_transaction((select id from public.cash_transactions where description = 'Internet'), 'Lançado em duplicidade')$$,
  'dono anula lançamento');
select results_eq($$select (public.dashboard_summary(current_date, current_date) -> 'finance' ->> 'outflow')::numeric$$, array[120::numeric],
  'lançamento anulado sai do saldo');
select results_eq($$select count(*)::int from public.cash_transactions where voided_at is not null$$, array[1], 'mas continua registrado');
select throws_ok($$delete from public.cash_transactions$$, '42501', null, 'lançamentos nunca são apagados');
select throws_ok($$update public.cash_transactions set amount = 1$$, '42501', null, 'lançamentos nunca são editados');
select results_eq($$select estimated_profit from public.v_service_order_financials where service_order_id = 'a5000000-0000-4000-8000-000000000001'$$,
  array[80::numeric], 'lucro estimado da OS = 200 recebidos − 120 de peça');

reset role;
select * from finish();
rollback;
