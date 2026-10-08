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
