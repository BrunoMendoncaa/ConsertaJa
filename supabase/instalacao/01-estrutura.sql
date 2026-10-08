-- =============================================================================
-- Conserta Já · Instalação do banco (1 de 2): estrutura
-- GERADO AUTOMATICAMENTE por scripts/gerar-sql-instalacao.mjs — não edite à mão.
--
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Roda tudo numa transação: ou instala completo, ou não altera nada.
-- Também registra as migrations no histórico, então um "supabase db push"
-- futuro sabe que elas já foram aplicadas.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.assistances') is not null then
    raise exception 'O banco já foi preparado antes (a tabela public.assistances já existe). Nada foi alterado.';
  end if;
end;
$$;

-- >>> 20261008120000_base.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Conserta Já · 0001 · Base
-- Extensões, schema privado e funções utilitárias usadas por todas as tabelas.
-- =============================================================================

-- No Supabase as extensões ficam no schema "extensions".
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- Schema privado: funções auxiliares que NÃO são expostas pela API REST.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Nenhuma função nova do schema private é executável por padrão.
alter default privileges in schema private revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Telefone brasileiro → E.164 (+55DDDNUMERO). Retorna null se inválido.
-- Aceita: (11) 98765-4321 · 11987654321 · +55 11 98765-4321 · 011 98765-4321
-- -----------------------------------------------------------------------------
create or replace function private.normalize_br_phone(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text;
begin
  if p is null then
    return null;
  end if;

  d := regexp_replace(p, '\D', '', 'g');

  -- Já veio com DDI 55 (12 ou 13 dígitos)
  if left(d, 2) = '55' and length(d) in (12, 13) then
    d := substr(d, 3);
  end if;

  -- Zero de longa distância: 0 + DDD + número
  if left(d, 1) = '0' and length(d) in (11, 12) then
    d := substr(d, 2);
  end if;

  if length(d) not in (10, 11) or left(d, 1) = '0' then
    return null;
  end if;

  return '+55' || d;
end;
$$;

-- -----------------------------------------------------------------------------
-- Código de acesso da OS: 6 caracteres, alfabeto de 31 símbolos sem ambíguos
-- (sem I, L, O, 0, 1) → 31^6 ≈ 887 milhões de combinações.
-- -----------------------------------------------------------------------------
create or replace function private.generate_access_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(6);
  result text := '';
begin
  for i in 0..5 loop
    result := result || substr(alphabet, (get_byte(b, i) % 31) + 1, 1);
  end loop;
  return result;
end;
$$;

-- Token aleatório (hex) e seu hash — usados em convites e sessões do portal.
create or replace function private.random_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

create or replace function private.hash_token(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(coalesce(p_token, ''), 'UTF8'));
$$;

-- Data de hoje no fuso de São Paulo (validade de orçamento, numeração por ano).
create or replace function private.today_br()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Limpa o contexto de auditoria/histórico usado pelos triggers (fim de cada RPC).
create or replace function private.reset_context()
returns void
language sql
set search_path = ''
as $$
  select set_config('app.audit_action', '', true),
         set_config('app.status_note', '', true),
         set_config('app.status_via', '', true),
         set_config('app.status_visible', '', true);
$$;

grant execute on function private.normalize_br_phone(text) to authenticated, service_role;
grant execute on function private.reset_context()          to authenticated, service_role;
grant execute on function private.generate_access_code()  to authenticated, service_role;
grant execute on function private.today_br()              to authenticated, service_role;

-- >>> 20261008120100_tenancy.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Conserta Já · 0002 · Tenancy, usuários e auditoria
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table public.assistances (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null,
  legal_name       text,
  document         text,
  phone            text,
  whatsapp         text,
  email            text,
  address          jsonb not null default '{}'::jsonb,   -- cep, rua, numero, complemento, bairro, cidade, uf
  logo_path        text,
  brand_color      text,
  business_hours   text,
  welcome_message  text,
  warranty_policy  text,
  entry_terms      text,
  default_budget_validity_days int not null default 10,
  default_warranty_days        int not null default 90,
  default_payment_terms        text,
  diagnosis_fee    numeric(12,2) not null default 0,
  settings         jsonb not null default '{"portal_show_photos": true}'::jsonb,
  plan             text not null default 'trial',
  subscription_status text not null default 'trialing',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint assistances_slug_unique unique (slug),
  constraint assistances_name_check check (length(trim(name)) between 2 and 120),
  constraint assistances_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 50),
  constraint assistances_document_format check (document is null or document ~ '^([0-9]{11}|[0-9]{14})$'),
  constraint assistances_brand_color_format check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint assistances_validity_range check (default_budget_validity_days between 1 and 90),
  constraint assistances_warranty_range check (default_warranty_days between 0 and 3650),
  constraint assistances_fee_positive check (diagnosis_fee >= 0),
  constraint assistances_subscription_status_check
    check (subscription_status in ('trialing','active','past_due','suspended','canceled'))
);

create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text not null default '',
  phone                text,
  active_assistance_id uuid references public.assistances(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.assistance_members (
  assistance_id uuid not null references public.assistances(id) on delete cascade,
  user_id       uuid not null,
  role          text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint assistance_members_pkey primary key (assistance_id, user_id),
  constraint assistance_members_user_fk foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint assistance_members_role_check check (role in ('owner','admin','technician','attendant'))
);
create index assistance_members_user_idx on public.assistance_members (user_id);

create table public.assistance_invitations (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid not null references public.assistances(id) on delete cascade,
  email         text not null,
  role          text not null,
  token_hash    bytea not null,
  invited_by    uuid not null references public.profiles(id),
  expires_at    timestamptz not null default now() + interval '7 days',
  accepted_at   timestamptz,
  accepted_by   uuid references public.profiles(id),
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  constraint assistance_invitations_token_unique unique (token_hash),
  constraint assistance_invitations_role_check check (role in ('admin','technician','attendant')),
  constraint assistance_invitations_email_check check (email = lower(email) and position('@' in email) > 1)
);
create unique index assistance_invitations_pending_unique
  on public.assistance_invitations (assistance_id, email)
  where accepted_at is null and revoked_at is null;

create table public.assistance_counters (
  assistance_id uuid not null references public.assistances(id) on delete cascade,
  key           text not null,
  last_value    bigint not null default 0,
  constraint assistance_counters_pkey primary key (assistance_id, key)
);

create table public.audit_logs (
  id            bigint generated always as identity primary key,
  assistance_id uuid not null references public.assistances(id) on delete cascade,
  table_name    text not null,
  record_id     uuid,
  action        text not null,
  actor_user_id uuid,
  actor_portal_session_id uuid,
  changes       jsonb,
  created_at    timestamptz not null default now()
);
create index audit_logs_lookup_idx on public.audit_logs (assistance_id, table_name, record_id, created_at desc);
create index audit_logs_recent_idx on public.audit_logs (assistance_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Funções de contexto (usadas pelas policies)
-- -----------------------------------------------------------------------------

-- Assistência ativa do usuário logado — só se o vínculo estiver ativo.
create or replace function private.current_assistance_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.assistance_id
  from public.profiles p
  join public.assistance_members m
    on m.assistance_id = p.active_assistance_id
   and m.user_id = p.id
   and m.active
  where p.id = (select auth.uid());
$$;

-- Papel do usuário na assistência ativa.
create or replace function private.current_member_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.profiles p
  join public.assistance_members m
    on m.assistance_id = p.active_assistance_id
   and m.user_id = p.id
   and m.active
  where p.id = (select auth.uid());
$$;

create or replace function private.has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_member_role() = any (roles), false);
$$;

-- Lança erro se o usuário não tiver um dos papéis.
create or replace function private.require_role(roles text[])
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.current_assistance_id();
begin
  if v_assistance is null then
    raise exception 'Nenhuma assistência ativa. Entre novamente.' using errcode = '42501';
  end if;
  if not private.has_role(roles) then
    raise exception 'Você não tem permissão para esta ação.' using errcode = '42501';
  end if;
  return v_assistance;
end;
$$;

grant execute on function private.current_assistance_id() to authenticated, service_role;
grant execute on function private.current_member_role()   to authenticated, service_role;
grant execute on function private.has_role(text[])         to authenticated, service_role;
grant execute on function private.require_role(text[])     to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Trigger genérico de tenant: ignora o assistance_id enviado pelo cliente da API
-- e impede que um registro mude de assistência.
-- -----------------------------------------------------------------------------
create or replace function private.enforce_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Chamada direta pela API (papel authenticated): o tenant vem do banco.
    if current_user = 'authenticated' then
      new.assistance_id := private.current_assistance_id();
    elsif new.assistance_id is null and auth.uid() is not null then
      -- Funções do sistema chamadas por um usuário logado
      new.assistance_id := private.current_assistance_id();
    end if;

    if new.assistance_id is null then
      raise exception 'Nenhuma assistência ativa.' using errcode = '42501';
    end if;
  elsif new.assistance_id is distinct from old.assistance_id then
    raise exception 'Um registro não pode mudar de assistência.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Auditoria genérica (só inserção; ninguém altera ou apaga)
-- Um evento semântico pode ser informado com set_config('app.audit_action', ...).
-- -----------------------------------------------------------------------------
create or replace function private.audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb := '{}'::jsonb;
  k text;
  v_action text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if k <> 'updated_at' and (v_new -> k) is distinct from (v_old -> k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_array(v_old -> k, v_new -> k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    v_changes := v_new;
  else
    v_changes := v_old;
  end if;

  -- Campos que não devem ficar na trilha
  v_changes := v_changes - 'snapshot' - 'token_hash';

  v_action := coalesce(nullif(current_setting('app.audit_action', true), ''), tg_op);

  -- Anonimização (LGPD): registra só quais campos mudaram, sem os valores.
  if v_action = 'CUSTOMER_ANONYMIZED' then
    v_changes := jsonb_build_object('fields', (select jsonb_agg(x) from jsonb_object_keys(v_changes) as x));
  end if;

  insert into public.audit_logs
    (assistance_id, table_name, record_id, action, actor_user_id, actor_portal_session_id, changes)
  values (
    coalesce(v_new ->> 'assistance_id', v_old ->> 'assistance_id',
             case when tg_table_name = 'assistances' then coalesce(v_new ->> 'id', v_old ->> 'id') end)::uuid,
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'user_id', v_old ->> 'user_id')::uuid,
    v_action,
    auth.uid(),
    nullif(current_setting('app.portal_session_id', true), '')::uuid,
    v_changes
  );

  return coalesce(new, old);
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfil criado automaticamente para cada usuário do Auth
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Garante o perfil de um usuário do Auth. Cobre contas criadas antes de o banco
-- ser preparado (quando o trigger acima ainda não existia).
create or replace function private.ensure_profile(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.profiles (id, full_name)
  select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', '')
  from auth.users u
  where u.id = p_user_id
  on conflict (id) do nothing;
$$;

-- Contas que já existiam no Auth antes desta migration ganham o perfil agora.
insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Proteções de vínculo: sempre há um owner ativo; só owner mexe em owner;
-- ninguém altera o próprio acesso pela API.
-- -----------------------------------------------------------------------------
create or replace function private.guard_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if old.user_id = auth.uid() then
      raise exception 'Você não pode alterar o seu próprio acesso.' using errcode = 'P0001';
    end if;
    if (old.role = 'owner' or new.role = 'owner') and not private.has_role(array['owner']) then
      raise exception 'Só o proprietário pode alterar outro proprietário.' using errcode = '42501';
    end if;
  end if;

  if old.role = 'owner' and old.active and (new.role <> 'owner' or not new.active) then
    if not exists (
      select 1 from public.assistance_members m
      where m.assistance_id = old.assistance_id
        and m.role = 'owner' and m.active and m.user_id <> old.user_id
    ) then
      raise exception 'A assistência precisa de pelo menos um proprietário ativo.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.assistances
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.assistance_members
  for each row execute function private.set_updated_at();

create trigger a_guard_members before update on public.assistance_members
  for each row execute function private.guard_members();

create trigger a_enforce_tenant before insert or update on public.assistance_invitations
  for each row execute function private.enforce_tenant();

create trigger z_audit after insert or update on public.assistances
  for each row execute function private.audit();
create trigger z_audit after insert or update on public.assistance_members
  for each row execute function private.audit();
create trigger z_audit after insert or update on public.assistance_invitations
  for each row execute function private.audit();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.assistances            enable row level security;
alter table public.profiles               enable row level security;
alter table public.assistance_members     enable row level security;
alter table public.assistance_invitations enable row level security;
alter table public.assistance_counters    enable row level security;
alter table public.audit_logs             enable row level security;

-- assistances: só a assistência ativa; edição por owner/admin
create policy assistances_select on public.assistances
  for select to authenticated
  using (id = (select private.current_assistance_id()));

create policy assistances_update on public.assistances
  for update to authenticated
  using (id = (select private.current_assistance_id()) and (select private.has_role(array['owner','admin'])))
  with check (id = (select private.current_assistance_id()));

-- profiles: o próprio e os colegas da assistência ativa
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.assistance_members m
      where m.user_id = profiles.id
        and m.assistance_id = (select private.current_assistance_id())
    )
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- assistance_members
create policy members_select on public.assistance_members
  for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));

