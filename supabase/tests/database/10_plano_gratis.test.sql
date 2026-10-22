-- Plano Grátis: 30 OS por mês (mês de Brasília), sem convites; Pro (teste/pago) sem limite;
-- suspensa bloqueada; portal informa o plano.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select * from no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('f0000000-0000-4000-8000-000000000f01', 'owner.f@test.dev', '{"full_name":"Owner F"}'),
  ('f0000000-0000-4000-8000-000000000f02', 'tech.f@test.dev',  '{"full_name":"Tech F"}');
insert into public.assistances (id, name, slug) values ('ffffffff-0000-4000-8000-000000000000', 'Tenant F', 'tenant-f-gratis');
insert into public.assistance_members (assistance_id, user_id, role) values
  ('ffffffff-0000-4000-8000-000000000000', 'f0000000-0000-4000-8000-000000000f01', 'owner'),
  ('ffffffff-0000-4000-8000-000000000000', 'f0000000-0000-4000-8000-000000000f02', 'technician');
update public.profiles set active_assistance_id = 'ffffffff-0000-4000-8000-000000000000'
 where id in ('f0000000-0000-4000-8000-000000000f01', 'f0000000-0000-4000-8000-000000000f02');
insert into public.customers (id, assistance_id, name, phone) values
  ('fc000000-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000000', 'Cliente F', '(11) 95555-1111');
insert into public.equipment (id, assistance_id, customer_id, category_id, brand, model) values
  ('fe000000-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000000', 'fc000000-0000-4000-8000-000000000001',
   (select id from public.equipment_categories where assistance_id is null and name = 'Celular'), 'Samsung', 'A54');

create function pg_temp.abrir_os(n int) returns void language plpgsql as $$
begin
  for i in 1..n loop
    perform public.create_service_order('{"customer_id":"fc000000-0000-4000-8000-000000000001","equipment_id":"fe000000-0000-4000-8000-000000000001","reported_issue":"Tela"}');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conta nova: Pro liberado no teste, sem limite de OS
-- ---------------------------------------------------------------------------
select is(private.billing_plan('ffffffff-0000-4000-8000-000000000000'), 'pro', 'conta nova começa no Pro (teste de 14 dias)');
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000f02","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select pg_temp.abrir_os(32)$$, 'no teste (Pro) abre mais de 30 OS no mês');
select is((billing_status() ->> 'os_month')::int, 32, 'contador de OS do mês');
select is(billing_status() ->> 'plan', 'pro', 'tela mostra plano Pro durante o teste');

-- ---------------------------------------------------------------------------
-- Grátis: limite de 30 OS no mês
-- ---------------------------------------------------------------------------
reset role;
update public.assistances set trial_ends_at = now() - interval '1 day' where id = 'ffffffff-0000-4000-8000-000000000000';
select is(private.billing_plan('ffffffff-0000-4000-8000-000000000000'), 'free', 'teste acabou sem assinar: plano Grátis');
-- Joga as 32 OS do teste para o mês passado (não contam no mês atual)
update public.service_orders set created_at = private.month_start_br() - interval '2 days'
 where assistance_id = 'ffffffff-0000-4000-8000-000000000000';

select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000f02","role":"authenticated"}', true);
set local role authenticated;
select is((billing_status() ->> 'os_month')::int, 0, 'OS do mês passado não contam');
select lives_ok($$select pg_temp.abrir_os(30)$$, 'Grátis: abre 30 OS no mês');
select throws_ok($$select pg_temp.abrir_os(1)$$, 'P0001',
  'Você usou as 30 OS do plano Grátis deste mês. Assine o Pro em "Meu plano" para abrir OS sem limite, ou aguarde o dia 1º.',
  'Grátis: a 31ª OS do mês é recusada com a explicação');
select results_eq($$select billing_status() ->> 'plan', (billing_status() ->> 'os_month')::int, (billing_status() ->> 'os_limit')::int,
                          (billing_status() ->> 'month_resets_at')::timestamptz > now()$$,
  $$values ('free'::text, 30, 30, true)$$, 'tela mostra 30 de 30 e quando o mês vira');
select ok((select count(*) = 62 from public.service_orders where assistance_id = 'ffffffff-0000-4000-8000-000000000000'),
  'Grátis: continua vendo todas as OS');

-- O que já existe continua andando (mudar status de uma OS do limite estourado)
select lives_ok($$update public.service_orders set diagnosis = 'Display trincado'
                  where id = (select id from public.service_orders where assistance_id = 'ffffffff-0000-4000-8000-000000000000' limit 1)$$,
  'Grátis no limite: continua editando OS existentes');

select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000f01","role":"authenticated"}', true);
select throws_ok($$select public.create_invitation('novo.f@test.dev', 'technician')$$, 'P0001', null, 'Grátis: não convida');

-- Servidor (sem usuário logado) não passa pelo limite
reset role;
select set_config('request.jwt.claims', '', true);
select lives_ok($$insert into public.service_orders (assistance_id, customer_id, equipment_id, reported_issue)
                  values ('ffffffff-0000-4000-8000-000000000000', 'fc000000-0000-4000-8000-000000000001',
                          'fe000000-0000-4000-8000-000000000001', 'Rotina do servidor')$$,
  'servidor não é limitado');

-- Portal informa o plano (rodapé e documento de garantia)
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select plan from public.portal_assistance('tenant-f-gratis')), 'free', 'portal: plano Grátis');

-- ---------------------------------------------------------------------------
-- Assinou: Pro de novo, sem limite
-- ---------------------------------------------------------------------------
reset role;
update public.assistances set paid_until = now() + interval '1 month', subscription_status = 'active'
 where id = 'ffffffff-0000-4000-8000-000000000000';
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000f02","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select pg_temp.abrir_os(1)$$, 'assinou o Pro: volta a abrir OS no mesmo mês');
select is(billing_status() ->> 'plan', 'pro', 'tela mostra Pro');
reset role;
set local role anon;
select is((select plan from public.portal_assistance('tenant-f-gratis')), 'pro', 'portal: plano Pro');

-- ---------------------------------------------------------------------------
-- Suspensa pela área admin: bloqueada
-- ---------------------------------------------------------------------------
reset role;
update public.assistances set subscription_status = 'suspended' where id = 'ffffffff-0000-4000-8000-000000000000';
select is(private.billing_access('ffffffff-0000-4000-8000-000000000000'), 'blocked', 'suspensa: bloqueada');
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000f02","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select pg_temp.abrir_os(1)$$, 'P0001', 'Esta assistência está suspensa. Fale com o suporte do TecnoFix.',
  'suspensa: não abre OS');

-- Funções internas não ficam expostas para visitantes
reset role;
set local role anon;
select throws_ok($$select private.os_this_month('ffffffff-0000-4000-8000-000000000000')$$, '42501', null,
  'visitante não executa funções internas');

select * from finish();
rollback;
