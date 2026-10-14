-- Área administrativa: só a service_role lê e executa; a equipe das assistências não.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select * from no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('c0000000-0000-4000-8000-000000000c01', 'owner.c@test.dev', '{"full_name":"Owner C"}'),
  ('c0000000-0000-4000-8000-000000000c02', 'sem.loja@test.dev', '{"full_name":"Sem Loja"}');
insert into public.assistances (id, name, slug) values ('cccccccc-0000-4000-8000-000000000000', 'Tenant C', 'tenant-c-admin');
insert into public.assistance_members (assistance_id, user_id, role) values
  ('cccccccc-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000c01', 'owner');
update public.profiles set active_assistance_id = 'cccccccc-0000-4000-8000-000000000000'
 where id = 'c0000000-0000-4000-8000-000000000c01';

-- ---------------------------------------------------------------------------
-- Equipe logada (authenticated) e visitante (anon): nada
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000c01","role":"authenticated"}', true);

select throws_ok($$select * from public.admin_assistances()$$, '42501', null, 'equipe não executa admin_assistances');
select throws_ok($$select * from public.admin_users()$$, '42501', null, 'equipe não executa admin_users');
select throws_ok($$select * from public.admin_assistance_members('cccccccc-0000-4000-8000-000000000000')$$, '42501', null,
  'equipe não executa admin_assistance_members');
select throws_ok($$select * from public.admin_audit_log$$, '42501', null, 'equipe não lê o registro de ações admin');
select throws_ok($$insert into public.admin_audit_log (admin_username, action) values ('x', 'y')$$, '42501', null,
  'equipe não grava no registro de ações admin');
select throws_ok($$select * from public.admin_login_attempts$$, '42501', null, 'equipe não lê tentativas de login admin');

reset role;
set local role anon;
select throws_ok($$select * from public.admin_assistances()$$, '42501', null, 'visitante não executa admin_assistances');
select throws_ok($$select * from public.admin_login_attempts$$, '42501', null, 'visitante não lê tentativas de login admin');

-- ---------------------------------------------------------------------------
-- Servidor (service_role): lê tudo
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;

select is((select owner_email from public.admin_assistances() where slug = 'tenant-c-admin'), 'owner.c@test.dev',
  'admin_assistances traz o e-mail do dono');
select is((select access from public.admin_assistances() where slug = 'tenant-c-admin'), 'trial',
  'admin_assistances traz a situação calculada (teste)');
select is((select members from public.admin_assistances() where slug = 'tenant-c-admin'), 1, 'conta os membros');
select is((select jsonb_array_length(memberships) from public.admin_users() where email = 'sem.loja@test.dev'), 0,
  'admin_users mostra quem ainda não tem assistência');
select is((select role from public.admin_assistance_members('cccccccc-0000-4000-8000-000000000000')), 'owner',
  'admin_assistance_members lista a equipe');
select lives_ok($$insert into public.admin_audit_log (admin_username, action, assistance_id)
                  values ('admin', 'extend_trial', 'cccccccc-0000-4000-8000-000000000000')$$,
  'servidor grava no registro de ações');
select lives_ok($$insert into public.admin_login_attempts (username, ip, success) values ('admin', '10.0.0.1', false)$$,
  'servidor grava tentativa de login');

reset role;
select * from finish();
rollback;
