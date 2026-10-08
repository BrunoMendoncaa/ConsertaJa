-- Teste mais importante: a Assistência A não acessa NADA da Assistência B
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


-- ===== Leitura =====
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a01","role":"authenticated"}', true);
set local role authenticated;

select results_eq('select count(*)::int from public.assistances', array[1], 'A enxerga só a própria assistência');
select results_eq('select id from public.assistances', array['aaaaaaaa-0000-4000-8000-000000000000'::uuid], 'a assistência visível é a A');
select results_eq('select count(*)::int from public.customers', array[2], 'A enxerga só os 2 clientes dela');
select is_empty($$select 1 from public.customers where id = 'bc000000-0000-4000-8000-000000000001'$$, 'cliente de B é invisível mesmo pelo id');
select is_empty($$select 1 from public.equipment where assistance_id = 'bbbbbbbb-0000-4000-8000-000000000000'$$, 'equipamentos de B são invisíveis');
select is_empty($$select 1 from public.service_orders where id = 'b5000000-0000-4000-8000-000000000001'$$, 'OS de B é invisível pelo id');
select is_empty($$select 1 from public.v_service_orders where assistance_id = 'bbbbbbbb-0000-4000-8000-000000000000'$$, 'view de OS não vaza B');
select is_empty($$select 1 from public.service_order_status_history where assistance_id = 'bbbbbbbb-0000-4000-8000-000000000000'$$, 'histórico de B é invisível');
select is_empty($$select 1 from public.profiles where id = 'b0000000-0000-4000-8000-000000000b01'$$, 'perfil do dono de B é invisível');
select is_empty($$select 1 from public.assistance_members where assistance_id = 'bbbbbbbb-0000-4000-8000-000000000000'$$, 'equipe de B é invisível');

-- ===== Escrita forjando o tenant =====
select throws_ok(
  $$insert into public.customers (assistance_id, name, phone) values ('bbbbbbbb-0000-4000-8000-000000000000', 'Intruso', '11988887777')$$,
  '42501', null, 'API não pode informar assistance_id (privilégio de coluna)');

select lives_ok($$insert into public.customers (name, phone) values ('Novo A', '(11) 93333-3333')$$, 'insert sem assistance_id funciona');
select results_eq($$select assistance_id from public.customers where name = 'Novo A'$$, array['aaaaaaaa-0000-4000-8000-000000000000'::uuid],
  'o tenant do registro vem do banco, não do cliente');

select results_eq(
  $$with u as (update public.customers set name = 'Hackeado' where id = 'bc000000-0000-4000-8000-000000000001' returning 1)
    select count(*)::int from u$$, array[0], 'update em cliente de B não afeta nenhuma linha');
select results_eq(
  $$with d as (delete from public.customers where id = 'bc000000-0000-4000-8000-000000000001' returning 1)
    select count(*)::int from d$$, array[0], 'delete em cliente de B não afeta nenhuma linha');

select throws_ok(
  $$insert into public.equipment (customer_id, category_id, brand)
    values ('bc000000-0000-4000-8000-000000000001', (select id from public.equipment_categories where name = 'Celular' and assistance_id is null), 'X')$$,
  '23503', null, 'equipamento não pode apontar para cliente de B (FK composta)');

select throws_ok(
  $$insert into public.service_orders (customer_id, equipment_id, reported_issue)
    values ('ac000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000002', 'Teste cruzado')$$,
  '23503', null, 'OS não pode usar equipamento de outro cliente');

select throws_ok(
  $$insert into public.service_orders (customer_id, equipment_id, reported_issue)
    values ('bc000000-0000-4000-8000-000000000001', 'be000000-0000-4000-8000-000000000001', 'Teste cruzado')$$,
  '23503', null, 'OS não pode usar cliente/equipamento de B');

