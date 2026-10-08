-- Abertura de OS, numeração, máquina de estados, histórico e senha
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


reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a03","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select * from public.create_service_order(jsonb_build_object(
  'customer', jsonb_build_object('name', 'Cliente Novo', 'phone', '+55 (11) 94444-4444'),
  'equipment', jsonb_build_object('category_id', (select id from public.equipment_categories where name = 'Tablet' and assistance_id is null), 'brand', 'Apple', 'model', 'iPad'),
  'reported_issue', 'Não liga',
  'accessories', jsonb_build_array('Carregador'),
  'unlock_code', '1234'))$$, 'atendente abre OS com cliente e equipamento novos');

select results_eq($$select phone_e164 from public.customers where name = 'Cliente Novo'$$, array['+5511944444444'],
  'telefone normalizado para E.164');
select results_eq($$select code from public.service_orders order by number$$,
  array['OS-' || extract(year from now())::int || '-000001', 'OS-' || extract(year from now())::int || '-000002',
        'OS-' || extract(year from now())::int || '-000003'],
  'numeração sequencial por assistência no formato OS-AAAA-000001');
select ok((select access_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' from public.service_orders where number = 3),
  'código de acesso tem 6 caracteres sem ambíguos');
select results_eq($$select to_status from public.service_order_status_history h join public.service_orders so on so.id = h.service_order_id where so.number = 3$$,
  array['RECEBIDO'], 'abertura grava o primeiro histórico');

select throws_ok($$insert into public.customers (name, phone) values ('Duplicado', '11 94444-4444')$$,
  '23505', null, 'telefone duplicado na mesma assistência é recusado');
select throws_ok($$insert into public.customers (name, phone) values ('Sem telefone', '123')$$,
  '23514', null, 'telefone inválido é recusado');

-- Status só muda por função
select throws_ok($$update public.service_orders set status = 'ENTREGUE' where id = 'a5000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'status não pode ser alterado direto pela API');
select throws_ok($$update public.service_orders set access_code = 'AAAAAA' where id = 'a5000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'código de acesso não pode ser alterado direto');

-- Senha: atendente grava mas não lê
select is_empty($$select 1 from public.service_order_secrets$$, 'atendente não lê senhas de desbloqueio');

-- Máquina de estados
select throws_ok($$select public.change_service_order_status('a5000000-0000-4000-8000-000000000001', 'EM_DIAGNOSTICO', null)$$,
  '42501', null, 'atendente não inicia diagnóstico');
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
set local role authenticated;

select results_eq($$select count(*)::int from public.service_order_secrets$$, array[1], 'técnico lê a senha');
select throws_ok($$select public.change_service_order_status('a5000000-0000-4000-8000-000000000001', 'PRONTO', null)$$,
  'P0001', null, 'RECEBIDO → PRONTO não é permitido');
select lives_ok($$select public.change_service_order_status('a5000000-0000-4000-8000-000000000001', 'EM_DIAGNOSTICO', 'Iniciando')$$,
  'RECEBIDO → EM_DIAGNOSTICO');
select throws_ok($$select public.change_service_order_status('a5000000-0000-4000-8000-000000000001', 'PRONTO', null)$$,
  'P0001', 'Registre o diagnóstico antes de marcar o reparo como inviável.', 'inviável exige diagnóstico');
update public.service_orders set diagnosis = 'Placa oxidada sem reparo' where id = 'a5000000-0000-4000-8000-000000000001';
select lives_ok($$select public.change_service_order_status('a5000000-0000-4000-8000-000000000001', 'PRONTO', null)$$,
  'EM_DIAGNOSTICO → PRONTO (inviável)');
select results_eq($$select outcome from public.service_orders where id = 'a5000000-0000-4000-8000-000000000001'$$,
  array['NAO_REPARADO_INVIAVEL'], 'desfecho registrado');
select results_eq($$select note from public.service_order_status_history
                   where service_order_id = 'a5000000-0000-4000-8000-000000000001' and to_status = 'EM_DIAGNOSTICO'$$,
  array['Iniciando'], 'nota da mudança fica no histórico');
select throws_ok($$select public.change_service_order_status('a5000000-0000-4000-8000-000000000001', 'CANCELADO', 'Cliente desistiu')$$,
  '42501', null, 'técnico não cancela');

reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a03","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.change_service_order_status('a5000000-0000-4000-8000-000000000001', 'ENTREGUE', null)$$,
  'atendente entrega');
select ok((select delivered_at is not null from public.service_orders where id = 'a5000000-0000-4000-8000-000000000001'),
  'data de entrega gravada');
reset role;
select set_config('request.jwt.claims', '', true);

select results_eq($$select count(*)::int from public.service_order_secrets so join public.service_orders o on o.id = so.service_order_id where o.status = 'ENTREGUE' and o.assistance_id = 'aaaaaaaa-0000-4000-8000-000000000000'$$,
  array[0], 'senha apagada na entrega');

reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a01","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$select public.change_service_order_status('a5000000-0000-4000-8000-000000000001', 'CANCELADO', 'Teste')$$,
  'P0001', 'Uma OS entregue não pode ser cancelada.', 'OS entregue não é cancelada');
select throws_ok($$select public.change_service_order_status('a5000000-0000-4000-8000-000000000002', 'CANCELADO', null)$$,
  'P0001', 'Informe o motivo do cancelamento.', 'cancelamento exige motivo');
select lives_ok($$select public.change_service_order_status('a5000000-0000-4000-8000-000000000002', 'CANCELADO', 'Cliente desistiu')$$,
  'owner cancela com motivo');
select results_eq($$select count(*)::int from public.audit_logs where table_name = 'service_orders' and action = 'OS_CANCELLED'$$,
  array[1], 'cancelamento fica na auditoria');

reset role;
select * from finish();
rollback;
