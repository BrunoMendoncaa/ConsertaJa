-- Central de aplicações: cada acesso admin diz em quais aplicações entra (apps).
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select * from no_plan();

select has_column('public', 'admin_accounts', 'apps', 'acessos têm a lista de aplicações');
select col_default_is('public', 'admin_accounts', 'apps', '{}'::text[], 'acesso novo começa sem aplicação');

insert into public.admin_accounts (username, full_name, password_hash, permissions, created_by)
values ('sem.app', 'Sem App', 'scrypt:x', '{site_ver}', 'bruno');
select is((select apps from public.admin_accounts where username = 'sem.app'), '{}'::text[], 'sem marcar, nenhuma aplicação');

select lives_ok($$insert into public.admin_accounts (username, full_name, password_hash, apps, created_by)
                  values ('com.app', 'Com App', 'scrypt:x', '{tecnofix}', 'bruno')$$, 'aceita aplicação válida');
select throws_ok($$insert into public.admin_accounts (username, full_name, password_hash, apps, created_by)
                   values ('app.ruim', 'App Ruim', 'scrypt:x', '{"Tecno Fix"}', 'bruno')$$, '23514', null, 'recusa nome de aplicação fora do padrão');
select throws_ok($$insert into public.admin_accounts (username, full_name, password_hash, apps, created_by)
                   values ('app.nula', 'App Nula', 'scrypt:x', array[null]::text[], 'bruno')$$, '23514', null, 'recusa aplicação nula');

-- Continua só para o servidor
select ok(not has_table_privilege('authenticated', 'public.admin_accounts', 'select')
      and not has_table_privilege('anon', 'public.admin_accounts', 'select'),
  'equipe e visitantes não leem os acessos');

select * from finish();
rollback;