create policy members_update on public.assistance_members
  for update to authenticated
  using (assistance_id = (select private.current_assistance_id()) and (select private.has_role(array['owner','admin'])))
  with check (assistance_id = (select private.current_assistance_id()));

-- assistance_invitations
create policy invitations_select on public.assistance_invitations
  for select to authenticated
  using (assistance_id = (select private.current_assistance_id()) and (select private.has_role(array['owner','admin'])));

create policy invitations_update on public.assistance_invitations
  for update to authenticated
  using (assistance_id = (select private.current_assistance_id()) and (select private.has_role(array['owner','admin'])))
  with check (assistance_id = (select private.current_assistance_id()));

-- assistance_counters: nenhum acesso direto (só funções)

-- audit_logs: leitura por owner/admin
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (assistance_id = (select private.current_assistance_id()) and (select private.has_role(array['owner','admin'])));

-- Privilégios de coluna: o que a API pode alterar diretamente
revoke insert, update, delete on public.assistances from authenticated;
grant update (name, legal_name, document, phone, whatsapp, email, address, logo_path, brand_color,
              business_hours, welcome_message, warranty_policy, entry_terms,
              default_budget_validity_days, default_warranty_days, default_payment_terms,
              diagnosis_fee, settings)
  on public.assistances to authenticated;

revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

revoke insert, update, delete on public.assistance_members from authenticated;
grant update (role, active) on public.assistance_members to authenticated;

revoke insert, update, delete on public.assistance_invitations from authenticated;
grant update (revoked_at) on public.assistance_invitations to authenticated;

revoke all on public.assistance_counters from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;

-- -----------------------------------------------------------------------------
-- RPCs de tenancy
-- -----------------------------------------------------------------------------
create or replace function private.reserved_slugs()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['admin','api','app','painel','entrar','cadastro','login','logout','sair','auth',
               'convite','onboarding','www','suporte','ajuda','status','blog','a','os',
               'conserta-ja','consertaja','termos','privacidade','precos','planos'];
$$;

-- Cria a assistência e torna o usuário logado proprietário.
create or replace function public.create_assistance(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_id   uuid;
begin
  if v_uid is null then
    raise exception 'Faça login para continuar.' using errcode = '42501';
  end if;

  if v_slug = any (private.reserved_slugs()) then
    raise exception 'Este endereço é reservado. Escolha outro.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.assistances a where a.slug = v_slug) then
    raise exception 'Este endereço já está em uso. Escolha outro.' using errcode = 'P0001';
  end if;

  if (select count(*) from public.assistance_members m where m.user_id = v_uid and m.role = 'owner') >= 5 then
    raise exception 'Limite de assistências por usuário atingido.' using errcode = 'P0001';
  end if;

  perform private.ensure_profile(v_uid);

  insert into public.assistances (name, slug)
  values (trim(p_name), v_slug)
  returning id into v_id;

  insert into public.assistance_members (assistance_id, user_id, role)
  values (v_id, v_uid, 'owner');

  update public.profiles set active_assistance_id = v_id where id = v_uid;

  return v_id;
end;
$$;

-- Lista as assistências do usuário (para o seletor de assistência).
create or replace function public.my_assistances()
returns table (id uuid, name text, slug text, role text, is_active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.name, a.slug, m.role, (p.active_assistance_id = a.id)
  from public.assistance_members m
  join public.assistances a on a.id = m.assistance_id
  join public.profiles p on p.id = m.user_id
  where m.user_id = auth.uid() and m.active
  order by a.name;
$$;

create or replace function public.switch_assistance(p_assistance_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.assistance_members m
    where m.user_id = auth.uid() and m.assistance_id = p_assistance_id and m.active
  ) then
    raise exception 'Você não tem acesso a esta assistência.' using errcode = '42501';
  end if;

  update public.profiles set active_assistance_id = p_assistance_id where id = auth.uid();
end;
$$;

-- Convida alguém por e-mail. Retorna o token (mostrado uma única vez).
create or replace function public.create_invitation(p_email text, p_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin']);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_token text := private.random_token();
begin
  if p_role not in ('admin','technician','attendant') then
    raise exception 'Papel inválido.' using errcode = 'P0001';
  end if;
  if p_role = 'admin' and not private.has_role(array['owner']) then
    raise exception 'Só o proprietário pode convidar administradores.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.assistance_members m
    join auth.users u on u.id = m.user_id
    where m.assistance_id = v_assistance and lower(u.email) = v_email and m.active
  ) then
    raise exception 'Esta pessoa já faz parte da equipe.' using errcode = 'P0001';
  end if;

  update public.assistance_invitations
     set revoked_at = now()
   where assistance_id = v_assistance and email = v_email
     and accepted_at is null and revoked_at is null;

  insert into public.assistance_invitations (assistance_id, email, role, token_hash, invited_by)
  values (v_assistance, v_email, p_role, private.hash_token(v_token), auth.uid());

  return v_token;
end;
$$;

-- Prévia do convite (página /convite/[token], antes do login).
create or replace function public.invitation_preview(p_token text)
returns table (assistance_name text, role text, email text, is_valid boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.name, i.role, i.email,
         (i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
  from public.assistance_invitations i
  join public.assistances a on a.id = i.assistance_id
  where i.token_hash = private.hash_token(p_token);
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_inv   public.assistance_invitations;
begin
  if v_uid is null then
    raise exception 'Faça login para aceitar o convite.' using errcode = '42501';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  select * into v_inv
  from public.assistance_invitations i
  where i.token_hash = private.hash_token(p_token)
  for update;

  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at <= now() then
    raise exception 'Convite inválido ou expirado. Peça um novo convite.' using errcode = 'P0001';
  end if;

  if v_inv.email <> v_email then
    raise exception 'Este convite foi enviado para outro e-mail (%).', v_inv.email using errcode = 'P0001';
  end if;

  perform private.ensure_profile(v_uid);

  insert into public.assistance_members (assistance_id, user_id, role, active)
  values (v_inv.assistance_id, v_uid, v_inv.role, true)
  on conflict (assistance_id, user_id) do update set role = excluded.role, active = true;

  update public.assistance_invitations
     set accepted_at = now(), accepted_by = v_uid
   where id = v_inv.id;

  update public.profiles set active_assistance_id = v_inv.assistance_id where id = v_uid;

  return v_inv.assistance_id;
end;
$$;

-- Lista a equipe com e-mail (o e-mail fica em auth.users, fora do alcance da API).
create or replace function public.team_members()
returns table (user_id uuid, full_name text, email text, role text, active boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, p.full_name, u.email::text, m.role, m.active, m.created_at
  from public.assistance_members m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.assistance_id = private.current_assistance_id()
  order by m.active desc, p.full_name;
$$;

-- >>> 20261008120200_customers_equipment.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Conserta Já · 0003 · Clientes e equipamentos
-- =============================================================================

create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  assistance_id   uuid not null default private.current_assistance_id()
                  references public.assistances(id) on delete cascade,
  name            text not null,
  phone           text,
  phone_e164      text generated always as (private.normalize_br_phone(phone)) stored,
  phone_secondary text,
  email           text,
  document        text,
  address         jsonb not null default '{}'::jsonb,
  notes           text,
  anonymized_at   timestamptz,
  created_by      uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint customers_tenant_id_unique unique (assistance_id, id),
  constraint customers_phone_unique unique (assistance_id, phone_e164),
  constraint customers_name_check check (length(trim(name)) between 2 and 150),
  constraint customers_phone_valid check (anonymized_at is not null or (phone is not null and phone_e164 is not null)),
  constraint customers_document_format check (document is null or document ~ '^([0-9]{11}|[0-9]{14})$'),
  constraint customers_email_format check (email is null or position('@' in email) > 1)
);
create unique index customers_document_unique on public.customers (assistance_id, document) where document is not null;
create index customers_name_trgm_idx on public.customers using gin (name extensions.gin_trgm_ops);
create index customers_assistance_name_idx on public.customers (assistance_id, name);

create table public.equipment_categories (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid references public.assistances(id) on delete cascade,  -- null = padrão do sistema
  name          text not null,
  sort_order    int not null default 100,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint equipment_categories_name_unique unique nulls not distinct (assistance_id, name),
  constraint equipment_categories_name_check check (length(trim(name)) between 2 and 60)
);

insert into public.equipment_categories (assistance_id, name, sort_order) values
  (null, 'Celular', 10), (null, 'Tablet', 20), (null, 'Notebook', 30), (null, 'Computador', 40),
  (null, 'Televisão', 50), (null, 'Videogame', 60), (null, 'Eletrodoméstico', 70),
  (null, 'Aparelho de som', 80), (null, 'Monitor', 90), (null, 'Impressora', 100), (null, 'Outros', 999);

create table public.equipment (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid not null default private.current_assistance_id(),
  customer_id   uuid not null,
  category_id   uuid not null,
  brand         text,
  model         text,
  serial_number text,
  imei          text,
  color         text,
  description   text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint equipment_tenant_id_unique unique (assistance_id, id),
  constraint equipment_customer_id_unique unique (assistance_id, customer_id, id),
  constraint equipment_customer_fk foreign key (assistance_id, customer_id)
    references public.customers (assistance_id, id),
  constraint equipment_category_fk foreign key (category_id)
    references public.equipment_categories (id),
  constraint equipment_imei_format check (imei is null or imei ~ '^[0-9]{15}$')
);
create index equipment_customer_idx on public.equipment (assistance_id, customer_id);
create index equipment_imei_idx on public.equipment (assistance_id, imei) where imei is not null;
create index equipment_serial_idx on public.equipment (assistance_id, serial_number) where serial_number is not null;

-- Categoria precisa ser padrão do sistema ou da mesma assistência.
create or replace function private.check_equipment_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.equipment_categories c
    where c.id = new.category_id
      and (c.assistance_id is null or c.assistance_id = new.assistance_id)
  ) then
    raise exception 'Categoria inválida.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Um equipamento com OS não pode trocar de dono (as FKs também impedem).
-- Triggers
create trigger a_enforce_tenant before insert or update on public.customers
  for each row execute function private.enforce_tenant();
create trigger a_enforce_tenant before insert or update on public.equipment
  for each row execute function private.enforce_tenant();
create trigger b_check_category before insert or update of category_id on public.equipment
  for each row execute function private.check_equipment_category();

create trigger set_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.equipment
  for each row execute function private.set_updated_at();

create trigger z_audit after insert or update or delete on public.customers
  for each row execute function private.audit();
create trigger z_audit after insert or update or delete on public.equipment
  for each row execute function private.audit();

-- Categorias personalizadas: assistance_id vem do banco
create or replace function private.enforce_category_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.assistance_id := private.current_assistance_id();
    elsif new.assistance_id is distinct from old.assistance_id then
      raise exception 'Um registro não pode mudar de assistência.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger a_enforce_tenant before insert or update on public.equipment_categories
  for each row execute function private.enforce_category_tenant();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.customers            enable row level security;
alter table public.equipment_categories enable row level security;
alter table public.equipment            enable row level security;

create policy customers_select on public.customers for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));
create policy customers_insert on public.customers for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id()));
create policy customers_update on public.customers for update to authenticated
  using (assistance_id = (select private.current_assistance_id()))
  with check (assistance_id = (select private.current_assistance_id()));
create policy customers_delete on public.customers for delete to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin'])));

create policy categories_select on public.equipment_categories for select to authenticated
  using (assistance_id is null or assistance_id = (select private.current_assistance_id()));
create policy categories_insert on public.equipment_categories for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id())
              and (select private.has_role(array['owner','admin'])));
create policy categories_update on public.equipment_categories for update to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin'])))
  with check (assistance_id = (select private.current_assistance_id()));

create policy equipment_select on public.equipment for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));
create policy equipment_insert on public.equipment for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id()));
create policy equipment_update on public.equipment for update to authenticated
  using (assistance_id = (select private.current_assistance_id()))
  with check (assistance_id = (select private.current_assistance_id()));
create policy equipment_delete on public.equipment for delete to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin'])));

-- Privilégios de coluna
revoke insert, update on public.customers from authenticated;
grant insert (name, phone, phone_secondary, email, document, address, notes)
  on public.customers to authenticated;
grant update (name, phone, phone_secondary, email, document, address, notes)
  on public.customers to authenticated;

revoke insert, update, delete on public.equipment_categories from authenticated;
grant insert (name, sort_order) on public.equipment_categories to authenticated;
grant update (name, sort_order, active) on public.equipment_categories to authenticated;

