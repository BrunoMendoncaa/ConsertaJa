-- Portal do cliente: login, sessão, isolamento e decisão
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


-- Prepara um orçamento enviado para a OS A1
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
set local role authenticated;

select public.create_budget_version('a5000000-0000-4000-8000-000000000001');
insert into public.budget_items (budget_version_id, kind, description, quantity, unit_price)
select id, 'SERVICO', 'Troca de tela', 1, 400 from public.budget_versions;
update public.budget_versions set estimated_days = 2, internal_notes = 'Margem baixa';
select public.send_budget_version((select id from public.budget_versions), null);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select results_eq($$select name from public.portal_assistance('tenant-a-test')$$, array['Tenant A'], 'identidade pública da assistência');
select results_eq($$select error_message from public.portal_login('tenant-a-test', '(11) 91111-1111', 'ERRADO', '10.0.0.1', 'test')$$,
  array['Telefone ou código não conferem.'], 'código errado é recusado com mensagem genérica');
select results_eq($$select error_message from public.portal_login('tenant-a-test', '(11) 90000-0000', 'AAAAA2', '10.0.0.1', 'test')$$,
  array['Telefone ou código não conferem.'], 'telefone desconhecido recebe a mesma mensagem');
select results_eq($$select error_message from public.portal_login('tenant-a-test', '(11) 91111-1111', 'BBBBB2', '10.0.0.1', 'test')$$,
  array['Telefone ou código não conferem.'], 'código de OS de outra assistência não serve');
select results_eq($$select error_message from public.portal_login('tenant-b-test', '(11) 91111-1111', 'AAAAA2', '10.0.0.1', 'test')$$,
  array['Telefone ou código não conferem.'], 'código de A não abre o portal de B, mesmo com o mesmo telefone');

reset role;
select set_config('request.jwt.claims', '', true);

select results_eq($$select count(*)::int from public.portal_login_attempts where not success and assistance_id in ('aaaaaaaa-0000-4000-8000-000000000000', 'bbbbbbbb-0000-4000-8000-000000000000')$$, array[4],
  'tentativas falhas ficam registradas');

-- Sessão válida
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

create temp table _tok on commit drop as
  select token from public.portal_login('tenant-a-test', '11 91111-1111', 'aaaaa2', '10.0.0.2', 'Mozilla');
select ok((select length(token) = 64 from _tok), 'login certo devolve token (código aceita minúsculas)');

select results_eq($$select code from public.portal_list_orders((select token from _tok), 'tenant-a-test')$$,
  array['OS-' || extract(year from now())::int || '-000001'], 'lista só a OS do próprio cliente');
select throws_ok($$select * from public.portal_list_orders((select token from _tok), 'tenant-b-test')$$,
  'PT401', null, 'token de A não vale no portal de B');
select throws_ok($$select * from public.portal_list_orders('token-falso', 'tenant-a-test')$$,
  'PT401', null, 'token inválido é recusado');

select is((select public.portal_get_order((select token from _tok), 'tenant-a-test', 'OS-' || extract(year from now())::int || '-000002')),
  null, 'OS de outro cliente da mesma assistência: não encontrada (troca de ID na URL)');
select ok((select public.portal_get_order((select token from _tok), 'tenant-a-test', 'os-' || extract(year from now())::int || '-000001') ->> 'code') is not null,
  'cliente abre a própria OS');
select ok(not ((select public.portal_get_order((select token from _tok), 'tenant-a-test', 'OS-' || extract(year from now())::int || '-000001'))::text like '%Nota interna%'),
  'observação interna nunca vai ao portal');
select ok(not ((select public.portal_get_budget((select token from _tok), 'tenant-a-test', 'OS-' || extract(year from now())::int || '-000001'))::text like '%Margem baixa%'),
  'observação interna do orçamento nunca vai ao portal');

create temp table _bud on commit drop as
  select public.portal_get_budget((select token from _tok), 'tenant-a-test', 'OS-' || extract(year from now())::int || '-000001') as b;
select results_eq($$select b ->> 'status' from _bud$$, array['ENVIADO'], 'proposta aguardando decisão');

select throws_ok($$select public.portal_decide_budget((select token from _tok), 'tenant-a-test', ((select b from _bud) ->> 'id')::uuid,
  'hash-antigo', 'APROVADO', null, '10.0.0.2', 'Mozilla')$$, 'P0001', null, 'hash diferente do exibido é recusado');
select lives_ok($$select public.portal_decide_budget((select token from _tok), 'tenant-a-test', ((select b from _bud) ->> 'id')::uuid,
  (select b ->> 'content_hash' from _bud), 'APROVADO', null, '10.0.0.2', 'Mozilla')$$, 'cliente aprova pelo portal');

reset role;
select set_config('request.jwt.claims', '', true);

select results_eq($$select status, decision_channel, decision_ip::text, (decided_by_session is not null) from public.budget_versions where service_order_id = 'a5000000-0000-4000-8000-000000000001'$$,
  $$values ('APROVADO'::text, 'PORTAL'::text, '10.0.0.2/32'::text, true)$$, 'aprovação registra canal, IP e sessão');
select results_eq($$select changed_via from public.service_order_status_history where to_status = 'APROVADO' and service_order_id = 'a5000000-0000-4000-8000-000000000001'$$,
  array['PORTAL'], 'histórico mostra que veio do portal');
