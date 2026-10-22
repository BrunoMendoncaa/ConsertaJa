-- =============================================================================
-- TecnoFix · 0018 · Plano Grátis (freemium) + Pro
--
-- Regras novas:
-- - Conta nova continua ganhando 14 dias com tudo liberado (Pro), sem cartão.
-- - Sem assinatura em dia (fim do teste, assinatura cancelada ou pagamento atrasado
--   além da tolerância), a conta passa para o plano GRÁTIS em vez de ficar bloqueada:
--     * até 30 OS novas por mês (mês de Brasília, conta pela data de criação);
--     * não convida pessoas para a equipe (quem já está na equipe continua);
--     * garantia sai como comprovante simples, e o portal mostra "feito com TecnoFix"
--       (isso é decidido na tela, a partir do campo "plan").
-- - Nada do que já existe é travado: ver, concluir, entregar, receber e imprimir continuam.
-- - Suspensa pela área admin continua bloqueada.
-- Valores de acesso (private.billing_access): trial, active, grace, free, blocked.
-- Plano (private.billing_plan): pro (trial, active, grace), free ou blocked.
-- =============================================================================

-- Limite de OS por mês no plano Grátis (o mesmo número está em src/lib/billing.js).
create or replace function private.free_os_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 30 $$;

-- Começo do mês corrente no horário de Brasília.
create or replace function private.month_start_br()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' $$;

create index if not exists service_orders_created_idx on public.service_orders (assistance_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Situação de acesso: igual à anterior, mas sem pagamento vira 'free' (não 'blocked')
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
  return 'free';
end;
$$;

create or replace function private.billing_plan(p_assistance_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case private.billing_access(p_assistance_id)
    when 'free' then 'free'
    when 'blocked' then 'blocked'
    else 'pro'
  end
$$;

create or replace function private.os_this_month(p_assistance_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.service_orders so
  where so.assistance_id = p_assistance_id and so.created_at >= private.month_start_br()
$$;

revoke all on function private.free_os_limit(), private.month_start_br(), private.billing_plan(uuid), private.os_this_month(uuid) from public;
grant execute on function private.free_os_limit(), private.month_start_br(), private.billing_plan(uuid), private.os_this_month(uuid)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Barreira no banco: suspensa não abre OS nem convida; Grátis tem 30 OS/mês e não convida.
-- (Pedidos do servidor, sem usuário logado, não passam por aqui: seed e rotinas.)
-- -----------------------------------------------------------------------------
create or replace function private.enforce_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access text;
begin
  if auth.uid() is null then
    return new;
  end if;
  v_access := private.billing_access(new.assistance_id);
  if v_access = 'blocked' then
    raise exception 'Esta assistência está suspensa. Fale com o suporte do TecnoFix.' using errcode = 'P0001';
  end if;
  if v_access = 'free' then
    if tg_table_name = 'assistance_invitations' then
      raise exception 'Convidar a equipe é do plano Pro. Assine em "Meu plano" para trabalhar com técnicos e atendentes.'
        using errcode = 'P0001';
    end if;
    if tg_table_name = 'service_orders' and private.os_this_month(new.assistance_id) >= private.free_os_limit() then
      raise exception 'Você usou as % OS do plano Grátis deste mês. Assine o Pro em "Meu plano" para abrir OS sem limite, ou aguarde o dia 1º.',
        private.free_os_limit() using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Resumo para a tela: + plano, OS do mês e limite
-- -----------------------------------------------------------------------------
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
    'os_month', private.os_this_month(v_assistance),
    'os_limit', private.free_os_limit(),
    'month_resets_at', private.month_start_br() + interval '1 month',
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
-- Portal do cliente: o plano decide o rodapé "feito com TecnoFix" e o documento de garantia
-- -----------------------------------------------------------------------------
drop function public.portal_assistance(text);
create function public.portal_assistance(p_slug text)
returns table (name text, slug text, logo_path text, brand_color text, phone text, whatsapp text, email text,
               address jsonb, business_hours text, welcome_message text, warranty_policy text, plan text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.name, a.slug, a.logo_path, a.brand_color, a.phone, a.whatsapp, a.email,
         a.address, a.business_hours, a.welcome_message, a.warranty_policy, private.billing_plan(a.id)
  from public.assistances a
  where a.slug = lower(p_slug)
    and a.subscription_status <> 'suspended';
$$;
revoke all on function public.portal_assistance(text) from public;
grant execute on function public.portal_assistance(text) to anon, authenticated, service_role;

create or replace function public.portal_get_warranty(p_token text, p_slug text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s    public.portal_sessions := private.portal_session(p_token, p_slug);
  v_os public.service_orders;
  v_a  public.assistances;
  v_b  public.budget_versions;
begin
  select so.* into v_os
  from public.service_orders so
  where so.assistance_id = s.assistance_id      -- tenant vem da sessão
    and so.customer_id   = s.customer_id        -- cliente vem da sessão
    and so.code = upper(p_code)
    and so.status = 'ENTREGUE';

  if not found then
    return null;
  end if;

  select a.* into v_a from public.assistances a where a.id = s.assistance_id;

  select b.* into v_b
  from public.budget_versions b
  where b.service_order_id = v_os.id and b.status = 'APROVADO'
  order by b.version desc
  limit 1;

  return jsonb_build_object(
    'assistance', jsonb_build_object(
      'name', v_a.name, 'legal_name', v_a.legal_name, 'document', v_a.document,
      'phone', v_a.phone, 'whatsapp', v_a.whatsapp, 'email', v_a.email, 'address', v_a.address,
      'logo_path', v_a.logo_path, 'warranty_policy', v_a.warranty_policy,
      'plan', private.billing_plan(v_a.id)),
    'order', jsonb_build_object(
      'code', v_os.code, 'status', v_os.status, 'outcome', v_os.outcome,
      'received_at', v_os.received_at, 'delivered_at', v_os.delivered_at, 'warranty_until', v_os.warranty_until,
      'reported_issue', v_os.reported_issue, 'diagnosis', v_os.diagnosis, 'solution', v_os.solution,
      'accessories', to_jsonb(v_os.accessories),
      'customer', (select jsonb_build_object('name', c.name, 'phone', c.phone, 'document', c.document)
                   from public.customers c where c.id = v_os.customer_id),
      'equipment', (select jsonb_build_object(
                       'brand', e.brand, 'model', e.model, 'serial_number', e.serial_number, 'imei', e.imei,
                       'color', e.color, 'category', jsonb_build_object('name', cat.name))
                    from public.equipment e
                    join public.equipment_categories cat on cat.id = e.category_id
                    where e.id = v_os.equipment_id)),
    -- Só os itens do snapshot aprovado (o que o cliente já viu); nada de notas internas.
    'approved', case when v_b.id is null then null else jsonb_build_object(
      'version', v_b.version, 'warranty_days', v_b.warranty_days, 'total', v_b.total,
      'snapshot', jsonb_build_object('items', coalesce(v_b.snapshot -> 'items', '[]'::jsonb))) end
  );
end;
$$;
