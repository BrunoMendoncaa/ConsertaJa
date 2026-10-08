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
