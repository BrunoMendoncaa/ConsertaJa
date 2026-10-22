-- Contas de teste da aplicação: criadas pela área admin, plano escolhido por ela,
-- sem assinatura, e só elas podem ser excluídas (com tudo o que têm).
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select * from no_plan();

-- Logins: T1 (dono da conta de teste), T2 (técnico na de teste E numa real), R1 (dono da real)
insert into auth.users (id, email, raw_user_meta_data) values
  ('70000000-0000-4000-8000-0000000000a1', 'teste1@test.dev', '{}'),
  ('70000000-0000-4000-8000-0000000000a2', 'tecnico.misto@test.dev', '{"full_name":"Técnico Misto"}'),
  ('70000000-0000-4000-8000-0000000000b1', 'real.owner@test.dev', '{"full_name":"Dono Real"}');
insert into public.assistances (id, name, slug) values ('7bbbbbbb-0000-4000-8000-000000000000', 'Loja Real', 'loja-real-teste');
insert into public.assistance_members (assistance_id, user_id, role) values
  ('7bbbbbbb-0000-4000-8000-000000000000', '70000000-0000-4000-8000-0000000000b1', 'owner'),
  ('7bbbbbbb-0000-4000-8000-000000000000', '70000000-0000-4000-8000-0000000000a2', 'technician');

-- ---------------------------------------------------------------------------
-- Só o servidor executa; a equipe não muda a marca de teste
-- ---------------------------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'public.admin_create_test_assistance(uuid, text, text, text, text)', 'execute')
      and not has_function_privilege('anon', 'public.admin_create_test_assistance(uuid, text, text, text, text)', 'execute')
      and not has_function_privilege('authenticated', 'public.admin_purge_test_assistance(uuid)', 'execute')
      and not has_function_privilege('anon', 'public.admin_purge_test_assistance(uuid)', 'execute')
      and not has_function_privilege('authenticated', 'public.admin_set_test_assistance(uuid, boolean, text)', 'execute')
      and not has_function_privilege('authenticated', 'public.admin_test_assistance_files(uuid)', 'execute')
      and not has_function_privilege('authenticated', 'public.billing_register_checkout(uuid, text, text, numeric, text, text, uuid)', 'execute'),
  'funções de contas de teste: anon e equipe não executam');
select ok(has_function_privilege('service_role', 'public.admin_purge_test_assistance(uuid)', 'execute')
      and has_function_privilege('service_role', 'public.admin_create_test_assistance(uuid, text, text, text, text)', 'execute'),
  'servidor executa');
select ok(not has_column_privilege('authenticated', 'public.assistances', 'is_test', 'UPDATE')
      and not has_column_privilege('authenticated', 'public.assistances', 'test_plan', 'UPDATE'),
  'equipe não altera is_test nem test_plan');

-- ---------------------------------------------------------------------------
-- Criar conta de teste pronta
-- ---------------------------------------------------------------------------
create temp table _t on commit drop as
  select public.admin_create_test_assistance('70000000-0000-4000-8000-0000000000a1', 'Loja Real', 'loja-real-teste', 'pro', 'Bruno Teste') as id;
grant select on _t to authenticated;  -- só para os testes logados acharem o id
select results_eq($$select a.is_test, a.test_plan, a.slug, a.name from public.assistances a where a.id = (select id from _t)$$,
  $$values (true, 'pro'::text, 'loja-real-teste-2'::text, 'Loja Real'::text)$$,
  'conta de teste criada (endereço do portal ganha -2 quando já existe)');
select results_eq($$select m.role, p.active_assistance_id = (select id from _t), p.full_name
                    from public.assistance_members m join public.profiles p on p.id = m.user_id
                   where m.user_id = '70000000-0000-4000-8000-0000000000a1'$$,
  $$values ('owner'::text, true, 'Bruno Teste'::text)$$, 'login vira dono, com a assistência ativa e o nome');
select throws_ok($$select public.admin_create_test_assistance('70000000-0000-4000-8000-0000000000b1', 'Outra', 'outra', 'pro', 'X')$$,
  'P0001', 'Este login já participa de uma assistência.', 'não usa login que já está numa assistência');
select throws_ok($$select public.admin_create_test_assistance('70000000-0000-4000-8000-0000000000a1', 'Outra', 'outra', 'gold', 'X')$$,
  'P0001', 'Plano inválido.', 'plano só pro ou free');