revoke insert, update on public.equipment from authenticated;
grant insert (customer_id, category_id, brand, model, serial_number, imei, color, description, notes)
  on public.equipment to authenticated;
grant update (category_id, brand, model, serial_number, imei, color, description, notes)
  on public.equipment to authenticated;

-- -----------------------------------------------------------------------------
-- LGPD: anonimiza um cliente que já tem histórico (em vez de apagar)
-- -----------------------------------------------------------------------------
create or replace function public.anonymize_customer(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin']);
begin
  perform set_config('app.audit_action', 'CUSTOMER_ANONYMIZED', true);

  update public.customers
     set name = 'Cliente anonimizado',
         phone = null, phone_secondary = null, email = null, document = null,
         address = '{}'::jsonb, notes = null, anonymized_at = now()
   where id = p_customer_id and assistance_id = v_assistance and anonymized_at is null;

  if not found then
    raise exception 'Cliente não encontrado.' using errcode = 'P0001';
  end if;
  perform private.reset_context();

  -- Remove os dados pessoais que ficaram na trilha de auditoria desse cliente.
  update public.audit_logs
     set changes = null
   where assistance_id = v_assistance and table_name = 'customers' and record_id = p_customer_id
     and action <> 'CUSTOMER_ANONYMIZED';
end;
$$;

-- >>> 20261008120300_service_orders.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Conserta Já · 0004 · Ordens de serviço, histórico, fotos e senha de desbloqueio
-- =============================================================================

create table public.service_orders (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null default private.current_assistance_id(),
  customer_id      uuid not null,
  equipment_id     uuid not null,
  year             int  not null,
  number           int  not null,
  code             text generated always as ('OS-' || year::text || '-' || lpad(number::text, 6, '0')) stored,
  status           text not null default 'RECEBIDO',
  outcome          text,
  priority         text not null default 'NORMAL',
  reported_issue   text not null,
  entry_condition  jsonb not null default '{}'::jsonb,
  entry_condition_notes text,
  accessories      text[] not null default '{}',
  diagnosis        text,
  solution         text,
  customer_notes   text,
  internal_notes   text,
  access_code      text not null default private.generate_access_code(),
  technician_id    uuid,
  received_at      timestamptz not null default now(),
  estimated_completion_at timestamptz,
  completed_at     timestamptz,
  delivered_at     timestamptz,
  warranty_until   date,
  cancel_reason    text,
  parent_service_order_id uuid,
  created_by       uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint service_orders_tenant_id_unique unique (assistance_id, id),
  constraint service_orders_number_unique unique (assistance_id, year, number),
  constraint service_orders_customer_fk foreign key (assistance_id, customer_id)
    references public.customers (assistance_id, id),
  constraint service_orders_equipment_fk foreign key (assistance_id, customer_id, equipment_id)
    references public.equipment (assistance_id, customer_id, id),
  constraint service_orders_technician_fk foreign key (assistance_id, technician_id)
    references public.assistance_members (assistance_id, user_id),
  constraint service_orders_parent_fk foreign key (assistance_id, parent_service_order_id)
    references public.service_orders (assistance_id, id),
  constraint service_orders_status_check check (status in (
    'RECEBIDO','EM_DIAGNOSTICO','AGUARDANDO_APROVACAO','ORCAMENTO_RECUSADO',
    'APROVADO','AGUARDANDO_PECA','EM_MANUTENCAO','PRONTO','ENTREGUE','CANCELADO')),
  constraint service_orders_outcome_check check (outcome is null or outcome in
    ('REPARADO','NAO_REPARADO_RECUSADO','NAO_REPARADO_INVIAVEL')),
  constraint service_orders_priority_check check (priority in ('BAIXA','NORMAL','ALTA','URGENTE')),
  constraint service_orders_issue_check check (length(trim(reported_issue)) >= 3),
  constraint service_orders_cancel_reason check (status <> 'CANCELADO' or cancel_reason is not null),
  constraint service_orders_delivered_check check (status <> 'ENTREGUE' or (delivered_at is not null and outcome is not null))
);
create index service_orders_status_idx   on public.service_orders (assistance_id, status);
create index service_orders_received_idx on public.service_orders (assistance_id, received_at desc);
create index service_orders_customer_idx on public.service_orders (assistance_id, customer_id);
create index service_orders_equipment_idx on public.service_orders (assistance_id, equipment_id);

create table public.service_order_status_history (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null,
  service_order_id uuid not null,
  from_status      text,
  to_status        text not null,
  note             text,
  visible_to_customer boolean not null default true,
  changed_by       uuid references public.profiles(id) on delete set null,
  changed_via      text not null,
  created_at       timestamptz not null default now(),
  constraint status_history_os_fk foreign key (assistance_id, service_order_id)
    references public.service_orders (assistance_id, id) on delete cascade,
  constraint status_history_via_check check (changed_via in ('STAFF','PORTAL','SYSTEM'))
);
create index status_history_os_idx on public.service_order_status_history (assistance_id, service_order_id, created_at);

create table public.service_order_photos (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null default private.current_assistance_id(),
  service_order_id uuid not null,
  storage_path     text not null,
  stage            text not null default 'ENTRADA',
  kind             text not null default 'OUTRO',
  description      text,
  visible_to_customer boolean not null default true,
  mime_type        text not null,
  size_bytes       int  not null,
  uploaded_by      uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint photos_path_unique unique (storage_path),
  constraint photos_os_fk foreign key (assistance_id, service_order_id)
    references public.service_orders (assistance_id, id),
  constraint photos_stage_check check (stage in ('ENTRADA','DIAGNOSTICO','SAIDA')),
  constraint photos_kind_check check (kind in ('FRENTE','TRASEIRA','LATERAL','TELA','CONECTOR',
    'ETIQUETA','NUMERO_SERIE','DANO','ACESSORIO','OUTRO')),
  constraint photos_mime_check check (mime_type in ('image/jpeg','image/png','image/webp')),
  constraint photos_size_check check (size_bytes between 1 and 10485760),
  constraint photos_path_prefix check (storage_path like assistance_id::text || '/' || service_order_id::text || '/%')
);
create index photos_os_idx on public.service_order_photos (assistance_id, service_order_id);

-- Senha/PIN/padrão de desbloqueio. Apagada automaticamente na entrega ou cancelamento.
create table public.service_order_secrets (
  service_order_id uuid primary key,
  assistance_id    uuid not null default private.current_assistance_id(),
  unlock_code      text not null,
  created_by       uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint secrets_os_fk foreign key (assistance_id, service_order_id)
    references public.service_orders (assistance_id, id) on delete cascade,
  constraint secrets_length check (length(unlock_code) between 1 and 100)
);

-- -----------------------------------------------------------------------------
-- Numeração: OS-AAAA-000001, sequencial por assistência e por ano, sem buracos.
-- O UPDATE no contador trava a linha: duas OS simultâneas nunca pegam o mesmo número.
-- -----------------------------------------------------------------------------
create or replace function private.assign_service_order_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year int := extract(year from private.today_br())::int;
  v_next bigint;
begin
  insert into public.assistance_counters as c (assistance_id, key, last_value)
  values (new.assistance_id, 'service_order:' || v_year, 1)
  on conflict (assistance_id, key) do update set last_value = c.last_value + 1
  returning c.last_value into v_next;

  new.year := v_year;
  new.number := v_next;
  return new;
end;
$$;

-- Contexto do histórico de status (nota, origem, visibilidade) para o trigger.
create or replace function private.set_status_context(p_note text, p_via text, p_visible boolean default true)
returns void
language sql
set search_path = ''
as $$
  select set_config('app.status_note', coalesce(p_note, ''), true),
         set_config('app.status_via', coalesce(p_via, ''), true),
         set_config('app.status_visible', coalesce(p_visible, true)::text, true);
$$;

create or replace function private.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.service_order_status_history
      (assistance_id, service_order_id, from_status, to_status, note, visible_to_customer, changed_by, changed_via)
    values (
      new.assistance_id,
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      nullif(current_setting('app.status_note', true), ''),
      coalesce(nullif(current_setting('app.status_visible', true), '')::boolean, true),
      auth.uid(),
      coalesce(nullif(current_setting('app.status_via', true), ''),
               case when auth.uid() is null then 'SYSTEM' else 'STAFF' end)
    );
  end if;
  return new;
end;
$$;

create or replace function private.purge_secrets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('ENTREGUE', 'CANCELADO') then
    delete from public.service_order_secrets where service_order_id = new.id;
  end if;
  return new;
end;
$$;

-- Triggers (executam em ordem alfabética do nome)
create trigger a_enforce_tenant before insert or update on public.service_orders
  for each row execute function private.enforce_tenant();
create trigger b_assign_number before insert on public.service_orders
  for each row execute function private.assign_service_order_number();
create trigger set_updated_at before update on public.service_orders
  for each row execute function private.set_updated_at();
create trigger y_log_status after insert or update of status on public.service_orders
  for each row execute function private.log_status_change();
create trigger y_purge_secrets after update of status on public.service_orders
  for each row execute function private.purge_secrets();
create trigger z_audit after insert or update on public.service_orders
  for each row execute function private.audit();

create trigger a_enforce_tenant before insert or update on public.service_order_photos
  for each row execute function private.enforce_tenant();
create trigger z_audit after insert or delete on public.service_order_photos
  for each row execute function private.audit();

create trigger a_enforce_tenant before insert or update on public.service_order_secrets
  for each row execute function private.enforce_tenant();
-- (sem auditoria: a senha não pode ficar registrada em lugar nenhum)

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.service_orders               enable row level security;
alter table public.service_order_status_history enable row level security;
alter table public.service_order_photos         enable row level security;
alter table public.service_order_secrets        enable row level security;

create policy service_orders_select on public.service_orders for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));
create policy service_orders_insert on public.service_orders for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id()));
create policy service_orders_update on public.service_orders for update to authenticated
  using (assistance_id = (select private.current_assistance_id()))
  with check (assistance_id = (select private.current_assistance_id()));

create policy status_history_select on public.service_order_status_history for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));

create policy photos_select on public.service_order_photos for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));
create policy photos_insert on public.service_order_photos for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id()));
create policy photos_update on public.service_order_photos for update to authenticated
  using (assistance_id = (select private.current_assistance_id()))
  with check (assistance_id = (select private.current_assistance_id()));
create policy photos_delete on public.service_order_photos for delete to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin'])));

create policy secrets_select on public.service_order_secrets for select to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin','technician'])));
create policy secrets_insert on public.service_order_secrets for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id()));
create policy secrets_update on public.service_order_secrets for update to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin','technician'])))
  with check (assistance_id = (select private.current_assistance_id()));
create policy secrets_delete on public.service_order_secrets for delete to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin','technician'])));

-- Privilégios de coluna: status, numeração e código de acesso só mudam por função.
revoke insert, update, delete on public.service_orders from authenticated;
grant insert (customer_id, equipment_id, priority, reported_issue, entry_condition, entry_condition_notes,
              accessories, customer_notes, internal_notes, technician_id, estimated_completion_at,
              parent_service_order_id)
  on public.service_orders to authenticated;
grant update (priority, reported_issue, entry_condition, entry_condition_notes, accessories, diagnosis,
              solution, customer_notes, internal_notes, technician_id, estimated_completion_at)
  on public.service_orders to authenticated;

revoke insert, update, delete on public.service_order_status_history from authenticated;

revoke insert, update on public.service_order_photos from authenticated;
grant insert (service_order_id, storage_path, stage, kind, description, visible_to_customer, mime_type, size_bytes)
  on public.service_order_photos to authenticated;
grant update (stage, kind, description, visible_to_customer) on public.service_order_photos to authenticated;

revoke insert, update on public.service_order_secrets from authenticated;
grant insert (service_order_id, unlock_code) on public.service_order_secrets to authenticated;
grant update (unlock_code) on public.service_order_secrets to authenticated;

-- -----------------------------------------------------------------------------
-- View de listagem (security_invoker: o RLS de quem consulta continua valendo)
-- -----------------------------------------------------------------------------
create view public.v_service_orders with (security_invoker = true) as
select so.id, so.assistance_id, so.code, so.year, so.number, so.status, so.outcome, so.priority,
       so.reported_issue, so.received_at, so.estimated_completion_at, so.completed_at, so.delivered_at,
       so.warranty_until, so.updated_at,
       so.customer_id, c.name as customer_name, c.phone as customer_phone, c.phone_e164 as customer_phone_e164,
       so.equipment_id, cat.name as category_name, e.brand, e.model, e.serial_number, e.imei, e.color,
       so.technician_id, tp.full_name as technician_name
from public.service_orders so
join public.customers c on c.id = so.customer_id
join public.equipment e on e.id = so.equipment_id
join public.equipment_categories cat on cat.id = e.category_id
left join public.profiles tp on tp.id = so.technician_id;

