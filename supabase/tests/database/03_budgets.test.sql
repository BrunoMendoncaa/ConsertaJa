-- Orçamento: cálculo no banco, imutabilidade, versões e decisão
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
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.create_budget_version('a5000000-0000-4000-8000-000000000001')$$, 'técnico cria a versão 1');
select results_eq($$select version, status from public.budget_versions where service_order_id = 'a5000000-0000-4000-8000-000000000001'$$,
  $$values (1, 'RASCUNHO'::text)$$, 'versão 1 em rascunho');

insert into public.budget_items (budget_version_id, position, kind, description, quantity, unit_price)
select id, 1, 'PECA', 'Peça', 3, 33.33 from public.budget_versions where service_order_id = 'a5000000-0000-4000-8000-000000000001';
insert into public.budget_items (budget_version_id, position, kind, description, quantity, unit_price, discount_amount)
select id, 2, 'SERVICO', 'Mão de obra', 1, 150, 10 from public.budget_versions where service_order_id = 'a5000000-0000-4000-8000-000000000001';

select results_eq($$select subtotal from public.budget_items order by position$$, array[99.99, 140.00]::numeric[],
  'subtotal = quantidade × unitário − desconto (3 × 33,33 = 99,99)');
select results_eq($$select items_subtotal, total from public.budget_versions$$, $$values (239.99::numeric, 239.99::numeric)$$,
  'totais da versão recalculados pelo banco');

update public.budget_versions set discount_amount = 39.99, surcharge_amount = 20, estimated_days = 3;
select results_eq($$select total from public.budget_versions$$, array[220.00::numeric], 'total = itens − desconto + acréscimo');

select throws_ok($$update public.budget_versions set total = 1$$, '42501', null, 'API não define o total');
select throws_ok($$update public.budget_items set subtotal = 1$$, '428C9', null, 'subtotal é coluna gerada');
select throws_ok($$update public.budget_versions set discount_amount = 1000$$, 'P0001',
  'O desconto não pode ser maior que o valor dos itens.', 'desconto maior que os itens é recusado');
select throws_ok($$insert into public.budget_items (budget_version_id, kind, description, quantity, unit_price, discount_amount)
  select id, 'PECA', 'X', 1, 10, 11 from public.budget_versions$$, '23514', null, 'desconto do item maior que o item é recusado');

reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a03","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$insert into public.budget_items (budget_version_id, kind, description, quantity, unit_price)
  select id, 'PECA', 'X', 1, 10 from public.budget_versions$$, '42501', null, 'atendente não edita itens');

reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.send_budget_version((select id from public.budget_versions), null)$$, 'envia a versão 1');
select results_eq($$select status from public.budget_versions$$, array['ENVIADO'], 'versão enviada');
select results_eq($$select status from public.service_orders where id = 'a5000000-0000-4000-8000-000000000001'$$,
  array['AGUARDANDO_APROVACAO'], 'OS foi para AGUARDANDO_APROVACAO');
select ok((select content_hash = encode(sha256(convert_to(snapshot::text, 'UTF8')), 'hex') from public.budget_versions),
  'hash confere com o snapshot');
select results_eq($$select (snapshot -> 'totals' ->> 'total')::numeric from public.budget_versions$$, array[220.00::numeric],
  'snapshot congela o total');
select ok((select valid_until = (now() at time zone 'America/Sao_Paulo')::date + 10 from public.budget_versions),
  'validade padrão de 10 dias');

-- Imutabilidade
select throws_ok($$update public.budget_items set unit_price = 1$$, 'P0001', null, 'item de versão enviada não muda');
select throws_ok($$insert into public.budget_items (budget_version_id, kind, description, quantity, unit_price)
  select id, 'PECA', 'X', 1, 10 from public.budget_versions$$, 'P0001', null, 'não adiciona item em versão enviada');