select is(private.billing_plan((select id from _t)), 'pro', 'teste Pro: tudo liberado');

insert into public.assistance_members (assistance_id, user_id, role)
  select id, '70000000-0000-4000-8000-0000000000a2', 'technician' from _t;

-- Tela da conta de teste: sem assinatura, mostra que é teste
select set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select results_eq($$select (billing_status() ->> 'is_test')::boolean, billing_status() ->> 'test_plan', billing_status() ->> 'plan',
                          (billing_status() ->> 'has_subscription')::boolean$$,
  $$values (true, 'pro'::text, 'pro'::text, false)$$, 'tela: conta de teste no Pro, sem assinatura');
select throws_ok($$update public.assistances set is_test = false where id = (select id from _t)$$,
  '42501', null, 'dono da conta de teste não desliga a marca');
reset role;
select set_config('request.jwt.claims', '', true);

select throws_ok($$select public.billing_register_checkout((select id from _t), 'x', 'monthly', 49, 'a@b.dev', 'https://x', null)$$,
  'P0001', 'Conta de teste do TecnoFix não tem assinatura. O plano é definido na área admin.', 'conta de teste não assina');

-- Trocar para Grátis: vê o limite como o cliente
select lives_ok($$select public.admin_set_test_assistance((select id from _t), true, 'free')$$, 'troca o plano da conta de teste');
select is(private.billing_plan((select id from _t)), 'free', 'teste Grátis: plano Grátis');

-- ---------------------------------------------------------------------------
-- Marcar assistência real como teste
-- ---------------------------------------------------------------------------
update public.assistances set mp_preapproval_id = 'pre-1', subscription_status = 'active', paid_until = now() + interval '20 days'
 where id = '7bbbbbbb-0000-4000-8000-000000000000';
select throws_ok($$select public.admin_set_test_assistance('7bbbbbbb-0000-4000-8000-000000000000', true, 'pro')$$, 'P0001',
  'Esta assistência tem assinatura no Mercado Pago. Cancele a assinatura antes de marcar como teste.',
  'com assinatura vigente não vira teste');
select throws_ok($$select public.admin_purge_test_assistance('7bbbbbbb-0000-4000-8000-000000000000')$$, 'P0001',
  'Só contas de teste podem ser excluídas.', 'assistência real não pode ser excluída');
select throws_ok($$select * from public.admin_test_assistance_files('7bbbbbbb-0000-4000-8000-000000000000')$$, 'P0001',
  'Só contas de teste podem ser excluídas.', 'arquivos de assistência real não são listados para apagar');
update public.assistances set subscription_status = 'canceled' where id = '7bbbbbbb-0000-4000-8000-000000000000';
select lives_ok($$select public.admin_set_test_assistance('7bbbbbbb-0000-4000-8000-000000000000', true, 'pro')$$,
  'assinatura cancelada: pode marcar como teste');
select lives_ok($$select public.admin_set_test_assistance('7bbbbbbb-0000-4000-8000-000000000000', false, null)$$,
  'e desmarcar');
select results_eq($$select is_test, test_plan from public.assistances where id = '7bbbbbbb-0000-4000-8000-000000000000'$$,
  $$values (false, null::text)$$, 'voltou a ser conta real');
select is(private.billing_plan('7bbbbbbb-0000-4000-8000-000000000000'), 'pro', 'conta real volta à regra normal (pago até daqui a 20 dias)');

-- ---------------------------------------------------------------------------
-- Excluir conta de teste com OS, orçamento enviado, foto, caixa e fornecedor
-- ---------------------------------------------------------------------------
select public.admin_set_test_assistance((select id from _t), true, 'pro');
insert into public.customers (id, assistance_id, name, phone)
  select '7c000000-0000-4000-8000-000000000001', id, 'Cliente Teste', '(11) 93333-1111' from _t;
insert into public.equipment (id, assistance_id, customer_id, category_id, brand, model)
  select '7e000000-0000-4000-8000-000000000001', id, '7c000000-0000-4000-8000-000000000001',
         (select c.id from public.equipment_categories c where c.assistance_id is null and c.name = 'Celular'), 'Apple', 'iPhone'
  from _t;
