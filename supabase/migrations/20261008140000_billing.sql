-- =============================================================================
-- Conserta Já · 0011 · Assinatura do Conserta Já (teste grátis + Mercado Pago)
--
-- Regras:
-- - Toda assistência nova ganha 14 dias de teste, sem cartão. Quem já é dono de
--   outra assistência herda o fim do teste dela (não dá para "renovar" o teste
--   criando outra assistência).
-- - Plano único: R$ 49/mês ou R$ 490/ano, cobrado pelo Mercado Pago.
-- - Sem teste e sem pagamento em dia (com 7 dias de tolerância): a conta continua
--   vendo, imprimindo e concluindo o que já existe, mas não abre OS nova nem
--   convida pessoas. O portal dos clientes continua funcionando.
-- - Dados de cobrança só mudam pelo servidor (chave secreta), depois de conferir
--   no Mercado Pago. A equipe só lê.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Colunas de cobrança na assistência
-- -----------------------------------------------------------------------------
alter table public.assistances
  add column trial_ends_at      timestamptz,
  add column billing_cycle      text,
  add column paid_until         timestamptz,
  add column mp_preapproval_id  text,
  add column past_due_since     timestamptz,
  add column billing_synced_at  timestamptz;

-- Quem já usa o sistema ganha 14 dias a partir de agora.
update public.assistances set trial_ends_at = now() + interval '14 days' where trial_ends_at is null;

alter table public.assistances
  alter column trial_ends_at set default now() + interval '14 days',
  alter column trial_ends_at set not null,
  add constraint assistances_billing_cycle_check check (billing_cycle is null or billing_cycle in ('monthly','yearly'));

-- Teste não se renova criando outra assistência.
create or replace function private.inherit_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous timestamptz;
begin
  if auth.uid() is not null then
    select min(a.trial_ends_at) into v_previous
    from public.assistances a
    join public.assistance_members m on m.assistance_id = a.id
    where m.user_id = auth.uid() and m.role = 'owner';
    if v_previous is not null then
      new.trial_ends_at := least(new.trial_ends_at, v_previous);
    end if;
  end if;
  return new;
end;
$$;

create trigger a_inherit_trial before insert on public.assistances
  for each row execute function private.inherit_trial();

-- -----------------------------------------------------------------------------
-- Assinaturas e pagamentos (espelho do Mercado Pago)
-- -----------------------------------------------------------------------------
create table public.billing_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid not null references public.assistances(id) on delete cascade,
  provider      text not null default 'mercadopago',
  provider_id   text not null,
  cycle         text not null,
  amount        numeric(12,2) not null,
  payer_email   text not null,
  status        text not null default 'pending',
  checkout_url  text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_synced_at timestamptz,
  constraint billing_subscriptions_provider_unique unique (provider, provider_id),
  constraint billing_subscriptions_cycle_check check (cycle in ('monthly','yearly')),
  constraint billing_subscriptions_amount_check check (amount > 0),
  constraint billing_subscriptions_status_check check (status in ('pending','authorized','paused','cancelled'))
);
create index billing_subscriptions_assistance_idx on public.billing_subscriptions (assistance_id, created_at desc);

create table public.billing_payments (
  id              uuid primary key default gen_random_uuid(),
  assistance_id   uuid not null references public.assistances(id) on delete cascade,
  subscription_id uuid not null references public.billing_subscriptions(id) on delete cascade,
  provider_id     text not null,
  payment_id      text,
  amount          numeric(12,2) not null,
  status          text not null,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint billing_payments_provider_unique unique (subscription_id, provider_id)
);
create index billing_payments_assistance_idx on public.billing_payments (assistance_id, created_at desc);

create trigger set_updated_at before update on public.billing_subscriptions
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.billing_payments
  for each row execute function private.set_updated_at();
create trigger z_audit after insert or update on public.billing_subscriptions
  for each row execute function private.audit();

alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments      enable row level security;

