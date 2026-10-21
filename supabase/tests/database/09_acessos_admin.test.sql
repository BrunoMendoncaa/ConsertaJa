-- Acessos da área admin: só o servidor (service_role) lê e grava; regras básicas da tabela.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select * from no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-4000-8000-000000000d01', 'owner.d@test.dev', '{"full_name":"Owner D"}');

-- Equipe logada e visitante: nada
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000d01","role":"authenticated"}', true);
select throws_ok($$select * from public.admin_accounts$$, '42501', null, 'equipe não lê os acessos admin');
select throws_ok($$insert into public.admin_accounts (username, full_name, password_hash, created_by)
                   values ('invasor', 'Invasor', 'scrypt:x', 'x')$$, '42501', null, 'equipe não cria acesso admin');
select throws_ok($$update public.admin_accounts set permissions = '{site_ver}'$$, '42501', null, 'equipe não altera acesso admin');

reset role;
set local role anon;
select throws_ok($$select * from public.admin_accounts$$, '42501', null, 'visitante não lê os acessos admin');

-- Servidor: cria, lê, altera e remove
reset role;
set local role service_role;

select lives_ok($$insert into public.admin_accounts (username, full_name, password_hash, permissions, created_by)
                  values ('maria.suporte', 'Maria', 'scrypt:32768:8:1:abc:def', '{assistencias_ver,site_ver}', 'bruno')$$,
  'servidor cria acesso com permissões');
select is((select must_change_password from public.admin_accounts where username = 'maria.suporte'), true,
  'acesso novo precisa trocar a senha no primeiro login');
select is((select session_version from public.admin_accounts where username = 'maria.suporte'), 1, 'versão de sessão começa em 1');

select throws_ok($$insert into public.admin_accounts (username, full_name, password_hash, created_by)
                   values ('maria.suporte', 'Outra', 'scrypt:x', 'bruno')$$, '23505', null, 'usuário não se repete');
select throws_ok($$insert into public.admin_accounts (username, full_name, password_hash, created_by)
                   values ('Maria Maiúscula', 'Outra', 'scrypt:x', 'bruno')$$, '23514', null, 'usuário só com minúsculas, números, ponto, hífen e _');
select throws_ok($$insert into public.admin_accounts (username, full_name, password_hash, created_by)
                   values ('sem.hash', 'Sem Hash', 'senha-em-texto', 'bruno')$$, '23514', null, 'senha só como hash scrypt');
select throws_ok($$insert into public.admin_accounts (username, full_name, password_hash, permissions, created_by)
                   values ('com.nulo', 'Nulo', 'scrypt:x', array['site_ver', null], 'bruno')$$, '23514', null, 'permissão nula recusada');

select lives_ok($$update public.admin_accounts set permissions = '{site_ver}', session_version = session_version + 1
                  where username = 'maria.suporte'$$, 'servidor altera permissões');
select ok((select updated_at >= created_at from public.admin_accounts where username = 'maria.suporte'), 'updated_at atualizado');
select lives_ok($$delete from public.admin_accounts where username = 'maria.suporte'$$, 'servidor remove acesso');

select * from finish();
rollback;