insert into public.suppliers (id, assistance_id, name) select '7f000000-0000-4000-8000-000000000001', id, 'Fornecedor Teste' from _t;
insert into public.service_orders (id, assistance_id, customer_id, equipment_id, reported_issue, technician_id)
  select '75000000-0000-4000-8000-000000000001', id, '7c000000-0000-4000-8000-000000000001',
         '7e000000-0000-4000-8000-000000000001', 'Tela', '70000000-0000-4000-8000-0000000000a2' from _t;
insert into public.service_order_photos (assistance_id, service_order_id, storage_path, mime_type, size_bytes)
  select id, '75000000-0000-4000-8000-000000000001', id::text || '/75000000-0000-4000-8000-000000000001/foto.webp', 'image/webp', 100 from _t;
insert into public.cash_transactions (assistance_id, direction, category, amount, payment_method, description, service_order_id, created_by)
  select id, 'IN', 'RECEBIMENTO_OS', 50, 'PIX', 'Entrada', '75000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-0000000000a1' from _t;
insert into public.cash_transactions (assistance_id, direction, category, amount, payment_method, description, supplier_id, created_by)
  select id, 'OUT', 'FORNECEDOR', 20, 'PIX', 'Peça', '7f000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-0000000000a1' from _t;

select set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select public.create_budget_version('75000000-0000-4000-8000-000000000001');
insert into public.budget_items (budget_version_id, position, kind, description, quantity, unit_price)
  select id, 1, 'PECA', 'Tela', 1, 300 from public.budget_versions where service_order_id = '75000000-0000-4000-8000-000000000001';
update public.budget_versions set estimated_days = 2 where service_order_id = '75000000-0000-4000-8000-000000000001';
select public.send_budget_version((select id from public.budget_versions where service_order_id = '75000000-0000-4000-8000-000000000001'));
-- Fora da exclusão, item de orçamento enviado continua protegido
select throws_ok($$delete from public.budget_items where assistance_id = (select id from _t)$$, 'P0001', null,
  'item de orçamento enviado continua protegido');
reset role;
select set_config('request.jwt.claims', '', true);

-- Arquivos no Storage (a lista que o servidor apaga pela API)
insert into storage.objects (bucket_id, name) select 'service-order-photos', id::text || '/75000000-0000-4000-8000-000000000001/foto.webp' from _t;
insert into storage.objects (bucket_id, name) select 'logos', id::text || '/logo-1.webp' from _t;
insert into storage.objects (bucket_id, name) values ('logos', '7bbbbbbb-0000-4000-8000-000000000000/logo-1.webp');
select results_eq($$select bucket_id, name from public.admin_test_assistance_files((select id from _t)) order by 1$$,
  $$select 'logos'::text, id::text || '/logo-1.webp' from _t
    union all select 'service-order-photos'::text, id::text || '/75000000-0000-4000-8000-000000000001/foto.webp' from _t$$,
  'lista só os arquivos da conta de teste');

create temp table _purge on commit drop as select public.admin_purge_test_assistance((select id from _t)) as users;
select results_eq($$select users from _purge$$, $$values (array['70000000-0000-4000-8000-0000000000a1']::uuid[])$$,
  'devolve só o login que ficou sem assistência (o técnico também está na loja real)');

create function pg_temp.sobrou(p uuid) returns int language plpgsql as $$
declare t record; n int; total int := 0;
begin
  for t in select c.table_name from information_schema.columns c
             join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
            where c.table_schema = 'public' and c.column_name = 'assistance_id' and tb.table_type = 'BASE TABLE'
              and c.table_name <> 'admin_audit_log' loop
    execute format('select count(*) from public.%I where assistance_id = %L', t.table_name, p) into n;
    total := total + n;
  end loop;
  return total + (select count(*) from public.assistances where id = p)::int;
end;
$$;
select is(pg_temp.sobrou((select id from _t)), 0, 'não sobra nenhuma linha da conta de teste em nenhuma tabela');
select ok(exists (select 1 from public.assistances where id = '7bbbbbbb-0000-4000-8000-000000000000')
      and exists (select 1 from public.assistance_members where user_id = '70000000-0000-4000-8000-0000000000a2'),
  'a loja real e o técnico dela continuam');
select is(current_setting('tecnofix.purge_assistance', true), '', 'marca da exclusão desligada no fim');
select throws_ok($$select public.admin_purge_test_assistance((select id from _t))$$, 'P0002', 'Assistência não encontrada.',
  'excluir de novo: não encontrada');

select * from finish();
rollback;