select ok((select actor_portal_session_id is not null from public.audit_logs where action = 'BUDGET_APPROVED' and table_name = 'budget_versions' and assistance_id = 'aaaaaaaa-0000-4000-8000-000000000000'),
  'auditoria guarda a sessão do cliente');

-- Força bruta
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select public.portal_login('tenant-a-test', '(11) 92222-2222', 'XXXXX' || n, '10.0.0.9', 't') from generate_series(1, 5) n;
select results_eq($$select error_message from public.portal_login('tenant-a-test', '(11) 92222-2222', 'AAAAA3', '10.0.0.9', 't')$$,
  array['Muitas tentativas. Aguarde 15 minutos e tente novamente.'], 'bloqueio após 5 erros, mesmo com o código certo');

-- Troca de telefone derruba a sessão
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a01","role":"authenticated"}', true);
set local role authenticated;

update public.customers set phone = '(11) 95555-5555' where id = 'ac000000-0000-4000-8000-000000000001';
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok($$select * from public.portal_list_orders((select token from _tok), 'tenant-a-test')$$,
  'PT401', null, 'trocar o telefone revoga a sessão');

-- Logout
create temp table _tok2 on commit drop as
  select token from public.portal_login('tenant-a-test', '11 95555-5555', 'AAAAA2', '10.0.0.3', 't');
select lives_ok($$select public.portal_logout((select token from _tok2))$$, 'logout');
select throws_ok($$select * from public.portal_me((select token from _tok2), 'tenant-a-test')$$, 'PT401', null, 'sessão encerrada não vale mais');

-- ---------------------------------------------------------------------------
-- Certificado de garantia no portal
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
create temp table _tok3 on commit drop as
  select token from public.portal_login('tenant-a-test', '11 95555-5555', 'AAAAA2', '10.0.0.4', 't');
select ok((select token is not null from _tok3), 'cliente entra de novo com o telefone novo');
select is(public.portal_get_warranty((select token from _tok3), 'tenant-a-test', 'OS-' || extract(year from now())::int || '-000001'),
  null, 'antes da entrega não há certificado');

-- Técnico conclui e entrega
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
set local role authenticated;
update public.service_orders set solution = 'Tela trocada e testada' where id = 'a5000000-0000-4000-8000-000000000001';
select public.change_service_order_status('a5000000-0000-4000-8000-000000000001', 'EM_MANUTENCAO');
select public.change_service_order_status('a5000000-0000-4000-8000-000000000001', 'PRONTO');
select public.change_service_order_status('a5000000-0000-4000-8000-000000000001', 'ENTREGUE');

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
create temp table _cert on commit drop as
  select public.portal_get_warranty((select token from _tok3), 'tenant-a-test', 'os-' || extract(year from now())::int || '-000001') as c;
select results_eq($$select c -> 'order' ->> 'status', c -> 'order' ->> 'outcome', (c -> 'approved' ->> 'warranty_days')::int,
                           c -> 'order' -> 'customer' ->> 'name', c -> 'assistance' ->> 'name' from _cert$$,
  $$values ('ENTREGUE'::text, 'REPARADO'::text, 90, 'Cliente A1'::text, 'Tenant A'::text)$$,
  'certificado da própria OS entregue: dados do cliente, da assistência e prazo');
select ok((select (c -> 'order' ->> 'warranty_until')::date = (now() at time zone 'America/Sao_Paulo')::date + 90 from _cert), 'garantia vai até hoje + 90 dias');
select ok((select jsonb_array_length(c -> 'approved' -> 'snapshot' -> 'items') = 1 from _cert), 'traz os itens do orçamento aprovado');
select ok((select c::text not like '%Nota interna%' and c::text not like '%Margem baixa%' from _cert),
  'observações internas da OS e do orçamento não vão para o certificado');
select is(public.portal_get_warranty((select token from _tok3), 'tenant-a-test', 'OS-' || extract(year from now())::int || '-000002'),
  null, 'certificado de OS de outro cliente: não encontrado');
select throws_ok($$select public.portal_get_warranty((select token from _tok3), 'tenant-b-test', 'OS-' || extract(year from now())::int || '-000001')$$,
  'PT401', null, 'sessão de A não abre certificado no portal de B');
select throws_ok($$select public.portal_get_warranty('token-falso', 'tenant-a-test', 'OS-' || extract(year from now())::int || '-000001')$$,
  'PT401', null, 'sem sessão válida não há certificado');

-- O código da OS entregue continua valendo durante a garantia (mesmo depois de 90 dias)
reset role;
alter table public.service_orders disable trigger set_updated_at;
update public.service_orders set updated_at = now() - interval '120 days' where id = 'a5000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select ok((select token is not null from public.portal_login('tenant-a-test', '11 95555-5555', 'AAAAA2', '10.0.0.5', 't')),
  'OS entregue há 120 dias, garantia em vigor: login continua funcionando');
reset role;
update public.service_orders set warranty_until = private.today_br() - 1 where id = 'a5000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq($$select error_message from public.portal_login('tenant-a-test', '11 95555-5555', 'AAAAA2', '10.0.0.5', 't')$$,
  array['Telefone ou código não conferem.'], 'garantia vencida e mais de 90 dias: o código deixa de valer');
reset role;
alter table public.service_orders enable trigger set_updated_at;

reset role;
select * from finish();
rollback;
