-- Assinatura: teste grátis, bloqueio, sincronização com o Mercado Pago e permissões
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select * from no_plan();

-- ---------------------------------------------------------------------------
-- Fixture: assistências A e B
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000a01', 'owner.a@test.dev', '{"full_name":"Owner A"}'),
  ('a0000000-0000-4000-8000-000000000a02', 'tech.a@test.dev',  '{"full_name":"Tech A"}'),
  ('b0000000-0000-4000-8000-000000000b01', 'owner.b@test.dev', '{"full_name":"Owner B"}');

insert into public.assistances (id, name, slug) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'Tenant A', 'tenant-a-test'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'Tenant B', 'tenant-b-test');

insert into public.assistance_members (assistance_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000a01', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000000', 'a0000000-0000-4000-8000-000000000a02', 'technician'),
  ('bbbbbbbb-0000-4000-8000-000000000000', 'b0000000-0000-4000-8000-000000000b01', 'owner');

update public.profiles set active_assistance_id = 'aaaaaaaa-0000-4000-8000-000000000000'
 where id in ('a0000000-0000-4000-8000-000000000a01', 'a0000000-0000-4000-8000-000000000a02');
update public.profiles set active_assistance_id = 'bbbbbbbb-0000-4000-8000-000000000000'
 where id = 'b0000000-0000-4000-8000-000000000b01';

insert into public.customers (id, assistance_id, name, phone) values
  ('ac000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000000', 'Cliente A1', '(11) 91111-1111');
insert into public.equipment (id, assistance_id, customer_id, category_id, brand, model) values
  ('ae000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000000', 'ac000000-0000-4000-8000-000000000001',
   (select id from public.equipment_categories where assistance_id is null and name = 'Celular'), 'Apple', 'iPhone A1');

-- ---------------------------------------------------------------------------
-- Teste grátis
-- ---------------------------------------------------------------------------
select ok((select trial_ends_at between now() + interval '13 days 23 hours' and now() + interval '14 days 1 minute'
           from public.assistances where id = 'aaaaaaaa-0000-4000-8000-000000000000'),
  'assistência nova ganha 14 dias de teste');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a01","role":"authenticated"}', true);
set local role authenticated;
select results_eq($$select billing_status() ->> 'access', (billing_status() ->> 'trial_days_left')::int, (billing_status() ->> 'can_manage')::boolean$$,
  $$values ('trial'::text, 14, true)$$, 'dono vê o teste com 14 dias restantes');

-- A equipe não mexe na cobrança
select throws_ok($$update public.assistances set paid_until = now() + interval '1 year' where id = 'aaaaaaaa-0000-4000-8000-000000000000'$$,
  '42501', null, 'dono não consegue se dar meses pagos');
select throws_ok($$update public.assistances set trial_ends_at = now() + interval '1 year' where id = 'aaaaaaaa-0000-4000-8000-000000000000'$$,
  '42501', null, 'dono não consegue estender o teste');
select throws_ok($$select public.billing_apply_sync('x', 'aaaaaaaa-0000-4000-8000-000000000000', 'authorized', '[]')$$,
  '42501', null, 'equipe não executa a sincronização de pagamento');
select throws_ok($$select public.billing_register_checkout('aaaaaaaa-0000-4000-8000-000000000000', 'x', 'monthly', 49, 'a@b.com', null, null)$$,
  '42501', null, 'equipe não registra assinatura');
select throws_ok($$insert into public.billing_subscriptions (assistance_id, provider_id, cycle, amount, payer_email)
                   values ('aaaaaaaa-0000-4000-8000-000000000000', 'x', 'monthly', 49, 'a@b.com')$$,
  '42501', null, 'equipe não grava assinatura direto na tabela');

-- Outra assistência do mesmo dono não ganha teste novo
reset role;
update public.assistances set trial_ends_at = now() + interval '3 days' where id = 'aaaaaaaa-0000-4000-8000-000000000000';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a01","role":"authenticated"}', true);
set local role authenticated;
create temp table _nova on commit drop as select public.create_assistance('Filial A', 'filial-a-test') as id;
reset role;
select ok((select trial_ends_at < now() + interval '3 days 1 minute' from public.assistances where id = (select id from _nova)),
  'nova assistência do mesmo dono herda o fim do teste (não renova)');
update public.profiles set active_assistance_id = 'aaaaaaaa-0000-4000-8000-000000000000' where id = 'a0000000-0000-4000-8000-000000000a01';