-- -----------------------------------------------------------------------------
-- RPC: abertura de OS (cliente e equipamento novos opcionais) em uma transação.
-- SECURITY INVOKER: o RLS e os privilégios de coluna valem dentro da função.
-- -----------------------------------------------------------------------------
create or replace function public.create_service_order(p jsonb)
returns table (id uuid, code text, access_code text)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_customer  uuid := nullif(p ->> 'customer_id', '')::uuid;
  v_equipment uuid := nullif(p ->> 'equipment_id', '')::uuid;
  v_os        uuid;
  c jsonb := nullif(p -> 'customer', 'null'::jsonb);
  e jsonb := nullif(p -> 'equipment', 'null'::jsonb);
begin
  if v_customer is null then
    if c is null then
      raise exception 'Selecione ou cadastre o cliente.' using errcode = 'P0001';
    end if;
    insert into public.customers (name, phone, phone_secondary, email, document, address, notes)
    values (
      trim(c ->> 'name'), c ->> 'phone', nullif(c ->> 'phone_secondary', ''), nullif(lower(c ->> 'email'), ''),
      nullif(c ->> 'document', ''), coalesce(c -> 'address', '{}'::jsonb), nullif(c ->> 'notes', '')
    )
    returning customers.id into v_customer;
  end if;

  if v_equipment is null then
    if e is null then
      raise exception 'Selecione ou cadastre o equipamento.' using errcode = 'P0001';
    end if;
    insert into public.equipment (customer_id, category_id, brand, model, serial_number, imei, color, description, notes)
    values (
      v_customer, (e ->> 'category_id')::uuid, nullif(e ->> 'brand', ''), nullif(e ->> 'model', ''),
      nullif(e ->> 'serial_number', ''), nullif(e ->> 'imei', ''), nullif(e ->> 'color', ''),
      nullif(e ->> 'description', ''), nullif(e ->> 'notes', '')
    )
    returning equipment.id into v_equipment;
  end if;

  perform private.set_status_context('Equipamento recebido', 'STAFF', true);

  insert into public.service_orders (
    customer_id, equipment_id, priority, reported_issue, entry_condition, entry_condition_notes,
    accessories, customer_notes, internal_notes, technician_id, estimated_completion_at
  ) values (
    v_customer, v_equipment, coalesce(nullif(p ->> 'priority', ''), 'NORMAL'), trim(p ->> 'reported_issue'),
    coalesce(p -> 'entry_condition', '{}'::jsonb), nullif(p ->> 'entry_condition_notes', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'accessories', '[]'::jsonb))), '{}'),
    nullif(p ->> 'customer_notes', ''), nullif(p ->> 'internal_notes', ''),
    nullif(p ->> 'technician_id', '')::uuid, nullif(p ->> 'estimated_completion_at', '')::timestamptz
  )
  returning service_orders.id into v_os;

  if nullif(trim(coalesce(p ->> 'unlock_code', '')), '') is not null then
    insert into public.service_order_secrets (service_order_id, unlock_code)
    values (v_os, trim(p ->> 'unlock_code'));
  end if;

  perform private.reset_context();

  return query
    select so.id, so.code, so.access_code from public.service_orders so where so.id = v_os;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: mudança manual de status (máquina de estados)
-- As mudanças ligadas ao orçamento (enviar, aprovar, recusar) são feitas pelas
-- funções de orçamento, não por aqui.
-- -----------------------------------------------------------------------------
create or replace function public.change_service_order_status(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.current_assistance_id();
  v_os public.service_orders;
  v_tech constant text[] := array['owner','admin','technician'];
  v_all  constant text[] := array['owner','admin','technician','attendant'];
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_warranty int;
begin
  if v_assistance is null then
    raise exception 'Nenhuma assistência ativa. Entre novamente.' using errcode = '42501';
  end if;

  select * into v_os from public.service_orders so
  where so.id = p_id and so.assistance_id = v_assistance
  for update;

  if not found then
    raise exception 'OS não encontrada.' using errcode = 'P0001';
  end if;

  if v_os.status = p_status then
    return;
  end if;

  perform private.set_status_context(v_note, 'STAFF', true);

  -- Cancelamento: de qualquer status, exceto ENTREGUE
  if p_status = 'CANCELADO' then
    if v_os.status = 'ENTREGUE' then
      raise exception 'Uma OS entregue não pode ser cancelada.' using errcode = 'P0001';
    end if;
    perform private.require_role(array['owner','admin']);
    if v_note is null or length(v_note) < 3 then
      raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
    end if;
    perform set_config('app.audit_action', 'OS_CANCELLED', true);
    update public.budget_versions set status = 'CANCELADO'
     where service_order_id = p_id and status in ('RASCUNHO','ENVIADO');
    update public.service_orders set status = 'CANCELADO', cancel_reason = v_note where id = p_id;
    perform private.reset_context();
    return;
  end if;

  if v_os.status = 'RECEBIDO' and p_status = 'EM_DIAGNOSTICO' then
    perform private.require_role(v_tech);
    update public.service_orders set status = p_status where id = p_id;

  elsif v_os.status = 'EM_DIAGNOSTICO' and p_status = 'PRONTO' then
    perform private.require_role(v_tech);
    if nullif(trim(coalesce(v_os.diagnosis, '')), '') is null then
      raise exception 'Registre o diagnóstico antes de marcar o reparo como inviável.' using errcode = 'P0001';
    end if;
    update public.service_orders
       set status = 'PRONTO', outcome = 'NAO_REPARADO_INVIAVEL', completed_at = now()
     where id = p_id;

  elsif v_os.status = 'ORCAMENTO_RECUSADO' and p_status = 'PRONTO' then
    perform private.require_role(v_all);
    update public.service_orders
       set status = 'PRONTO', outcome = 'NAO_REPARADO_RECUSADO', completed_at = now()
     where id = p_id;

  elsif v_os.status = 'ORCAMENTO_RECUSADO' and p_status = 'EM_MANUTENCAO' then
    perform private.require_role(v_tech);
    if not exists (select 1 from public.budget_versions b where b.service_order_id = p_id and b.status = 'APROVADO') then
      raise exception 'Não há orçamento aprovado para continuar o reparo.' using errcode = 'P0001';
    end if;
    update public.service_orders set status = p_status where id = p_id;

  elsif (v_os.status = 'APROVADO' and p_status in ('EM_MANUTENCAO', 'AGUARDANDO_PECA'))
     or (v_os.status = 'EM_MANUTENCAO' and p_status = 'AGUARDANDO_PECA')
     or (v_os.status = 'AGUARDANDO_PECA' and p_status = 'EM_MANUTENCAO') then
    perform private.require_role(v_tech);
    update public.service_orders set status = p_status where id = p_id;

  elsif v_os.status = 'EM_MANUTENCAO' and p_status = 'PRONTO' then
    perform private.require_role(v_tech);
    if nullif(trim(coalesce(v_os.solution, '')), '') is null then
      raise exception 'Descreva a solução aplicada antes de concluir.' using errcode = 'P0001';
    end if;
    update public.service_orders
       set status = 'PRONTO', outcome = 'REPARADO', completed_at = now()
     where id = p_id;

  elsif v_os.status = 'PRONTO' and p_status = 'EM_MANUTENCAO' then
    perform private.require_role(v_tech);
    if v_note is null then
      raise exception 'Informe o motivo para reabrir o reparo.' using errcode = 'P0001';
    end if;
    update public.service_orders
       set status = 'EM_MANUTENCAO', outcome = null, completed_at = null
     where id = p_id;

  elsif v_os.status = 'PRONTO' and p_status = 'ENTREGUE' then
    perform private.require_role(v_all);
    perform set_config('app.audit_action', 'OS_DELIVERED', true);
    if v_os.outcome = 'REPARADO' then
      select b.warranty_days into v_warranty
      from public.budget_versions b
      where b.service_order_id = p_id and b.status = 'APROVADO'
      order by b.version desc limit 1;
    end if;
    update public.service_orders
       set status = 'ENTREGUE',
           delivered_at = now(),
           warranty_until = case when v_warranty is not null and v_warranty > 0
                                 then private.today_br() + v_warranty end
     where id = p_id;

  else
    raise exception 'Mudança de status não permitida (de % para %).', v_os.status, p_status using errcode = 'P0001';
  end if;

  perform private.reset_context();
end;
$$;

-- Gera um novo código de acesso do portal para a OS (ex.: comprovante perdido).
create or replace function public.regenerate_access_code(p_service_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin','technician','attendant']);
  v_code text := private.generate_access_code();
begin
  perform set_config('app.audit_action', 'ACCESS_CODE_REGENERATED', true);
  update public.service_orders set access_code = v_code
   where id = p_service_order_id and assistance_id = v_assistance;
  if not found then
    raise exception 'OS não encontrada.' using errcode = 'P0001';
  end if;
  perform private.reset_context();
  return v_code;
end;
$$;

-- >>> 20261008120400_storage.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Conserta Já · 0005 · Storage
-- Fotos de OS em bucket PRIVADO, uma pasta por assistência:
--   service-order-photos/{assistance_id}/{service_order_id}/{uuid}.webp
-- Logos em bucket público (leitura), gravação só por owner/admin:
--   logos/{assistance_id}/logo-{timestamp}.webp
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('service-order-photos', 'service-order-photos', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('logos',                'logos',                true,  2097152,  array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Fotos de OS ---------------------------------------------------------------
create policy os_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'service-order-photos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
  );

create policy os_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'service-order-photos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
  );

create policy os_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'service-order-photos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
    and (select private.has_role(array['owner','admin']))
  );

-- Logos -----------------------------------------------------------------------
create policy logos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
  );

create policy logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
    and (select private.has_role(array['owner','admin']))
  );

create policy logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
    and (select private.has_role(array['owner','admin']))
  );

create policy logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
    and (select private.has_role(array['owner','admin']))
  );

-- >>> 20261008120500_budgets.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Conserta Já · 0006 · Orçamentos versionados
-- Cada linha de budget_versions é uma versão. Só o RASCUNHO é editável.
-- Valores calculados (subtotal, items_subtotal, total) nunca vêm do frontend.
-- =============================================================================

create table public.budget_versions (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null default private.current_assistance_id(),
  service_order_id uuid not null,
  version          int  not null,
  status           text not null default 'RASCUNHO',
  items_subtotal   numeric(12,2) not null default 0,
  discount_amount  numeric(12,2) not null default 0,
  surcharge_amount numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  estimated_days   int,
  warranty_days    int,
  payment_terms    text,
  valid_until      date,
  customer_notes   text,
  technical_notes  text,
  internal_notes   text,
  snapshot         jsonb,
  content_hash     text,
  sent_at          timestamptz,
  sent_by          uuid references public.profiles(id) on delete set null,
  decided_at       timestamptz,
  decision_channel text,
  decided_by_user  uuid references public.profiles(id) on delete set null,
  decided_by_session uuid,
  decision_ip      inet,
  decision_user_agent text,
  refusal_reason   text,
  created_by       uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint budget_versions_tenant_id_unique unique (assistance_id, id),
  constraint budget_versions_version_unique unique (service_order_id, version),
  constraint budget_versions_os_fk foreign key (assistance_id, service_order_id)
    references public.service_orders (assistance_id, id),
  constraint budget_versions_status_check check (status in
    ('RASCUNHO','ENVIADO','APROVADO','RECUSADO','SUBSTITUIDO','CANCELADO')),
  constraint budget_versions_channel_check check (decision_channel is null or decision_channel in
    ('PORTAL','BALCAO','TELEFONE','WHATSAPP')),
  constraint budget_versions_discount_positive check (discount_amount >= 0),
  constraint budget_versions_surcharge_positive check (surcharge_amount >= 0),
  constraint budget_versions_total_positive check (total >= 0),
  constraint budget_versions_days_check check (estimated_days is null or estimated_days between 1 and 365),
  constraint budget_versions_warranty_check check (warranty_days is null or warranty_days between 0 and 3650),
  constraint budget_versions_refusal_reason check (status <> 'RECUSADO' or length(trim(refusal_reason)) >= 3),
  constraint budget_versions_sent_complete check (status in ('RASCUNHO','CANCELADO') or (
    snapshot is not null and content_hash is not null and sent_at is not null
    and valid_until is not null and estimated_days is not null))
);
-- No máximo UMA versão aberta (rascunho ou aguardando cliente) por OS.
create unique index budget_versions_one_open on public.budget_versions (service_order_id)
  where status in ('RASCUNHO','ENVIADO');
create index budget_versions_status_idx on public.budget_versions (assistance_id, status);
create index budget_versions_os_idx on public.budget_versions (assistance_id, service_order_id, version desc);

