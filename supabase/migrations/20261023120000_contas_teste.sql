-- =============================================================================
-- TecnoFix · 0019 · Contas de teste da aplicação (criadas pela área admin)
--
-- - A conta master da área admin cria contas de teste prontas para usar
--   (login + assistência). Também pode marcar uma assistência já existente como
--   teste (desde que não tenha assinatura vigente no Mercado Pago).
-- - Conta de teste não conta como assistência: fica fora dos números, das listas
--   e da planilha da área admin.
-- - O plano da conta de teste é escolhido na área admin: 'pro' (tudo liberado) ou
--   'free' (vê o sistema como o cliente do plano Grátis). Não tem cobrança e não
--   pode assinar.
-- - Só conta de teste pode ser excluída. A exclusão apaga tudo da assistência na
--   ordem certa (OS, orçamentos, caixa, clientes...). As fotos e a logo são
--   apagadas antes pelo servidor, pela API do Storage (o Supabase não deixa apagar
--   arquivos por SQL), e os logins que só existiam nela são apagados depois.
-- Tudo aqui é executado só pelo servidor (service_role).
-- =============================================================================

alter table public.assistances
  add column if not exists is_test boolean not null default false,
  add column if not exists test_plan text;

alter table public.assistances
  add constraint assistances_test_plan_check
  check ((is_test and test_plan in ('pro', 'free')) or (not is_test and test_plan is null));

-- -----------------------------------------------------------------------------
-- Situação de acesso: conta de teste segue o plano escolhido na área admin
-- -----------------------------------------------------------------------------
create or replace function private.billing_access(p_assistance_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.assistances;
begin
  select * into a from public.assistances where id = p_assistance_id;
  if not found or a.subscription_status = 'suspended' then
    return 'blocked';
  end if;
  if a.is_test then
    return case a.test_plan when 'free' then 'free' else 'active' end;
  end if;
  if a.paid_until is not null and a.paid_until > now() then
    return 'active';
  end if;
  if a.paid_until is not null and a.subscription_status in ('active','past_due')
     and a.paid_until + interval '7 days' > now() then
    return 'grace';
  end if;
  if a.trial_ends_at > now() then
    return 'trial';
  end if;
  -- Assinou durante o teste: a 1ª cobrança é no fim do teste. Tolerância até ela ser confirmada.
  if a.mp_preapproval_id is not null and a.paid_until is null and a.subscription_status = 'trialing'
     and a.trial_ends_at + interval '7 days' > now() then
    return 'grace';
  end if;
  return 'free';
end;
$$;

create or replace function public.billing_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.current_assistance_id();
  a public.assistances;
  v_pending public.billing_subscriptions;
  v_access text;
begin
  if v_assistance is null then
    raise exception 'Nenhuma assistência ativa. Entre novamente.' using errcode = '42501';
  end if;
  select * into a from public.assistances where id = v_assistance;
  select * into v_pending from public.billing_subscriptions s
   where s.assistance_id = v_assistance and s.status = 'pending'
   order by s.created_at desc limit 1;
  v_access := private.billing_access(v_assistance);

  return jsonb_build_object(
    'access', v_access,
    'plan', case v_access when 'free' then 'free' when 'blocked' then 'blocked' else 'pro' end,
    'is_test', a.is_test,
    'test_plan', a.test_plan,
    'os_month', private.os_this_month(v_assistance),
    'os_limit', private.free_os_limit(),
    'month_resets_at', private.month_start_br() + interval '1 month',
    'trial_ends_at', a.trial_ends_at,
    'trial_days_left', greatest(0, ceil(extract(epoch from (a.trial_ends_at - now())) / 86400))::int,
    'status', a.subscription_status,
    'cycle', a.billing_cycle,
    'paid_until', a.paid_until,
    'past_due_since', a.past_due_since,
    'has_subscription', not a.is_test and a.mp_preapproval_id is not null and a.subscription_status <> 'canceled',
    'pending_checkout', not a.is_test and v_pending.id is not null,
    'can_manage', private.has_role(array['owner','admin'])
  );
end;
$$;

-- Conta de teste não assina (barreira no banco, além da tela e do servidor).
create or replace function public.billing_register_checkout(
  p_assistance_id uuid, p_provider_id text, p_cycle text, p_amount numeric,
  p_payer_email text, p_checkout_url text, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.assistances a where a.id = p_assistance_id and a.is_test) then
    raise exception 'Conta de teste do TecnoFix não tem assinatura. O plano é definido na área admin.' using errcode = 'P0001';
  end if;
  insert into public.billing_subscriptions
    (assistance_id, provider, provider_id, cycle, amount, payer_email, status, checkout_url, created_by)
  values
    (p_assistance_id, 'mercadopago', p_provider_id, p_cycle, p_amount, lower(trim(p_payer_email)), 'pending', p_checkout_url, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Itens de orçamento: a exclusão de uma conta de teste pode apagar orçamentos já
-- enviados. Fora dela, a regra continua: itens só mudam enquanto é RASCUNHO.
-- (A marca 'tecnofix.purge_assistance' só é ligada por admin_purge_test_assistance,
-- dentro da própria transação; a API não tem como ligá-la.)
-- -----------------------------------------------------------------------------
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
  if tg_op = 'DELETE' and current_setting('tecnofix.purge_assistance', true) = old.assistance_id::text then
    return old;
  end if;

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

-- -----------------------------------------------------------------------------
-- Área admin: listas com a marca de teste
-- -----------------------------------------------------------------------------
drop function public.admin_assistances();
create function public.admin_assistances()
returns table (
  id uuid, name text, slug text, created_at timestamptz,
  phone text, whatsapp text, email text, document text, address jsonb, has_logo boolean,
  subscription_status text, access text, trial_ends_at timestamptz, paid_until timestamptz,
  billing_cycle text, mp_preapproval_id text, past_due_since timestamptz, billing_synced_at timestamptz,
  subscription_amount numeric, subscription_mp_status text,
  owner_id uuid, owner_name text, owner_email text, owner_phone text, owner_last_sign_in timestamptz,
  members int, active_members int, customers int, orders int, orders_30d int, open_orders int,
  last_order_at timestamptz, is_test boolean, test_plan text
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
    (select max(so.created_at) from public.service_orders so where so.assistance_id = a.id),
    a.is_test, a.test_plan
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
               'assistance_id', a.id, 'name', a.name, 'role', m.role, 'active', m.active,
               'is_test', a.is_test) order by a.name)
        from public.assistance_members m
        join public.assistances a on a.id = m.assistance_id
       where m.user_id = u.id
    ), '[]'::jsonb)
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
$$;