select throws_ok(
  $$insert into public.cash_transactions (direction, category, amount, payment_method, description, service_order_id)
    values ('IN', 'RECEBIMENTO_OS', 10, 'PIX', 'Teste', 'b5000000-0000-4000-8000-000000000001')$$,
  '23503', null, 'movimentação não pode apontar para OS de B');

-- ===== Funções (RPC) =====
select throws_ok($$select public.change_service_order_status('b5000000-0000-4000-8000-000000000001', 'EM_DIAGNOSTICO', null)$$,
  'P0001', 'OS não encontrada.', 'RPC de status não alcança OS de B');
select throws_ok($$select public.create_budget_version('b5000000-0000-4000-8000-000000000001')$$,
  'P0001', 'OS não encontrada.', 'RPC de orçamento não alcança OS de B');
select throws_ok($$select public.switch_assistance('bbbbbbbb-0000-4000-8000-000000000000')$$, '42501', null, 'não troca para assistência sem vínculo');
select throws_ok($$select public.regenerate_access_code('b5000000-0000-4000-8000-000000000001')$$,
  'P0001', 'OS não encontrada.', 'não regenera código de OS de B');
select is((select public.service_order_balance('b5000000-0000-4000-8000-000000000001')), null, 'saldo de OS de B não é revelado');
select is((select count(*)::int from public.team_members()), 3, 'equipe listada é só a de A');

-- ===== Storage =====
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('service-order-photos', 'bbbbbbbb-0000-4000-8000-000000000000/b5000000-0000-4000-8000-000000000001/x.webp')$$,
  '42501', null, 'não grava foto na pasta de B');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('service-order-photos', 'aaaaaaaa-0000-4000-8000-000000000000/a5000000-0000-4000-8000-000000000001/x.webp')$$,
  'grava foto na própria pasta');
select throws_ok(
  $$insert into public.service_order_photos (service_order_id, storage_path, mime_type, size_bytes)
    values ('a5000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000000/a5000000-0000-4000-8000-000000000001/y.webp', 'image/webp', 100)$$,
  '23514', null, 'metadado da foto exige caminho dentro da pasta do tenant');

-- ===== Visão do dono de B =====
reset role;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000b01","role":"authenticated"}', true);
set local role authenticated;

select results_eq('select count(*)::int from public.customers', array[1], 'B enxerga só o próprio cliente');
select is_empty($$select 1 from public.service_orders where assistance_id = 'aaaaaaaa-0000-4000-8000-000000000000'$$, 'B não enxerga OS de A');
select is_empty($$select 1 from public.audit_logs where assistance_id = 'aaaaaaaa-0000-4000-8000-000000000000'$$, 'B não lê a auditoria de A');

-- ===== Visitante anônimo =====
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok('select 1 from public.customers', '42501', null, 'anon não lê clientes');
select throws_ok('select 1 from public.service_orders', '42501', null, 'anon não lê OS');
select throws_ok('select 1 from public.portal_sessions', '42501', null, 'anon não lê sessões do portal');
select throws_ok($$select public.dashboard_summary(current_date, current_date)$$, '42501', null, 'anon não executa RPC da equipe');

-- ===== Papéis =====
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
set local role authenticated;

select is_empty('select 1 from public.audit_logs', 'técnico não lê a auditoria');
select throws_ok($$select public.create_invitation('x@test.dev', 'technician')$$, '42501', null, 'técnico não convida');

-- ===== Membro desativado perde acesso na hora =====
reset role;
select set_config('request.jwt.claims', '', true);

update public.assistance_members set active = false
 where user_id = 'a0000000-0000-4000-8000-000000000a02' and assistance_id = 'aaaaaaaa-0000-4000-8000-000000000000';
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
set local role authenticated;

select results_eq('select count(*)::int from public.customers', array[0], 'técnico desativado não lê mais nada');
select throws_ok($$insert into public.customers (name, phone) values ('Depois', '11977776666')$$,
  '42501', null, 'técnico desativado não grava');

reset role;
select * from finish();
rollback;