-- Só proprietário e administrador veem a cobrança; ninguém grava pela API.
create policy billing_subscriptions_select on public.billing_subscriptions for select to authenticated
  using (assistance_id = (select private.current_assistance_id()) and (select private.has_role(array['owner','admin'])));
create policy billing_payments_select on public.billing_payments for select to authenticated
  using (assistance_id = (select private.current_assistance_id()) and (select private.has_role(array['owner','admin'])));

revoke all on public.billing_subscriptions, public.billing_payments from anon;
revoke insert, update, delete on public.billing_subscriptions, public.billing_payments from authenticated;

-- -----------------------------------------------------------------------------
-- Situação de acesso
--   trial   → no teste grátis (mesmo já tendo assinado: a 1ª cobrança é no fim do teste)
--   active  → pago até paid_until
--   grace   → pagamento atrasado (ou 1ª cobrança ainda não confirmada), dentro de 7 dias
--   blocked → sem teste e sem pagamento: não abre OS nova nem convida
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
  return 'blocked';
end;
$$;

grant execute on function private.billing_access(uuid) to authenticated, service_role;

-- Barreira no banco: equipe sem acesso não abre OS nem convida (portal e sistema não são afetados).
create or replace function private.enforce_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and private.billing_access(new.assistance_id) = 'blocked' then
    raise exception 'O teste grátis terminou. Assine o Conserta Já em "Meu plano" para abrir novas OS e convidar a equipe.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger c_enforce_billing before insert on public.service_orders
  for each row execute function private.enforce_billing();
create trigger c_enforce_billing before insert on public.assistance_invitations
  for each row execute function private.enforce_billing();