-- -----------------------------------------------------------------------------
-- Cria a assistência de uma conta de teste para um login recém-criado
-- (o login é criado antes pelo servidor, na API de administração do Auth).
-- -----------------------------------------------------------------------------
create or replace function public.admin_create_test_assistance(
  p_user_id uuid, p_name text, p_slug text, p_plan text, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text := lower(trim(coalesce(p_slug, '')));
  v_slug text;
  v_id   uuid;
  i      int := 1;
begin
  if p_plan is null or p_plan not in ('pro', 'free') then
    raise exception 'Plano inválido.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Login não encontrado.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.assistance_members m where m.user_id = p_user_id) then
    raise exception 'Este login já participa de uma assistência.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'Informe o nome da assistência (2 a 120 letras).' using errcode = 'P0001';
  end if;
  if v_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_base) < 3 then
    v_base := 'teste';
  end if;
  v_base := left(v_base, 44);

  -- Endereço do portal livre: nome, nome-2, nome-3...
  v_slug := v_base;
  while v_slug = any (private.reserved_slugs())
     or exists (select 1 from public.assistances a where a.slug = v_slug) loop
    i := i + 1;
    if i > 200 then
      raise exception 'Não foi possível escolher um endereço para o portal.' using errcode = 'P0001';
    end if;
    v_slug := v_base || '-' || i;
  end loop;

  perform private.ensure_profile(p_user_id);

  insert into public.assistances (name, slug, is_test, test_plan, trial_ends_at)
  values (trim(p_name), v_slug, true, p_plan, now())
  returning id into v_id;

  insert into public.assistance_members (assistance_id, user_id, role)
  values (v_id, p_user_id, 'owner');

  update public.profiles
     set active_assistance_id = v_id,
         full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
   where id = p_user_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Marca/desmarca uma assistência como teste e troca o plano da conta de teste
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_test_assistance(p_id uuid, p_is_test boolean, p_plan text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.assistances;
begin
  select * into a from public.assistances where id = p_id for update;
  if not found then
    raise exception 'Assistência não encontrada.' using errcode = 'P0002';
  end if;
  if p_is_test then
    if p_plan is null or p_plan not in ('pro', 'free') then
      raise exception 'Plano inválido.' using errcode = 'P0001';
    end if;
    if not a.is_test and a.mp_preapproval_id is not null and a.subscription_status <> 'canceled' then
      raise exception 'Esta assistência tem assinatura no Mercado Pago. Cancele a assinatura antes de marcar como teste.'
        using errcode = 'P0001';
    end if;
    update public.assistances set is_test = true, test_plan = p_plan where id = p_id;
  else
    update public.assistances set is_test = false, test_plan = null where id = p_id;
  end if;
end;
$$;

-- Arquivos (fotos das OS e logo) de uma conta de teste, para o servidor apagar pela API do Storage.
create or replace function public.admin_test_assistance_files(p_id uuid)
returns table (bucket_id text, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.assistances a where a.id = p_id and a.is_test) then
    raise exception 'Só contas de teste podem ser excluídas.' using errcode = 'P0001';
  end if;
  return query
    select o.bucket_id::text, o.name::text
      from storage.objects o
     where o.bucket_id in ('service-order-photos', 'logos')
       and (storage.foldername(o.name))[1] = p_id::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- Exclui uma conta de teste com tudo o que ela tem. Devolve os logins que ficaram
-- sem nenhuma assistência (o servidor apaga esses logins na API do Auth).
-- -----------------------------------------------------------------------------
create or replace function public.admin_purge_test_assistance(p_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  a         public.assistances;
  v_members uuid[];
begin
  select * into a from public.assistances where id = p_id for update;
  if not found then
    raise exception 'Assistência não encontrada.' using errcode = 'P0002';
  end if;
  if not a.is_test then
    raise exception 'Só contas de teste podem ser excluídas.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(m.user_id), '{}') into v_members
    from public.assistance_members m where m.assistance_id = p_id;

  perform set_config('tecnofix.purge_assistance', p_id::text, true);

  -- Ordem: quem aponta para OS, clientes e fornecedores sai primeiro.
  delete from public.cash_transactions      where assistance_id = p_id;
  delete from public.budget_versions        where assistance_id = p_id;
  delete from public.service_order_photos   where assistance_id = p_id;
  delete from public.service_orders         where assistance_id = p_id;
  delete from public.equipment              where assistance_id = p_id;
  delete from public.customers              where assistance_id = p_id;
  delete from public.suppliers              where assistance_id = p_id;
  delete from public.assistance_invitations where assistance_id = p_id;
  -- O resto (equipe, contadores, categorias, histórico, assinaturas, portal) sai em cascata.
  delete from public.assistances            where id = p_id;

  perform set_config('tecnofix.purge_assistance', '', true);

  return coalesce((
    select array_agg(u) from unnest(v_members) u
     where not exists (select 1 from public.assistance_members m where m.user_id = u)
  ), '{}');
end;
$$;

revoke execute on function public.admin_assistances() from public, anon, authenticated;
revoke execute on function public.admin_users() from public, anon, authenticated;
revoke execute on function public.admin_create_test_assistance(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.admin_set_test_assistance(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.admin_test_assistance_files(uuid) from public, anon, authenticated;
revoke execute on function public.admin_purge_test_assistance(uuid) from public, anon, authenticated;
revoke execute on function public.billing_register_checkout(uuid, text, text, numeric, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_assistances() to service_role;
grant execute on function public.admin_users() to service_role;
grant execute on function public.admin_create_test_assistance(uuid, text, text, text, text) to service_role;
grant execute on function public.admin_set_test_assistance(uuid, boolean, text) to service_role;
grant execute on function public.admin_test_assistance_files(uuid) to service_role;
grant execute on function public.admin_purge_test_assistance(uuid) to service_role;
grant execute on function public.billing_register_checkout(uuid, text, text, numeric, text, text, uuid) to service_role;