create table public.budget_items (
  id                uuid primary key default gen_random_uuid(),
  assistance_id     uuid not null default private.current_assistance_id(),
  budget_version_id uuid not null,
  position          int  not null default 0,
  kind              text not null,
  description       text not null,
  quantity          numeric(10,3) not null default 1,
  unit_price        numeric(12,2) not null,
  discount_amount   numeric(12,2) not null default 0,
  subtotal          numeric(12,2) generated always as (round(quantity * unit_price, 2) - discount_amount) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint budget_items_version_fk foreign key (assistance_id, budget_version_id)
    references public.budget_versions (assistance_id, id) on delete cascade,
  constraint budget_items_kind_check check (kind in ('SERVICO','PECA')),
  constraint budget_items_description_check check (length(trim(description)) between 1 and 300),
  constraint budget_items_quantity_positive check (quantity > 0),
  constraint budget_items_price_positive check (unit_price >= 0),
  constraint budget_items_discount_positive check (discount_amount >= 0),
  constraint budget_items_discount_limit check (discount_amount <= round(quantity * unit_price, 2))
);
create index budget_items_version_idx on public.budget_items (budget_version_id, position);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Nova versão: número sequencial e padrões da assistência.
create or replace function private.prepare_budget_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.assistances;
begin
  select coalesce(max(b.version), 0) + 1 into new.version
  from public.budget_versions b
  where b.service_order_id = new.service_order_id;

  select * into v_a from public.assistances a where a.id = new.assistance_id;
  new.warranty_days := coalesce(new.warranty_days, v_a.default_warranty_days);
  new.payment_terms := coalesce(new.payment_terms, v_a.default_payment_terms);
  new.status := 'RASCUNHO';
  new.items_subtotal := 0;
  new.total := greatest(0, 0 - new.discount_amount + new.surcharge_amount);
  return new;
end;
$$;

-- Imutabilidade e transições da versão.
create or replace function private.guard_budget_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_content constant text[] := array['assistance_id','service_order_id','version','items_subtotal','discount_amount',
    'surcharge_amount','total','estimated_days','warranty_days','payment_terms','valid_until','customer_notes',
    'technical_notes','snapshot','content_hash','sent_at','sent_by','created_by','created_at'];
  v_decision constant text[] := array['decided_at','decision_channel','decided_by_user','decided_by_session',
    'decision_ip','decision_user_agent','refusal_reason'];
  v_old jsonb := to_jsonb(old);
  v_new jsonb;
begin
  new.total := new.items_subtotal - new.discount_amount + new.surcharge_amount;
  if new.total < 0 then
    raise exception 'O desconto não pode ser maior que o valor dos itens.' using errcode = 'P0001';
  end if;
  v_new := to_jsonb(new);

  if old.status <> 'RASCUNHO' and exists (
    select 1 from unnest(v_content) k where (v_new -> k) is distinct from (v_old -> k)
  ) then
    raise exception 'Este orçamento já foi enviado e não pode ser alterado. Crie uma nova versão.' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'RASCUNHO' and new.status in ('ENVIADO','CANCELADO'))
      or (old.status = 'ENVIADO' and new.status in ('APROVADO','RECUSADO','SUBSTITUIDO','CANCELADO'))
    ) then
      raise exception 'Mudança de status do orçamento não permitida (% para %).', old.status, new.status
        using errcode = 'P0001';
    end if;
  elsif exists (select 1 from unnest(v_decision) k where (v_new -> k) is distinct from (v_old -> k)) then
    raise exception 'A decisão do cliente não pode ser alterada.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Itens só mudam enquanto a versão é RASCUNHO.
create or replace function private.guard_budget_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version uuid := case when tg_op = 'DELETE' then old.budget_version_id else new.budget_version_id end;
  v_status text;
begin
  if tg_op = 'UPDATE' and new.budget_version_id <> old.budget_version_id then
    raise exception 'Um item não pode mudar de orçamento.' using errcode = 'P0001';
  end if;

  select b.status into v_status from public.budget_versions b where b.id = v_version;
  if v_status is distinct from 'RASCUNHO' then
    raise exception 'Este orçamento já foi enviado e não pode ser alterado. Crie uma nova versão.' using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

-- Recalcula os totais da versão a cada mudança de item.
create or replace function private.recalc_budget_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version uuid := case when tg_op = 'DELETE' then old.budget_version_id else new.budget_version_id end;
begin
  update public.budget_versions b
     set items_subtotal = coalesce((select sum(i.subtotal) from public.budget_items i where i.budget_version_id = b.id), 0)
   where b.id = v_version and b.status = 'RASCUNHO';
  return null;
end;
$$;

create trigger a_enforce_tenant before insert or update on public.budget_versions
  for each row execute function private.enforce_tenant();
create trigger b_prepare before insert on public.budget_versions
  for each row execute function private.prepare_budget_version();
create trigger b_guard before update on public.budget_versions
  for each row execute function private.guard_budget_version();
create trigger set_updated_at before update on public.budget_versions
  for each row execute function private.set_updated_at();
create trigger z_audit after insert or update on public.budget_versions
  for each row execute function private.audit();

create trigger a_enforce_tenant before insert or update on public.budget_items
  for each row execute function private.enforce_tenant();
create trigger b_guard before insert or update or delete on public.budget_items
  for each row execute function private.guard_budget_item();
create trigger set_updated_at before update on public.budget_items
  for each row execute function private.set_updated_at();
create trigger y_recalc after insert or update or delete on public.budget_items
  for each row execute function private.recalc_budget_totals();
create trigger z_audit after insert or update or delete on public.budget_items
  for each row execute function private.audit();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.budget_versions enable row level security;
alter table public.budget_items    enable row level security;

create policy budget_versions_select on public.budget_versions for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));
create policy budget_versions_update on public.budget_versions for update to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin','technician'])))
  with check (assistance_id = (select private.current_assistance_id()));

create policy budget_items_select on public.budget_items for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));
create policy budget_items_insert on public.budget_items for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id())
              and (select private.has_role(array['owner','admin','technician'])));
create policy budget_items_update on public.budget_items for update to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin','technician'])))
  with check (assistance_id = (select private.current_assistance_id()));
create policy budget_items_delete on public.budget_items for delete to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin','technician'])));

revoke insert, update, delete on public.budget_versions from authenticated;
grant update (discount_amount, surcharge_amount, estimated_days, warranty_days, payment_terms,
              customer_notes, technical_notes, internal_notes)
  on public.budget_versions to authenticated;

revoke insert, update on public.budget_items from authenticated;
grant insert (budget_version_id, position, kind, description, quantity, unit_price, discount_amount)
  on public.budget_items to authenticated;
grant update (position, kind, description, quantity, unit_price, discount_amount)
  on public.budget_items to authenticated;

-- -----------------------------------------------------------------------------
-- View
-- -----------------------------------------------------------------------------
create view public.v_budget_versions with (security_invoker = true) as
select b.id, b.assistance_id, b.service_order_id, so.code as service_order_code,
       so.status as service_order_status, c.name as customer_name,
       cat.name as category_name, e.brand, e.model,
       b.version, b.status, b.items_subtotal, b.discount_amount, b.surcharge_amount, b.total,
       b.sent_at, b.valid_until, b.decided_at, b.decision_channel, b.refusal_reason, b.created_at,
       (b.status = 'ENVIADO' and b.valid_until < private.today_br()) as is_expired
from public.budget_versions b
join public.service_orders so on so.id = b.service_order_id
join public.customers c on c.id = so.customer_id
join public.equipment e on e.id = so.equipment_id
join public.equipment_categories cat on cat.id = e.category_id;

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------

-- Abre (ou devolve) o rascunho da OS. Se houver versão aguardando o cliente,
-- ela vira SUBSTITUIDO e os itens são copiados para a nova versão.
create or replace function public.create_budget_version(p_service_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin','technician']);
  v_os   public.service_orders;
  v_prev public.budget_versions;
  v_new  uuid;
  v_has_approved boolean;
begin
  select * into v_os from public.service_orders so
  where so.id = p_service_order_id and so.assistance_id = v_assistance
  for update;
  if not found then
    raise exception 'OS não encontrada.' using errcode = 'P0001';
  end if;
  if v_os.status in ('PRONTO','ENTREGUE','CANCELADO') then
    raise exception 'Não é possível orçar uma OS com status %.', v_os.status using errcode = 'P0001';
  end if;

  select b.id into v_new from public.budget_versions b
  where b.service_order_id = p_service_order_id and b.status = 'RASCUNHO';
  if found then
    return v_new;
  end if;

  select * into v_prev from public.budget_versions b
  where b.service_order_id = p_service_order_id
  order by b.version desc limit 1;

  if v_prev.status = 'ENVIADO' then
    perform set_config('app.audit_action', 'BUDGET_SUPERSEDED', true);
    update public.budget_versions set status = 'SUBSTITUIDO' where id = v_prev.id;

    if v_os.status = 'AGUARDANDO_APROVACAO' then
      select exists (
        select 1 from public.budget_versions b
        where b.service_order_id = p_service_order_id and b.status = 'APROVADO'
      ) into v_has_approved;
      perform private.set_status_context('Orçamento em revisão pela assistência', 'SYSTEM', true);
      update public.service_orders
         set status = case when v_has_approved then 'EM_MANUTENCAO' else 'EM_DIAGNOSTICO' end
       where id = p_service_order_id;
    end if;
  end if;

  perform set_config('app.audit_action', 'BUDGET_VERSION_CREATED', true);

  insert into public.budget_versions (
    assistance_id, service_order_id, discount_amount, surcharge_amount, estimated_days, warranty_days,
    payment_terms, customer_notes, technical_notes, internal_notes
  ) values (
    v_assistance, p_service_order_id, coalesce(v_prev.discount_amount, 0), coalesce(v_prev.surcharge_amount, 0),
    v_prev.estimated_days, v_prev.warranty_days, v_prev.payment_terms, v_prev.customer_notes,
    v_prev.technical_notes, v_prev.internal_notes
  )
  returning id into v_new;

  if v_prev.id is not null then
    insert into public.budget_items
      (assistance_id, budget_version_id, position, kind, description, quantity, unit_price, discount_amount)
    select v_assistance, v_new, i.position, i.kind, i.description, i.quantity, i.unit_price, i.discount_amount
    from public.budget_items i
    where i.budget_version_id = v_prev.id
    order by i.position;
  end if;

  perform private.reset_context();
  return v_new;
end;
$$;

-- Envia o rascunho: congela snapshot + hash e move a OS para AGUARDANDO_APROVACAO.
create or replace function public.send_budget_version(p_version_id uuid, p_valid_days int default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin','technician']);
  v_b   public.budget_versions;
  v_os  public.service_orders;
  v_a   public.assistances;
  v_c   public.customers;
  v_e   public.equipment;
  v_cat text;
  v_items jsonb;
  v_snapshot jsonb;
  v_valid date;
begin
  select * into v_b from public.budget_versions b
  where b.id = p_version_id and b.assistance_id = v_assistance
  for update;
  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0001';
  end if;
  if v_b.status <> 'RASCUNHO' then
    raise exception 'Este orçamento já foi enviado.' using errcode = 'P0001';
  end if;

  select * into v_os from public.service_orders so where so.id = v_b.service_order_id for update;
  if v_os.status not in ('RECEBIDO','EM_DIAGNOSTICO','ORCAMENTO_RECUSADO','APROVADO','AGUARDANDO_PECA','EM_MANUTENCAO') then
    raise exception 'Não é possível enviar orçamento para uma OS com status %.', v_os.status using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.budget_items i where i.budget_version_id = v_b.id) then
    raise exception 'Adicione pelo menos um item ao orçamento.' using errcode = 'P0001';
  end if;
  if v_b.estimated_days is null then
    raise exception 'Informe o prazo estimado em dias.' using errcode = 'P0001';
  end if;
  if v_b.total <= 0 then
    raise exception 'O total do orçamento precisa ser maior que zero.' using errcode = 'P0001';
  end if;
  if p_valid_days is not null and (p_valid_days < 1 or p_valid_days > 90) then
    raise exception 'A validade deve ficar entre 1 e 90 dias.' using errcode = 'P0001';
  end if;

  select * into v_a from public.assistances a where a.id = v_assistance;
  select * into v_c from public.customers c where c.id = v_os.customer_id;
  select * into v_e from public.equipment e where e.id = v_os.equipment_id;
  select cat.name into v_cat from public.equipment_categories cat where cat.id = v_e.category_id;

  v_valid := private.today_br() + coalesce(p_valid_days, v_a.default_budget_validity_days);

  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', i.kind, 'description', i.description, 'quantity', i.quantity,
           'unit_price', i.unit_price, 'discount_amount', i.discount_amount, 'subtotal', i.subtotal)
           order by i.position, i.created_at), '[]'::jsonb)
    into v_items
  from public.budget_items i
  where i.budget_version_id = v_b.id;

  v_snapshot := jsonb_build_object(
    'version', v_b.version,
    'issued_at', now(),
    'valid_until', v_valid,
    'assistance', jsonb_build_object(
      'name', v_a.name, 'legal_name', v_a.legal_name, 'document', v_a.document, 'phone', v_a.phone,
      'whatsapp', v_a.whatsapp, 'email', v_a.email, 'address', v_a.address, 'logo_path', v_a.logo_path,
      'brand_color', v_a.brand_color, 'warranty_policy', v_a.warranty_policy),
    'customer', jsonb_build_object('name', v_c.name, 'phone', v_c.phone),
    'equipment', jsonb_build_object(
      'category', v_cat, 'brand', v_e.brand, 'model', v_e.model, 'serial_number', v_e.serial_number,
      'imei', v_e.imei, 'color', v_e.color),
    'service_order', jsonb_build_object(
      'code', v_os.code, 'received_at', v_os.received_at,
      'reported_issue', v_os.reported_issue, 'diagnosis', v_os.diagnosis),
    'items', v_items,
    'totals', jsonb_build_object(
      'items_subtotal', v_b.items_subtotal, 'discount_amount', v_b.discount_amount,
      'surcharge_amount', v_b.surcharge_amount, 'total', v_b.total),
    'terms', jsonb_build_object(
      'estimated_days', v_b.estimated_days, 'warranty_days', v_b.warranty_days,
      'payment_terms', v_b.payment_terms, 'customer_notes', v_b.customer_notes,
      'technical_notes', v_b.technical_notes)
  );

  perform set_config('app.audit_action', 'BUDGET_SENT', true);

  update public.budget_versions
     set status = 'ENVIADO',
         snapshot = v_snapshot,
         content_hash = encode(sha256(convert_to(v_snapshot::text, 'UTF8')), 'hex'),
         sent_at = now(),
         sent_by = auth.uid(),
         valid_until = v_valid
   where id = v_b.id;

  perform private.set_status_context('Orçamento enviado (versão ' || v_b.version || ')', 'SYSTEM', true);
  update public.service_orders set status = 'AGUARDANDO_APROVACAO'
   where id = v_os.id and status <> 'AGUARDANDO_APROVACAO';

  perform private.reset_context();
