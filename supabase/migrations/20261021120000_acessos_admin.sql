-- =============================================================================
-- TecnoFix · 0017 · Acessos da área admin (contas com permissões)
--
-- A conta MASTER continua sendo a das variáveis da Vercel (ADMIN_USERNAME e
-- ADMIN_PASSWORD_HASH): não fica no banco e não pode ser bloqueada por aqui.
-- Só ela cria, edita e remove os outros acessos desta tabela, marcando o que
-- cada um pode ver e fazer (lista de permissões em src/features/admin/permissions.js).
--
-- A senha fica só como hash scrypt. As permissões são lidas a cada pedido, então
-- uma mudança vale na hora; desativar a conta ou trocar a senha derruba as
-- sessões abertas (session_version).
-- Só o servidor (service_role) lê e grava; a equipe das assistências não enxerga.
-- =============================================================================

create table public.admin_accounts (
  id                   uuid primary key default gen_random_uuid(),
  username             text not null unique check (username ~ '^[a-z0-9._-]{3,40}$'),
  full_name            text not null check (char_length(full_name) between 2 and 80),
  password_hash        text not null check (password_hash like 'scrypt:%' and char_length(password_hash) <= 300),
  permissions          text[] not null default '{}'
                         check (cardinality(permissions) <= 50
                                and array_position(permissions, null) is null),
  active               boolean not null default true,
  must_change_password boolean not null default true,
  session_version      integer not null default 1 check (session_version >= 1),
  created_by           text not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  last_login_at        timestamptz,
  password_changed_at  timestamptz not null default now()
);

create trigger admin_accounts_updated_at
  before update on public.admin_accounts
  for each row execute function private.set_updated_at();

alter table public.admin_accounts enable row level security;
-- Sem policies: só a service_role (que ignora o RLS) acessa.
revoke all on public.admin_accounts from public, anon, authenticated;
grant select, insert, update, delete on public.admin_accounts to service_role;