-- Resumo para a tela (qualquer membro vê se a conta está liberada).
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
begin
  if v_assistance is null then
    raise exception 'Nenhuma assistência ativa. Entre novamente.' using errcode = '42501';
  end if;
  select * into a from public.assistances where id = v_assistance;
  select * into v_pending from public.billing_subscriptions s
   where s.assistance_id = v_assistance and s.status = 'pending'
   order by s.created_at desc limit 1;

  return jsonb_build_object(
    'access', private.billing_access(v_assistance),
    'trial_ends_at', a.trial_ends_at,
    'trial_days_left', greatest(0, ceil(extract(epoch from (a.trial_ends_at - now())) / 86400))::int,
    'status', a.subscription_status,
    'cycle', a.billing_cycle,
    'paid_until', a.paid_until,
    'past_due_since', a.past_due_since,
    'has_subscription', a.mp_preapproval_id is not null and a.subscription_status <> 'canceled',
    'pending_checkout', v_pending.id is not null,
    'can_manage', private.has_role(array['owner','admin'])
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Funções do servidor (chave secreta). A equipe NÃO executa.
-- -----------------------------------------------------------------------------

-- Registra a assinatura criada no Mercado Pago (antes de o cliente pagar).
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
  insert into public.billing_subscriptions
    (assistance_id, provider, provider_id, cycle, amount, payer_email, status, checkout_url, created_by)
  values
    (p_assistance_id, 'mercadopago', p_provider_id, p_cycle, p_amount, lower(trim(p_payer_email)), 'pending', p_checkout_url, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Aplica o que o Mercado Pago informou (status da assinatura + faturas) e
-- recalcula a situação da assistência. Idempotente: pode rodar várias vezes.
-- p_payments: [{ "id": "...", "payment_id": "...", "amount": 49, "status": "approved", "paid_at": "..." }]
create or replace function public.billing_apply_sync(
  p_provider_id text, p_external_reference text, p_status text, p_payments jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.billing_subscriptions;
  a public.assistances;
  p jsonb;
  v_last_paid timestamptz;
  v_cycle text;
  v_paid_until timestamptz;
  v_new_status text;
begin
  select * into s from public.billing_subscriptions
   where provider = 'mercadopago' and provider_id = p_provider_id
   for update;
  if not found then
    raise exception 'Assinatura desconhecida: %', p_provider_id using errcode = 'P0001';
  end if;
  -- A referência enviada ao Mercado Pago na criação precisa bater com a assistência.
  if p_external_reference is distinct from s.assistance_id::text then
    raise exception 'Referência da assinatura não confere.' using errcode = 'P0001';
  end if;
  if p_status not in ('pending','authorized','paused','cancelled') then
    raise exception 'Status de assinatura inválido: %', p_status using errcode = 'P0001';
  end if;

  update public.billing_subscriptions
     set status = p_status, last_synced_at = now()
   where id = s.id;

  for p in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    insert into public.billing_payments
      (assistance_id, subscription_id, provider_id, payment_id, amount, status, paid_at)
    values
      (s.assistance_id, s.id, p ->> 'id', nullif(p ->> 'payment_id', ''), (p ->> 'amount')::numeric,
       p ->> 'status', nullif(p ->> 'paid_at', '')::timestamptz)
    on conflict (subscription_id, provider_id) do update
      set payment_id = excluded.payment_id, amount = excluded.amount,
          status = excluded.status, paid_at = excluded.paid_at;
  end loop;

  -- Pago até: último pagamento aprovado (de qualquer assinatura) + o ciclo dela.
  select bp.paid_at, bs.cycle into v_last_paid, v_cycle
  from public.billing_payments bp
  join public.billing_subscriptions bs on bs.id = bp.subscription_id
  where bp.assistance_id = s.assistance_id and bp.status = 'approved' and bp.paid_at is not null
  order by bp.paid_at desc
  limit 1;

  if v_last_paid is not null then
    v_paid_until := v_last_paid + case v_cycle when 'yearly' then interval '1 year' else interval '1 month' end;
  end if;

  select * into a from public.assistances where id = s.assistance_id for update;

  -- Só a assinatura vigente (ou uma que acabou de ser autorizada) muda o status da conta.
  if p_status = 'authorized' or a.mp_preapproval_id = p_provider_id then
    v_new_status := case
      when a.subscription_status = 'suspended' then 'suspended'
      when p_status = 'cancelled' then 'canceled'
      when p_status = 'paused' then 'past_due'
      when p_status = 'authorized' and v_paid_until is not null and v_paid_until > now() then 'active'
      when p_status = 'authorized' and v_paid_until is not null then 'past_due'
      else a.subscription_status   -- autorizada sem pagamento ainda, ou pendente
    end;

    update public.assistances
       set subscription_status = v_new_status,
           mp_preapproval_id = case when p_status in ('authorized','paused','cancelled') then p_provider_id else mp_preapproval_id end,
           billing_cycle = case when p_status = 'authorized' then s.cycle else billing_cycle end,
           plan = case when v_new_status in ('active','past_due') then 'paid' else plan end,
           past_due_since = case
             when v_new_status = 'past_due' then coalesce(past_due_since, now())
             else null end,
           paid_until = greatest(paid_until, v_paid_until),
           billing_synced_at = now()
     where id = s.assistance_id;
  else
    update public.assistances
       set paid_until = greatest(paid_until, v_paid_until), billing_synced_at = now()
     where id = s.assistance_id;
  end if;

  return private.billing_access(s.assistance_id);
end;
$$;

revoke execute on function public.billing_register_checkout(uuid, text, text, numeric, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.billing_apply_sync(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.billing_register_checkout(uuid, text, text, numeric, text, text, uuid) to service_role;
grant execute on function public.billing_apply_sync(text, text, text, jsonb) to service_role;
revoke execute on function public.billing_status() from public, anon;
grant execute on function public.billing_status() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Portal: assinatura cancelada não tira o portal dos clientes do ar
-- (só a suspensão manual pelo Conserta Já tira).
-- -----------------------------------------------------------------------------
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
    and a.subscription_status <> 'suspended';
$$;

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
  where a.slug = lower(p_slug) and a.subscription_status <> 'suspended';

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
        and (so.status not in ('ENTREGUE','CANCELADO')
             or so.updated_at > now() - interval '90 days'
             or so.warranty_until >= private.today_br())   -- vale enquanto durar a garantia
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