end;
$$;

-- Aplica a decisão (aprovação/recusa). Usada pelo portal e pelo balcão.
create or replace function private.apply_budget_decision(
  p_version_id uuid, p_decision text, p_channel text, p_reason text,
  p_user uuid, p_session uuid, p_ip inet, p_user_agent text, p_via text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.budget_versions;
begin
  select * into v_b from public.budget_versions b where b.id = p_version_id for update;
  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0001';
  end if;
  if v_b.status <> 'ENVIADO' then
    raise exception 'Este orçamento não está mais aguardando decisão.' using errcode = 'P0001';
  end if;
  if v_b.valid_until < private.today_br() then
    raise exception 'Este orçamento venceu em %. Peça um novo à assistência.', to_char(v_b.valid_until, 'DD/MM/YYYY')
      using errcode = 'P0001';
  end if;
  if p_decision not in ('APROVADO','RECUSADO') then
    raise exception 'Decisão inválida.' using errcode = 'P0001';
  end if;
  if p_decision = 'RECUSADO' and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Conte rapidamente o motivo da recusa.' using errcode = 'P0001';
  end if;

  perform set_config('app.audit_action',
    case p_decision when 'APROVADO' then 'BUDGET_APPROVED' else 'BUDGET_REFUSED' end, true);
  if p_session is not null then
    perform set_config('app.portal_session_id', p_session::text, true);
  end if;

  update public.budget_versions
     set status = p_decision,
         decided_at = now(),
         decision_channel = p_channel,
         decided_by_user = p_user,
         decided_by_session = p_session,
         decision_ip = p_ip,
         decision_user_agent = left(p_user_agent, 500),
         refusal_reason = case when p_decision = 'RECUSADO' then trim(p_reason) end
   where id = p_version_id;

  perform private.set_status_context(
    case p_decision when 'APROVADO' then 'Orçamento aprovado' else 'Orçamento recusado' end
      || ' (versão ' || v_b.version || ')',
    p_via, true);

  update public.service_orders
     set status = case p_decision when 'APROVADO' then 'APROVADO' else 'ORCAMENTO_RECUSADO' end
   where id = v_b.service_order_id and status = 'AGUARDANDO_APROVACAO';

  perform private.reset_context();
  perform set_config('app.portal_session_id', '', true);
end;
$$;

-- Decisão registrada pela equipe (cliente decidiu no balcão, por telefone ou WhatsApp).
create or replace function public.staff_decide_budget(
  p_version_id uuid, p_decision text, p_channel text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin','technician','attendant']);
begin
  if p_channel not in ('BALCAO','TELEFONE','WHATSAPP') then
    raise exception 'Informe como o cliente decidiu (balcão, telefone ou WhatsApp).' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.budget_versions b where b.id = p_version_id and b.assistance_id = v_assistance) then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0001';
  end if;

  perform private.apply_budget_decision(
    p_version_id, p_decision, p_channel, p_reason, auth.uid(), null, null, null, 'STAFF');
end;
$$;

-- >>> 20261008120600_portal.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Conserta Já · 0007 · Portal do cliente
-- O cliente NÃO é usuário do Supabase Auth. O acesso é uma sessão própria
-- (token aleatório no cookie httpOnly; o banco guarda só o hash) e toda leitura
-- passa por funções portal_* que tiram assistência e cliente DA SESSÃO.
-- As tabelas continuam fechadas para o papel anon.
-- =============================================================================

create table public.portal_sessions (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid not null,
  customer_id   uuid not null,
  token_hash    bytea not null,
  login_method  text not null default 'ACCESS_CODE',
  ip            inet,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '30 days',
  revoked_at    timestamptz,
  constraint portal_sessions_token_unique unique (token_hash),
  constraint portal_sessions_customer_fk foreign key (assistance_id, customer_id)
    references public.customers (assistance_id, id) on delete cascade,
  constraint portal_sessions_method_check check (login_method in ('ACCESS_CODE','OTP'))
);
create index portal_sessions_customer_idx on public.portal_sessions (assistance_id, customer_id);

create table public.portal_login_attempts (
  id            bigint generated always as identity primary key,
  assistance_id uuid not null references public.assistances(id) on delete cascade,
  phone_e164    text,
  ip            inet,
  success       boolean not null,
  created_at    timestamptz not null default now()
);
create index portal_attempts_phone_idx on public.portal_login_attempts (assistance_id, phone_e164, created_at desc);
create index portal_attempts_ip_idx on public.portal_login_attempts (ip, created_at desc);

alter table public.budget_versions
  add constraint budget_versions_session_fk foreign key (decided_by_session)
  references public.portal_sessions (id) on delete set null;

alter table public.portal_sessions       enable row level security;
alter table public.portal_login_attempts enable row level security;
-- Sem policies: nenhum acesso direto pela API.
revoke all on public.portal_sessions from anon, authenticated;
revoke all on public.portal_login_attempts from anon, authenticated;

-- Trocar o telefone (ou anonimizar) o cliente derruba as sessões dele.
create or replace function private.revoke_sessions_on_phone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone_e164 is distinct from old.phone_e164 then
    update public.portal_sessions
       set revoked_at = now()
     where customer_id = new.id and revoked_at is null;
  end if;
  return new;
end;
$$;

create trigger y_revoke_portal_sessions after update of phone on public.customers
  for each row execute function private.revoke_sessions_on_phone_change();

-- -----------------------------------------------------------------------------
-- Funções internas
-- -----------------------------------------------------------------------------
create or replace function private.safe_inet(p text)
returns inet
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(trim(coalesce(p, '')), '')::inet;
exception when others then
  return null;
end;
$$;

-- Valida a sessão do portal. Erro PT401 se inválida (o PostgREST responde 401).
create or replace function private.portal_session(p_token text, p_slug text)
returns public.portal_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.portal_sessions;
begin
  select ps.* into s
  from public.portal_sessions ps
  join public.assistances a on a.id = ps.assistance_id
  where ps.token_hash = private.hash_token(p_token)
    and a.slug = lower(p_slug)
    and ps.revoked_at is null
    and ps.expires_at > now();

  if not found then
    raise exception 'Sua sessão expirou. Entre novamente.' using errcode = 'PT401';
  end if;

  if s.last_seen_at < now() - interval '5 minutes' then
    update public.portal_sessions set last_seen_at = now() where id = s.id;
  end if;

  perform set_config('app.portal_session_id', s.id::text, true);
  return s;
end;
$$;

-- -----------------------------------------------------------------------------
-- Funções públicas do portal (anon)
-- -----------------------------------------------------------------------------

-- Identidade pública da assistência (cabeçalho do portal).
create or replace function public.portal_assistance(p_slug text)
returns table (
  name text, slug text, logo_path text, brand_color text, phone text, whatsapp text, email text,
  address jsonb, business_hours text, welcome_message text, warranty_policy text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.name, a.slug, a.logo_path, a.brand_color, a.phone, a.whatsapp, a.email,
         a.address, a.business_hours, a.welcome_message, a.warranty_policy
  from public.assistances a
  where a.slug = lower(p_slug)
    and a.subscription_status not in ('suspended','canceled');
$$;

-- Login: telefone + código de acesso de qualquer OS ativa do cliente.
-- Nunca lança erro em falha (para que a tentativa fique registrada): devolve error.
create or replace function public.portal_login(
  p_slug text, p_phone text, p_code text, p_ip text default null, p_user_agent text default null)
returns table (token text, error_message text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_assistance uuid;
  v_phone   text := private.normalize_br_phone(p_phone);
  v_code    text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_ip      inet := private.safe_inet(p_ip);
  v_customer uuid;
  v_ok      boolean := false;
  v_token   text;
begin
  select a.id into v_assistance
  from public.assistances a
  where a.slug = lower(p_slug) and a.subscription_status not in ('suspended','canceled');

  if v_assistance is null then
    return query select null::text, 'Assistência não encontrada.'::text;
    return;
  end if;

  -- Limites contra força bruta
  if (select count(*) from public.portal_login_attempts t
      where t.assistance_id = v_assistance and t.phone_e164 = v_phone and not t.success
        and t.created_at > now() - interval '15 minutes') >= 5
     or (v_ip is not null and (select count(*) from public.portal_login_attempts t
      where t.ip = v_ip and not t.success and t.created_at > now() - interval '1 hour') >= 20) then
    return query select null::text, 'Muitas tentativas. Aguarde 15 minutos e tente novamente.'::text;
    return;
  end if;

  if v_phone is not null and length(v_code) = 6 then
    select c.id into v_customer
    from public.customers c
    where c.assistance_id = v_assistance and c.phone_e164 = v_phone and c.anonymized_at is null;

    if v_customer is not null then
      select true into v_ok
      from public.service_orders so
      where so.assistance_id = v_assistance
        and so.customer_id = v_customer
        and so.access_code = v_code
        and (so.status not in ('ENTREGUE','CANCELADO') or so.updated_at > now() - interval '90 days')
      limit 1;
    end if;
  end if;

  insert into public.portal_login_attempts (assistance_id, phone_e164, ip, success)
  values (v_assistance, v_phone, v_ip, coalesce(v_ok, false));

  if not coalesce(v_ok, false) then
    return query select null::text, 'Telefone ou código não conferem.'::text;
    return;
  end if;

  v_token := private.random_token();
  insert into public.portal_sessions (assistance_id, customer_id, token_hash, login_method, ip, user_agent)
  values (v_assistance, v_customer, private.hash_token(v_token), 'ACCESS_CODE', v_ip, left(p_user_agent, 500));

  return query select v_token, null::text;
end;
$$;

create or replace function public.portal_logout(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.portal_sessions set revoked_at = now()
  where token_hash = private.hash_token(p_token) and revoked_at is null;
$$;

-- Quem está logado (saudação no portal).
create or replace function public.portal_me(p_token text, p_slug text)
returns table (customer_name text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.portal_sessions := private.portal_session(p_token, p_slug);
begin
  return query
    select c.name, s.expires_at from public.customers c where c.id = s.customer_id;
end;
$$;

-- "Meus equipamentos": OS do cliente nesta assistência.
create or replace function public.portal_list_orders(p_token text, p_slug text)
returns table (
  code text, status text, outcome text, category text, brand text, model text,
  received_at timestamptz, estimated_completion_at timestamptz, delivered_at timestamptz,
  pending_budget_total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.portal_sessions := private.portal_session(p_token, p_slug);
begin
  return query
    select so.code, so.status, so.outcome, cat.name, e.brand, e.model,
           so.received_at, so.estimated_completion_at, so.delivered_at,
           (select b.total from public.budget_versions b
             where b.service_order_id = so.id and b.status = 'ENVIADO' limit 1)
    from public.service_orders so
    join public.equipment e on e.id = so.equipment_id
    join public.equipment_categories cat on cat.id = e.category_id
    where so.assistance_id = s.assistance_id      -- tenant vem da sessão
      and so.customer_id   = s.customer_id        -- cliente vem da sessão
    order by (so.status in ('ENTREGUE','CANCELADO')), so.received_at desc;
end;
$$;

-- Detalhe da OS: dados públicos, linha do tempo, fotos permitidas e orçamentos.
-- OS de outro cliente/assistência => null (a tela mostra "OS não encontrada").
create or replace function public.portal_get_order(p_token text, p_slug text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.portal_sessions := private.portal_session(p_token, p_slug);
  v_os public.service_orders;
  v_show_photos boolean;
begin
  select so.* into v_os
  from public.service_orders so
  where so.assistance_id = s.assistance_id
    and so.customer_id = s.customer_id
    and so.code = upper(p_code);

  if not found then
    return null;
  end if;

  select coalesce((a.settings ->> 'portal_show_photos')::boolean, true) into v_show_photos
  from public.assistances a where a.id = s.assistance_id;

  return jsonb_build_object(
    'code', v_os.code,
    'status', v_os.status,
    'outcome', v_os.outcome,
    'reported_issue', v_os.reported_issue,
    'customer_notes', v_os.customer_notes,
    'accessories', to_jsonb(v_os.accessories),
    'received_at', v_os.received_at,
    'estimated_completion_at', v_os.estimated_completion_at,
    'completed_at', v_os.completed_at,
    'delivered_at', v_os.delivered_at,
    'warranty_until', v_os.warranty_until,
    'equipment', (
      select jsonb_build_object('category', cat.name, 'brand', e.brand, 'model', e.model, 'color', e.color)
      from public.equipment e join public.equipment_categories cat on cat.id = e.category_id
      where e.id = v_os.equipment_id),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.to_status, 'note', h.note, 'at', h.created_at)
                       order by h.created_at)
      from public.service_order_status_history h
      where h.service_order_id = v_os.id and h.visible_to_customer), '[]'::jsonb),
    'photos', case when v_show_photos then coalesce((
      select jsonb_agg(jsonb_build_object('path', p.storage_path, 'kind', p.kind, 'stage', p.stage,
                                          'description', p.description) order by p.created_at)
      from public.service_order_photos p
      where p.service_order_id = v_os.id and p.visible_to_customer), '[]'::jsonb)
      else '[]'::jsonb end,
    'budgets', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'version', b.version, 'status', b.status, 'total', b.total,
               'sent_at', b.sent_at, 'valid_until', b.valid_until, 'decided_at', b.decided_at,
               'is_expired', (b.status = 'ENVIADO' and b.valid_until < private.today_br()))
               order by b.version desc)
      from public.budget_versions b
      where b.service_order_id = v_os.id and b.status in ('ENVIADO','APROVADO','RECUSADO')), '[]'::jsonb)
  );