-- ---------------------------------------------------------------------------
-- Teste vencido: não abre OS nem convida; o resto continua
-- ---------------------------------------------------------------------------
update public.assistances set trial_ends_at = now() - interval '1 day' where id = 'aaaaaaaa-0000-4000-8000-000000000000';
select is(private.billing_access('aaaaaaaa-0000-4000-8000-000000000000'), 'blocked', 'teste vencido sem pagamento: bloqueado');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.create_service_order('{"customer_id":"ac000000-0000-4000-8000-000000000001","equipment_id":"ae000000-0000-4000-8000-000000000001","reported_issue":"Não liga"}')$$,
  'P0001', null, 'bloqueado: técnico não abre OS nova');
select ok((select count(*) = 1 from public.customers where id = 'ac000000-0000-4000-8000-000000000001'), 'bloqueado: continua vendo os dados');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a01","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.create_invitation('novo@test.dev', 'technician')$$, 'P0001', null, 'bloqueado: não convida ninguém');
select is(billing_status() ->> 'access', 'blocked', 'tela mostra conta bloqueada');

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq($$select name from public.portal_assistance('tenant-a-test')$$, array['Tenant A'], 'bloqueado: portal dos clientes continua no ar');

-- ---------------------------------------------------------------------------
-- Assinatura anual pelo Mercado Pago (servidor = service_role)
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select ok(public.billing_register_checkout('aaaaaaaa-0000-4000-8000-000000000000', 'pre-1', 'yearly', 490, ' Dono@A.com ',
  'https://mp.test/checkout?pre=1', 'a0000000-0000-4000-8000-000000000a01') is not null, 'servidor registra a assinatura criada');
select is(public.billing_apply_sync('pre-1', 'aaaaaaaa-0000-4000-8000-000000000000', 'pending', '[]'), 'blocked',
  'assinatura ainda pendente não libera');
select throws_ok($$select public.billing_apply_sync('pre-1', 'bbbbbbbb-0000-4000-8000-000000000000', 'authorized', '[]')$$,
  'P0001', null, 'referência de outra assistência é recusada');
select throws_ok($$select public.billing_apply_sync('nao-existe', 'aaaaaaaa-0000-4000-8000-000000000000', 'authorized', '[]')$$,
  'P0001', null, 'assinatura desconhecida é recusada');
select is(public.billing_apply_sync('pre-1', 'aaaaaaaa-0000-4000-8000-000000000000', 'authorized',
  jsonb_build_array(jsonb_build_object('id', 'inv-1', 'payment_id', 'pay-1', 'amount', 490, 'status', 'approved', 'paid_at', now()))),
  'active', 'pagamento aprovado libera a conta');
select is(public.billing_apply_sync('pre-1', 'aaaaaaaa-0000-4000-8000-000000000000', 'authorized',
  jsonb_build_array(jsonb_build_object('id', 'inv-1', 'payment_id', 'pay-1', 'amount', 490, 'status', 'approved', 'paid_at', now()))),
  'active', 'sincronizar de novo não muda nada (idempotente)');
reset role;
select results_eq($$select subscription_status, plan, billing_cycle, paid_until > now() + interval '364 days', mp_preapproval_id
                   from public.assistances where id = 'aaaaaaaa-0000-4000-8000-000000000000'$$,
  $$values ('active'::text, 'paid'::text, 'yearly'::text, true, 'pre-1'::text)$$, 'conta ativa, plano anual, pago por 1 ano');
select is((select count(*)::int from public.billing_payments where subscription_id = (select id from public.billing_subscriptions where provider_id = 'pre-1')),
  1, 'pagamento registrado uma vez só');
select is((select payer_email from public.billing_subscriptions where provider_id = 'pre-1'), 'dono@a.com', 'e-mail do pagador normalizado');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select * from public.create_service_order('{"customer_id":"ac000000-0000-4000-8000-000000000001","equipment_id":"ae000000-0000-4000-8000-000000000001","reported_issue":"Não liga"}')$$,
  'conta paga: técnico volta a abrir OS');
select is((select count(*)::int from public.billing_payments), 0, 'técnico não vê os pagamentos da assinatura');
select is(billing_status() ->> 'access', 'active', 'técnico vê que a conta está liberada');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000a01","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.billing_payments), 1, 'dono vê o histórico de pagamentos');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000b01","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.billing_payments) + (select count(*)::int from public.billing_subscriptions), 0,
  'outra assistência não vê nada da cobrança de A');

-- Uma tentativa antiga abandonada que o Mercado Pago cancela não derruba a assinatura vigente
reset role;
set local role service_role;
select public.billing_register_checkout('aaaaaaaa-0000-4000-8000-000000000000', 'pre-old', 'monthly', 49, 'dono@a.com', null, null);
select is(public.billing_apply_sync('pre-old', 'aaaaaaaa-0000-4000-8000-000000000000', 'cancelled', '[]'), 'active',
  'cancelamento de tentativa antiga não afeta a conta');

