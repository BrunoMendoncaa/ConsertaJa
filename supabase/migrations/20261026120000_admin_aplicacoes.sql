-- =============================================================================
-- TecnoFix · 0020 · Área admin como central de aplicações
--
-- A área admin passa a reunir mais de uma aplicação (hoje só o TecnoFix). Cada
-- acesso criado pela master diz em quais aplicações a pessoa entra (apps) e, dentro
-- delas, o que pode ver e fazer (permissions, como antes).
-- A lista de aplicações fica no código (src/features/admin/apps.js).
-- Quem já tinha acesso continua no TecnoFix.
-- =============================================================================

alter table public.admin_accounts
  add column if not exists apps text[] not null default '{}';

alter table public.admin_accounts
  add constraint admin_accounts_apps_check
  check (cardinality(apps) <= 20
         and array_position(apps, null) is null
         and array_to_string(apps, ',') ~ '^([a-z0-9-]{2,30}(,[a-z0-9-]{2,30})*)?$');

-- Acessos criados antes da central: eram todos do TecnoFix.
update public.admin_accounts set apps = '{tecnofix}' where apps = '{}';