end;
$$;

-- Proposta: a versão aguardando decisão (ou a pedida, ou a mais recente decidida).
create or replace function public.portal_get_budget(p_token text, p_slug text, p_code text, p_version int default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.portal_sessions := private.portal_session(p_token, p_slug);
  v_os_id uuid;
  v_b public.budget_versions;
begin
  select so.id into v_os_id
  from public.service_orders so
  where so.assistance_id = s.assistance_id and so.customer_id = s.customer_id and so.code = upper(p_code);

  if v_os_id is null then
    return null;
  end if;

  select b.* into v_b
  from public.budget_versions b
  where b.service_order_id = v_os_id
    and b.status in ('ENVIADO','APROVADO','RECUSADO')
    and (p_version is null or b.version = p_version)
  order by (b.status = 'ENVIADO') desc, b.version desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_b.id,
    'version', v_b.version,
    'status', v_b.status,
    'snapshot', v_b.snapshot,
    'content_hash', v_b.content_hash,
    'valid_until', v_b.valid_until,
    'is_expired', (v_b.status = 'ENVIADO' and v_b.valid_until < private.today_br()),
    'decided_at', v_b.decided_at,
    'decision_channel', v_b.decision_channel,
    'refusal_reason', v_b.refusal_reason
  );
end;
$$;

-- Aprovação/recusa pelo cliente. O hash garante que ele decidiu sobre o que viu.
create or replace function public.portal_decide_budget(
  p_token text, p_slug text, p_version_id uuid, p_content_hash text, p_decision text,
  p_reason text default null, p_ip text default null, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.portal_sessions := private.portal_session(p_token, p_slug);
  v_b public.budget_versions;
begin
  select b.* into v_b
  from public.budget_versions b
  join public.service_orders so on so.id = b.service_order_id
  where b.id = p_version_id
    and so.assistance_id = s.assistance_id
    and so.customer_id = s.customer_id;

  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0001';
  end if;

  if v_b.content_hash is distinct from p_content_hash then
    raise exception 'Este orçamento foi atualizado pela assistência. Recarregue a página para ver a versão atual.'
      using errcode = 'P0001';
  end if;

  perform private.apply_budget_decision(
    p_version_id, p_decision, 'PORTAL', p_reason, null, s.id, private.safe_inet(p_ip), p_user_agent, 'PORTAL');
end;
$$;

-- -----------------------------------------------------------------------------
-- Equipe: revogar acessos do cliente ao portal
-- -----------------------------------------------------------------------------
create or replace function public.revoke_customer_portal_sessions(p_customer_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin','technician','attendant']);
  v_count int;
begin
  update public.portal_sessions
     set revoked_at = now()
   where assistance_id = v_assistance and customer_id = p_customer_id and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Limpeza periódica (agendar com pg_cron — ver README).
create or replace function private.cleanup_portal()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.portal_login_attempts where created_at < now() - interval '7 days';
  delete from public.portal_sessions
   where (revoked_at is not null and revoked_at < now() - interval '30 days')
      or expires_at < now() - interval '30 days';
$$;

-- >>> 20261008120700_finance.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Conserta Já · 0008 · Caixa, fornecedores, indicadores e relatórios
-- O caixa só registra dinheiro real. "Previsto" e "a receber" são calculados
-- a partir dos orçamentos, nunca lançados.
-- =============================================================================

create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid not null default private.current_assistance_id()
                references public.assistances(id) on delete cascade,
  name          text not null,
  phone         text,
  document      text,
  notes         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint suppliers_tenant_id_unique unique (assistance_id, id),
  constraint suppliers_name_unique unique (assistance_id, name),
  constraint suppliers_name_check check (length(trim(name)) between 2 and 120)
);

create table public.cash_transactions (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null default private.current_assistance_id(),
  direction        text not null,
  category         text not null,
  amount           numeric(12,2) not null,
  occurred_at      timestamptz not null default now(),
  payment_method   text not null,
  description      text not null,
  quantity         numeric(10,3),
  service_order_id uuid,
  supplier_id      uuid,
  created_by       uuid not null default auth.uid() references public.profiles(id),
  created_at       timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references public.profiles(id),
  void_reason      text,
  constraint cash_os_fk foreign key (assistance_id, service_order_id)
    references public.service_orders (assistance_id, id),
  constraint cash_supplier_fk foreign key (assistance_id, supplier_id)
    references public.suppliers (assistance_id, id),
  constraint cash_direction_check check (direction in ('IN','OUT')),
  constraint cash_category_check check (category in (
    'RECEBIMENTO_OS','TAXA_DIAGNOSTICO','OUTRO_RECEBIMENTO',
    'COMPRA_PECA','FORNECEDOR','DESPESA_OPERACIONAL','ESTORNO','OUTRA_SAIDA')),
  constraint cash_direction_matches_category check (
    (direction = 'IN') = (category in ('RECEBIMENTO_OS','TAXA_DIAGNOSTICO','OUTRO_RECEBIMENTO'))),
  constraint cash_os_required check (
    category not in ('RECEBIMENTO_OS','TAXA_DIAGNOSTICO','ESTORNO') or service_order_id is not null),
  constraint cash_amount_positive check (amount > 0 and amount <= 9999999999.99),
  constraint cash_method_check check (payment_method in
    ('DINHEIRO','PIX','CARTAO_CREDITO','CARTAO_DEBITO','TRANSFERENCIA','BOLETO','OUTRO')),
  constraint cash_description_check check (length(trim(description)) between 2 and 300),
  constraint cash_quantity_positive check (quantity is null or quantity > 0),
  constraint cash_void_consistency check ((voided_at is null) = (void_reason is null))
);
create index cash_occurred_idx on public.cash_transactions (assistance_id, occurred_at desc);
create index cash_os_idx on public.cash_transactions (assistance_id, service_order_id);

-- Quem lançou é sempre o usuário logado.
create or replace function private.force_created_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger a_enforce_tenant before insert or update on public.suppliers
  for each row execute function private.enforce_tenant();
create trigger set_updated_at before update on public.suppliers
  for each row execute function private.set_updated_at();
create trigger z_audit after insert or update on public.suppliers
  for each row execute function private.audit();

create trigger a_enforce_tenant before insert or update on public.cash_transactions
  for each row execute function private.enforce_tenant();
create trigger b_force_created_by before insert on public.cash_transactions
  for each row execute function private.force_created_by();
create trigger z_audit after insert or update on public.cash_transactions
  for each row execute function private.audit();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.suppliers         enable row level security;
alter table public.cash_transactions enable row level security;

create policy suppliers_select on public.suppliers for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id())
              and (select private.has_role(array['owner','admin','technician'])));
create policy suppliers_update on public.suppliers for update to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin','technician'])))
  with check (assistance_id = (select private.current_assistance_id()));

-- owner/admin veem tudo; técnico e atendente só o que lançaram.
create policy cash_select on public.cash_transactions for select to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and ((select private.has_role(array['owner','admin'])) or created_by = (select auth.uid())));

create policy cash_insert on public.cash_transactions for insert to authenticated
  with check (
    assistance_id = (select private.current_assistance_id())
    and created_by = (select auth.uid())
    and (
      (select private.has_role(array['owner','admin']))
      or ((select private.has_role(array['technician','attendant']))
          and category in ('RECEBIMENTO_OS','TAXA_DIAGNOSTICO'))
      or ((select private.has_role(array['technician'])) and category = 'COMPRA_PECA')
    )
  );

revoke insert, update, delete on public.suppliers from authenticated;
grant insert (name, phone, document, notes) on public.suppliers to authenticated;
grant update (name, phone, document, notes, active) on public.suppliers to authenticated;

revoke insert, update, delete on public.cash_transactions from authenticated;
grant insert (direction, category, amount, occurred_at, payment_method, description, quantity,
              service_order_id, supplier_id)
  on public.cash_transactions to authenticated;