-- Cancelar a vigente: continua liberado até o fim do período pago
select is(public.billing_apply_sync('pre-1', 'aaaaaaaa-0000-4000-8000-000000000000', 'cancelled',
  jsonb_build_array(jsonb_build_object('id', 'inv-1', 'payment_id', 'pay-1', 'amount', 490, 'status', 'approved', 'paid_at', now()))),
  'active', 'cancelada: usa até o fim do período já pago');
reset role;
select is((select subscription_status from public.assistances where id = 'aaaaaaaa-0000-4000-8000-000000000000'), 'canceled', 'status fica cancelado');
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq($$select name from public.portal_assistance('tenant-a-test')$$, array['Tenant A'], 'cancelada: portal dos clientes continua no ar');

-- ---------------------------------------------------------------------------
-- Mensal atrasado: 7 dias de tolerância, depois bloqueia
-- ---------------------------------------------------------------------------
reset role;
update public.assistances set trial_ends_at = now() - interval '1 day' where id = 'bbbbbbbb-0000-4000-8000-000000000000';
set local role service_role;
select public.billing_register_checkout('bbbbbbbb-0000-4000-8000-000000000000', 'pre-b', 'monthly', 49, 'dono@b.com', null, null);
select is(public.billing_apply_sync('pre-b', 'bbbbbbbb-0000-4000-8000-000000000000', 'authorized',
  jsonb_build_array(jsonb_build_object('id', 'inv-b1', 'amount', 49, 'status', 'approved', 'paid_at', now() - interval '1 month 3 days'))),
  'grace', 'mensalidade vencida há 3 dias: tolerância');
reset role;
select results_eq($$select subscription_status, past_due_since is not null from public.assistances where id = 'bbbbbbbb-0000-4000-8000-000000000000'$$,
  $$values ('past_due'::text, true)$$, 'status em atraso, com data do atraso');
-- o tempo passa: 10 dias depois do vencimento
update public.assistances set paid_until = now() - interval '10 days' where id = 'bbbbbbbb-0000-4000-8000-000000000000';
select is(private.billing_access('bbbbbbbb-0000-4000-8000-000000000000'), 'blocked', 'passou da tolerância: bloqueia');
set local role service_role;
select is(public.billing_apply_sync('pre-b', 'bbbbbbbb-0000-4000-8000-000000000000', 'authorized',
  jsonb_build_array(
    jsonb_build_object('id', 'inv-b1', 'amount', 49, 'status', 'approved', 'paid_at', now() - interval '1 month 10 days'),
    jsonb_build_object('id', 'inv-b2', 'amount', 49, 'status', 'approved', 'paid_at', now()))),
  'active', 'pagou a mensalidade atrasada: libera');
reset role;
select results_eq($$select subscription_status, past_due_since is null from public.assistances where id = 'bbbbbbbb-0000-4000-8000-000000000000'$$,
  $$values ('active'::text, true)$$, 'volta para ativa e limpa o atraso');

-- ---------------------------------------------------------------------------
-- Assinou durante o teste: não perde dias; 1ª cobrança no fim do teste
-- ---------------------------------------------------------------------------
reset role;
insert into public.assistances (id, name, slug) values ('cccccccc-0000-4000-8000-000000000000', 'Tenant C', 'tenant-c-test');
set local role service_role;
select public.billing_register_checkout('cccccccc-0000-4000-8000-000000000000', 'pre-c', 'monthly', 49, 'dono@c.com', null, null);
select is(public.billing_apply_sync('pre-c', 'cccccccc-0000-4000-8000-000000000000', 'authorized', '[]'), 'trial',
  'assinou no teste: continua no teste até a 1ª cobrança');
reset role;
select results_eq($$select subscription_status, mp_preapproval_id from public.assistances where id = 'cccccccc-0000-4000-8000-000000000000'$$,
  $$values ('trialing'::text, 'pre-c'::text)$$, 'assinatura vinculada, status ainda de teste');
update public.assistances set trial_ends_at = now() - interval '2 days' where id = 'cccccccc-0000-4000-8000-000000000000';
select is(private.billing_access('cccccccc-0000-4000-8000-000000000000'), 'grace', 'teste acabou e a 1ª cobrança ainda não foi confirmada: tolerância');
update public.assistances set trial_ends_at = now() - interval '8 days' where id = 'cccccccc-0000-4000-8000-000000000000';
select is(private.billing_access('cccccccc-0000-4000-8000-000000000000'), 'blocked', 'passou a tolerância sem cobrança: bloqueia');
set local role service_role;
select is(public.billing_apply_sync('pre-c', 'cccccccc-0000-4000-8000-000000000000', 'authorized',
  jsonb_build_array(jsonb_build_object('id', 'inv-c1', 'amount', 49, 'status', 'approved', 'paid_at', now()))),
  'active', '1ª cobrança aprovada: ativa');

reset role;
select * from finish();
rollback;