select throws_ok($$delete from public.budget_items$$, 'P0001', null, 'não remove item de versão enviada');
select throws_ok($$update public.budget_versions set discount_amount = 0$$, 'P0001', null, 'cabeçalho de versão enviada não muda');

-- Nova versão
select lives_ok($$select public.create_budget_version('a5000000-0000-4000-8000-000000000001')$$, 'cria a versão 2');
select results_eq($$select version, status from public.budget_versions order by version$$,
  $$values (1, 'SUBSTITUIDO'::text), (2, 'RASCUNHO'::text)$$, 'v1 vira SUBSTITUIDO; v2 em rascunho');
select results_eq($$select count(*)::int from public.budget_items i join public.budget_versions b on b.id = i.budget_version_id where b.version = 2$$,
  array[2], 'itens copiados para a v2');
select results_eq($$select (snapshot -> 'totals' ->> 'total')::numeric from public.budget_versions where version = 1$$,
  array[220.00::numeric], 'v1 continua intacta');
select results_eq($$select status from public.service_orders where id = 'a5000000-0000-4000-8000-000000000001'$$,
  array['EM_DIAGNOSTICO'], 'OS volta para diagnóstico enquanto a nova versão é preparada');
select throws_ok($$select public.send_budget_version((select id from public.budget_versions where version = 1), null)$$,
  'P0001', null, 'versão substituída não pode ser reenviada');

update public.budget_items set unit_price = 40 where position = 1 and budget_version_id = (select id from public.budget_versions where version = 2);
select lives_ok($$select public.send_budget_version((select id from public.budget_versions where version = 2), 5)$$, 'envia a v2 com 5 dias de validade');

-- Decisão no balcão
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a03","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$select public.staff_decide_budget((select id from public.budget_versions where version = 2), 'RECUSADO', 'BALCAO', '')$$,
  'P0001', 'Conte rapidamente o motivo da recusa.', 'recusa exige motivo');
select lives_ok($$select public.staff_decide_budget((select id from public.budget_versions where version = 2), 'APROVADO', 'TELEFONE', null)$$,
  'atendente registra aprovação por telefone');
select results_eq($$select status, decision_channel, decided_by_user from public.budget_versions where version = 2$$,
  $$values ('APROVADO'::text, 'TELEFONE'::text, 'a0000000-0000-4000-8000-000000000a03'::uuid)$$, 'decisão gravada com canal e responsável');
select results_eq($$select status from public.service_orders where id = 'a5000000-0000-4000-8000-000000000001'$$,
  array['APROVADO'], 'OS aprovada');
select throws_ok($$select public.staff_decide_budget((select id from public.budget_versions where version = 2), 'RECUSADO', 'BALCAO', 'Mudou de ideia')$$,
  'P0001', 'Este orçamento não está mais aguardando decisão.', 'decisão não é refeita');

-- Validade vencida
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
set local role authenticated;

select public.change_service_order_status('a5000000-0000-4000-8000-000000000001', 'EM_MANUTENCAO', null);
select lives_ok($$select public.create_budget_version('a5000000-0000-4000-8000-000000000001')$$, 'orçamento complementar (v3)');
select lives_ok($$select public.send_budget_version((select id from public.budget_versions where version = 3), null)$$, 'envia a v3');
reset role;
select set_config('request.jwt.claims', '', true);

alter table public.budget_versions disable trigger b_guard;
update public.budget_versions set valid_until = current_date - 20 where version = 3 and service_order_id = 'a5000000-0000-4000-8000-000000000001';
alter table public.budget_versions enable trigger b_guard;
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a03","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$select public.staff_decide_budget((select id from public.budget_versions where version = 3), 'APROVADO', 'BALCAO', null)$$,
  'P0001', null, 'orçamento vencido não pode ser aprovado');
select results_eq($$select is_expired from public.v_budget_versions where version = 3$$, array[true], 'view marca como vencido');

reset role;
select * from finish();
rollback;