-- -----------------------------------------------------------------------------
-- Estorno lógico
-- -----------------------------------------------------------------------------
create or replace function public.void_cash_transaction(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin']);
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Informe o motivo da anulação.' using errcode = 'P0001';
  end if;

  perform set_config('app.audit_action', 'CASH_VOIDED', true);

  update public.cash_transactions
     set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
   where id = p_id and assistance_id = v_assistance and voided_at is null;

  if not found then
    raise exception 'Lançamento não encontrado ou já anulado.' using errcode = 'P0001';
  end if;
  perform private.reset_context();
end;
$$;

-- -----------------------------------------------------------------------------
-- Views financeiras (security_invoker: o RLS de quem consulta vale)
-- -----------------------------------------------------------------------------
create view public.v_cash_transactions with (security_invoker = true) as
select t.id, t.assistance_id, t.direction, t.category, t.amount, t.occurred_at, t.payment_method,
       t.description, t.quantity, t.service_order_id, so.code as service_order_code,
       t.supplier_id, s.name as supplier_name, t.created_by, p.full_name as created_by_name,
       t.created_at, t.voided_at, t.void_reason
from public.cash_transactions t
left join public.service_orders so on so.id = t.service_order_id
left join public.suppliers s on s.id = t.supplier_id
left join public.profiles p on p.id = t.created_by;

create view public.v_service_order_financials with (security_invoker = true) as
select so.id as service_order_id, so.assistance_id, so.code, so.status, so.outcome,
       so.received_at, so.delivered_at, c.name as customer_name,
       coalesce(ab.total, 0) as approved_total,
       coalesce(tx.received, 0) as received,
       coalesce(tx.costs, 0) as costs,
       case when so.status = 'CANCELADO' then 0
            else greatest(coalesce(ab.total, 0) - coalesce(tx.received, 0), 0) end as balance_due,
       coalesce(tx.received, 0) - coalesce(tx.costs, 0) as estimated_profit
from public.service_orders so
join public.customers c on c.id = so.customer_id
left join lateral (
  select b.total from public.budget_versions b
  where b.service_order_id = so.id and b.status = 'APROVADO'
  order by b.version desc limit 1
) ab on true
left join lateral (
  select sum(case when t.direction = 'IN' then t.amount
                  when t.category = 'ESTORNO' then -t.amount else 0 end) as received,
         sum(case when t.direction = 'OUT' and t.category <> 'ESTORNO' then t.amount else 0 end) as costs
  from public.cash_transactions t
  where t.service_order_id = so.id and t.voided_at is null
) tx on true;

-- -----------------------------------------------------------------------------
-- Saldo de uma OS (qualquer membro: usado na entrega e no recebimento)
-- -----------------------------------------------------------------------------
create or replace function public.service_order_balance(p_service_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin','technician','attendant']);
  v_status text;
  v_approved numeric := 0;
  v_received numeric := 0;
begin
  select so.status into v_status
  from public.service_orders so
  where so.id = p_service_order_id and so.assistance_id = v_assistance;

  if v_status is null then
    return null;
  end if;

  select coalesce((select b.total from public.budget_versions b
                   where b.service_order_id = p_service_order_id and b.status = 'APROVADO'
                   order by b.version desc limit 1), 0)
    into v_approved;

  select coalesce(sum(case when t.direction = 'IN' then t.amount
                           when t.category = 'ESTORNO' then -t.amount else 0 end), 0)
    into v_received
  from public.cash_transactions t
  where t.service_order_id = p_service_order_id and t.voided_at is null;

  return jsonb_build_object(
    'approved_total', v_approved,
    'received', v_received,
    'balance_due', case when v_status = 'CANCELADO' then 0 else greatest(v_approved - v_received, 0) end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Dashboard: OS para todos; financeiro só para owner/admin.
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin','technician','attendant']);
  v_fin boolean := private.has_role(array['owner','admin']);
  v_start timestamptz := (p_from::timestamp at time zone 'America/Sao_Paulo');
  v_end   timestamptz := ((p_to + 1)::timestamp at time zone 'America/Sao_Paulo');
  v_os jsonb;
  v_budgets jsonb;
  v_finance jsonb := null;
begin
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'Período inválido (máximo de 1 ano).' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'by_status', coalesce((
      select jsonb_object_agg(x.status, x.n) from (
        select so.status, count(*) as n from public.service_orders so
        where so.assistance_id = v_assistance and so.status not in ('ENTREGUE','CANCELADO')
        group by so.status) x), '{}'::jsonb),
    'open', (select count(*) from public.service_orders so
             where so.assistance_id = v_assistance and so.status not in ('ENTREGUE','CANCELADO')),
    'opened_in_period', (select count(*) from public.service_orders so
             where so.assistance_id = v_assistance and so.received_at >= v_start and so.received_at < v_end),
    'completed_in_period', (select count(*) from public.service_orders so
             where so.assistance_id = v_assistance and so.completed_at >= v_start and so.completed_at < v_end),
    'delivered_in_period', (select count(*) from public.service_orders so
             where so.assistance_id = v_assistance and so.delivered_at >= v_start and so.delivered_at < v_end),
    'overdue', (select count(*) from public.service_orders so
             where so.assistance_id = v_assistance and so.status not in ('PRONTO','ENTREGUE','CANCELADO')
               and so.estimated_completion_at < now())
  ) into v_os;

  select jsonb_build_object(
    'approved_in_period', (select count(*) from public.budget_versions b
       where b.assistance_id = v_assistance and b.status = 'APROVADO' and b.decided_at >= v_start and b.decided_at < v_end),
    'refused_in_period', (select count(*) from public.budget_versions b
       where b.assistance_id = v_assistance and b.status = 'RECUSADO' and b.decided_at >= v_start and b.decided_at < v_end),
    'pending', (select count(*) from public.budget_versions b
       where b.assistance_id = v_assistance and b.status = 'ENVIADO' and b.valid_until >= private.today_br())
  ) into v_budgets;

  if v_fin then
    select jsonb_build_object(
      'inflow', coalesce(sum(t.amount) filter (where t.direction = 'IN'), 0),
      'outflow', coalesce(sum(t.amount) filter (where t.direction = 'OUT'), 0),
      'balance', coalesce(sum(t.amount) filter (where t.direction = 'IN'), 0)
               - coalesce(sum(t.amount) filter (where t.direction = 'OUT'), 0),
      'revenue', coalesce(sum(t.amount) filter (where t.category in ('RECEBIMENTO_OS','TAXA_DIAGNOSTICO')), 0)
    ) into v_finance
    from public.cash_transactions t
    where t.assistance_id = v_assistance and t.voided_at is null
      and t.occurred_at >= v_start and t.occurred_at < v_end;

    v_finance := v_finance || jsonb_build_object(
      'forecast', (select coalesce(sum(b.total), 0) from public.budget_versions b
                   join public.service_orders so on so.id = b.service_order_id
                   where b.assistance_id = v_assistance and b.status = 'ENVIADO'
                     and b.valid_until >= private.today_br() and so.status <> 'CANCELADO'),
      'receivable', (select coalesce(sum(f.balance_due), 0) from public.v_service_order_financials f
                     where f.assistance_id = v_assistance and f.approved_total > 0),
      'average_ticket', (select coalesce(round(avg(f.approved_total), 2), 0) from public.v_service_order_financials f
                         where f.assistance_id = v_assistance and f.outcome = 'REPARADO'
                           and f.delivered_at >= v_start and f.delivered_at < v_end and f.approved_total > 0),
      'daily', coalesce((
        select jsonb_agg(jsonb_build_object('day', d.day, 'inflow', d.inflow, 'outflow', d.outflow) order by d.day)
        from (
          select g.day::date as day,
                 coalesce(sum(t.amount) filter (where t.direction = 'IN'), 0) as inflow,
                 coalesce(sum(t.amount) filter (where t.direction = 'OUT'), 0) as outflow
          from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g(day)
          left join public.cash_transactions t
            on t.assistance_id = v_assistance and t.voided_at is null
           and (t.occurred_at at time zone 'America/Sao_Paulo')::date = g.day::date
          group by g.day
        ) d), '[]'::jsonb)
    );
  end if;

  return jsonb_build_object('os', v_os, 'budgets', v_budgets, 'finance', v_finance, 'can_see_finance', v_fin);
end;
$$;

-- -----------------------------------------------------------------------------
-- Relatórios (owner/admin)
-- -----------------------------------------------------------------------------
create or replace function public.report_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin']);
  v_start timestamptz := (p_from::timestamp at time zone 'America/Sao_Paulo');
  v_end   timestamptz := ((p_to + 1)::timestamp at time zone 'America/Sao_Paulo');
begin
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'Período inválido (máximo de 1 ano).' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'inflow_by_method', coalesce((
      select jsonb_agg(jsonb_build_object('method', x.payment_method, 'total', x.total, 'count', x.n) order by x.total desc)
      from (select t.payment_method, sum(t.amount) as total, count(*) as n
            from public.cash_transactions t
            where t.assistance_id = v_assistance and t.voided_at is null and t.direction = 'IN'
              and t.occurred_at >= v_start and t.occurred_at < v_end
            group by t.payment_method) x), '[]'::jsonb),
    'outflow_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', x.category, 'total', x.total, 'count', x.n) order by x.total desc)
      from (select t.category, sum(t.amount) as total, count(*) as n
            from public.cash_transactions t
            where t.assistance_id = v_assistance and t.voided_at is null and t.direction = 'OUT'
              and t.occurred_at >= v_start and t.occurred_at < v_end
            group by t.category) x), '[]'::jsonb),
    'by_technician', coalesce((
      select jsonb_agg(jsonb_build_object('technician', x.name, 'delivered', x.n, 'approved_total', x.total) order by x.n desc)
      from (select coalesce(p.full_name, 'Sem técnico') as name, count(*) as n, sum(f.approved_total) as total
            from public.service_orders so
            join public.v_service_order_financials f on f.service_order_id = so.id
            left join public.profiles p on p.id = so.technician_id
            where so.assistance_id = v_assistance and so.delivered_at >= v_start and so.delivered_at < v_end
            group by 1) x), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', x.name, 'received', x.n) order by x.n desc)
      from (select cat.name, count(*) as n
            from public.service_orders so
            join public.equipment e on e.id = so.equipment_id
            join public.equipment_categories cat on cat.id = e.category_id
            where so.assistance_id = v_assistance and so.received_at >= v_start and so.received_at < v_end
            group by cat.name) x), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.service_order_id, 'code', f.code, 'customer', f.customer_name, 'approved_total', f.approved_total,
               'received', f.received, 'costs', f.costs, 'profit', f.estimated_profit) order by f.estimated_profit desc)
      from public.v_service_order_financials f
      where f.assistance_id = v_assistance and f.delivered_at >= v_start and f.delivered_at < v_end), '[]'::jsonb),
    'refusals', coalesce((
      select jsonb_agg(jsonb_build_object('code', so.code, 'version', b.version, 'total', b.total,
                                          'reason', b.refusal_reason, 'at', b.decided_at) order by b.decided_at desc)
      from public.budget_versions b
      join public.service_orders so on so.id = b.service_order_id
      where b.assistance_id = v_assistance and b.status = 'RECUSADO'
        and b.decided_at >= v_start and b.decided_at < v_end), '[]'::jsonb)
  );
end;
$$;

-- >>> 20261008120800_grants.sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Conserta Já · 0009 · Permissões finais
-- O Supabase concede tudo a anon/authenticated por padrão; aqui fechamos e
-- liberamos só o necessário. O RLS continua sendo a barreira principal.
-- =============================================================================

-- anon (visitante do portal) não lê nem grava nenhuma tabela ou view.
revoke all on all tables in schema public from anon;

-- Funções: ninguém executa nada por padrão...
revoke execute on all functions in schema public from public, anon, authenticated;

-- ...equipe logada
grant execute on function public.create_assistance(text, text)                 to authenticated;
grant execute on function public.my_assistances()                              to authenticated;
grant execute on function public.switch_assistance(uuid)                       to authenticated;
grant execute on function public.create_invitation(text, text)                 to authenticated;
grant execute on function public.accept_invitation(text)                       to authenticated;
grant execute on function public.team_members()                                to authenticated;
grant execute on function public.anonymize_customer(uuid)                      to authenticated;
grant execute on function public.create_service_order(jsonb)                   to authenticated;
grant execute on function public.change_service_order_status(uuid, text, text) to authenticated;
grant execute on function public.regenerate_access_code(uuid)                  to authenticated;
grant execute on function public.create_budget_version(uuid)                   to authenticated;
grant execute on function public.send_budget_version(uuid, int)                to authenticated;
grant execute on function public.staff_decide_budget(uuid, text, text, text)   to authenticated;
grant execute on function public.revoke_customer_portal_sessions(uuid)         to authenticated;
grant execute on function public.void_cash_transaction(uuid, text)             to authenticated;
grant execute on function public.service_order_balance(uuid)                   to authenticated;
grant execute on function public.dashboard_summary(date, date)                 to authenticated;
grant execute on function public.report_summary(date, date)                    to authenticated;

-- ...portal do cliente (o servidor Next.js chama com a chave publishable)
grant execute on function public.invitation_preview(text)                                       to anon, authenticated;
grant execute on function public.portal_assistance(text)                                        to anon, authenticated;
grant execute on function public.portal_login(text, text, text, text, text)                     to anon, authenticated;
grant execute on function public.portal_logout(text)                                            to anon, authenticated;
grant execute on function public.portal_me(text, text)                                          to anon, authenticated;
grant execute on function public.portal_list_orders(text, text)                                 to anon, authenticated;
grant execute on function public.portal_get_order(text, text, text)                             to anon, authenticated;
grant execute on function public.portal_get_budget(text, text, text, int)                       to anon, authenticated;
grant execute on function public.portal_decide_budget(text, text, uuid, text, text, text, text, text) to anon, authenticated;

-- Funções auxiliares usadas dentro de funções SECURITY INVOKER
grant execute on function private.set_status_context(text, text, boolean) to authenticated;

-- service_role (scripts administrativos) mantém acesso total
grant execute on all functions in schema public  to service_role;
grant execute on all functions in schema private to service_role;

-- >>> histórico de migrations (o mesmo que a Supabase CLI usa) >>>>>>>>>>>>>>>>>
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version    text not null primary key,
  statements text[],
  name       text
);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261008120000', 'base'),
  ('20261008120100', 'tenancy'),
  ('20261008120200', 'customers_equipment'),
  ('20261008120300', 'service_orders'),
  ('20261008120400', 'storage'),
  ('20261008120500', 'budgets'),
  ('20261008120600', 'portal'),
  ('20261008120700', 'finance'),
  ('20261008120800', 'grants')
on conflict (version) do nothing;

commit;

-- Atualiza o cache da API REST para enxergar as tabelas e funções novas.
notify pgrst, 'reload schema';
