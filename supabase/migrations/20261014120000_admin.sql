-- =============================================================================
-- TecnoFix · 0015 · Área administrativa (dono do TecnoFix)
--
-- Visão de todas as assistências, donos, equipe, uso e vencimentos, e ações de
-- gestão (estender teste, suspender/reativar). Tudo aqui é lido e gravado só pelo
-- servidor com a CHAVE SECRETA (service_role). A equipe das assistências (anon e
-- authenticated) não lê as tabelas nem executa as funções.
-- O login da área admin é separado (usuário e senha nas variáveis da Vercel).
-- =============================================================================

-- Registro das ações feitas na área admin (quem, o quê, em qual assistência).
create table public.admin_audit_log (
  id             bigint generated always as identity primary key,
  admin_username text not null,
  action         text not null,
  assistance_id  uuid references public.assistances(id) on delete set null,
  details        jsonb not null default '{}'::jsonb,
  ip             inet,
  created_at     timestamptz not null default now()
);
create index admin_audit_log_assistance_idx on public.admin_audit_log (assistance_id, created_at desc);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- Tentativas de login na área admin (limite contra força bruta).
create table public.admin_login_attempts (
  id         bigint generated always as identity primary key,
  username   text,
  ip         inet,
  success    boolean not null,
  created_at timestamptz not null default now()
);
create index admin_login_attempts_created_idx on public.admin_login_attempts (created_at desc);
create index admin_login_attempts_ip_idx on public.admin_login_attempts (ip, created_at desc);

alter table public.admin_audit_log enable row level security;
alter table public.admin_login_attempts enable row level security;
-- Sem policies: só a service_role (que ignora o RLS) acessa.
revoke all on public.admin_audit_log, public.admin_login_attempts from public, anon, authenticated;
grant select, insert on public.admin_audit_log, public.admin_login_attempts to service_role;

-- -----------------------------------------------------------------------------
-- Lista de assistências com dono, situação da assinatura e uso
-- -----------------------------------------------------------------------------
create or replace function public.admin_assistances()
returns table (
  id uuid, name text, slug text, created_at timestamptz,
  phone text, whatsapp text, email text, document text, address jsonb, has_logo boolean,
  subscription_status text, access text, trial_ends_at timestamptz, paid_until timestamptz,
  billing_cycle text, mp_preapproval_id text, past_due_since timestamptz, billing_synced_at timestamptz,
  subscription_amount numeric, subscription_mp_status text,
  owner_id uuid, owner_name text, owner_email text, owner_phone text, owner_last_sign_in timestamptz,
  members int, active_members int, customers int, orders int, orders_30d int, open_orders int,
  last_order_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id, a.name, a.slug, a.created_at,
    a.phone, a.whatsapp, a.email, a.document, a.address, a.logo_path is not null,
    a.subscription_status, private.billing_access(a.id), a.trial_ends_at, a.paid_until,
    a.billing_cycle, a.mp_preapproval_id, a.past_due_since, a.billing_synced_at,
    s.amount, s.status,
    o.user_id, p.full_name, u.email::text, p.phone, u.last_sign_in_at,
    (select count(*) from public.assistance_members m where m.assistance_id = a.id)::int,
    (select count(*) from public.assistance_members m where m.assistance_id = a.id and m.active)::int,
    (select count(*) from public.customers c where c.assistance_id = a.id)::int,
    (select count(*) from public.service_orders so where so.assistance_id = a.id)::int,
    (select count(*) from public.service_orders so where so.assistance_id = a.id and so.created_at > now() - interval '30 days')::int,
    (select count(*) from public.service_orders so where so.assistance_id = a.id and so.status not in ('ENTREGUE','CANCELADO'))::int,
    (select max(so.created_at) from public.service_orders so where so.assistance_id = a.id)
  from public.assistances a
  left join lateral (
    select m.user_id from public.assistance_members m
     where m.assistance_id = a.id and m.role = 'owner'
     order by m.created_at limit 1
  ) o on true
  left join public.profiles p on p.id = o.user_id
  left join auth.users u on u.id = o.user_id
  left join public.billing_subscriptions s on s.provider = 'mercadopago' and s.provider_id = a.mp_preapproval_id
  order by a.created_at desc;
$$;

-- -----------------------------------------------------------------------------
-- Todas as pessoas cadastradas (inclusive quem ainda não criou assistência)
-- -----------------------------------------------------------------------------
create or replace function public.admin_users()
returns table (
  id uuid, email text, full_name text, phone text, created_at timestamptz,
  last_sign_in_at timestamptz, email_confirmed_at timestamptz, memberships jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id, u.email::text, p.full_name, p.phone, u.created_at, u.last_sign_in_at, u.email_confirmed_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'assistance_id', a.id, 'name', a.name, 'role', m.role, 'active', m.active) order by a.name)
        from public.assistance_members m
        join public.assistances a on a.id = m.assistance_id
       where m.user_id = u.id
    ), '[]'::jsonb)
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
$$;

-- -----------------------------------------------------------------------------
-- Equipe de uma assistência (com e-mail e último acesso)
-- -----------------------------------------------------------------------------
create or replace function public.admin_assistance_members(p_assistance_id uuid)
returns table (
  user_id uuid, full_name text, email text, phone text, role text, active boolean,
  joined_at timestamptz, last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, p.full_name, u.email::text, p.phone, m.role, m.active, m.created_at, u.last_sign_in_at
  from public.assistance_members m
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.assistance_id = p_assistance_id
  order by case m.role when 'owner' then 0 when 'admin' then 1 when 'technician' then 2 else 3 end, p.full_name;
$$;

revoke execute on function public.admin_assistances() from public, anon, authenticated;
revoke execute on function public.admin_users() from public, anon, authenticated;
revoke execute on function public.admin_assistance_members(uuid) from public, anon, authenticated;
grant execute on function public.admin_assistances() to service_role;
grant execute on function public.admin_users() to service_role;
grant execute on function public.admin_assistance_members(uuid) to service_role;
