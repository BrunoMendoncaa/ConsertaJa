-- =============================================================================
-- TecnoFix · 0014 · Cobrança: uma assinatura vigente por assistência
--
-- Corrige dois problemas vistos no teste real (09/10):
-- 1. Depois de uma assinatura cancelada, assinar de novo não tirava a conta do
--    status "cancelado" enquanto a 1ª cobrança não acontecia. A tela continuava
--    oferecendo "Assinar" e permitia criar várias assinaturas.
-- 2. Com mais de uma assinatura autorizada, cada conferência trocava a "vigente"
--    para a última conferida (ia e voltava). Agora só uma mais nova assume.
-- Só substitui a função public.billing_apply_sync; permissões continuam as mesmas.
-- =============================================================================

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
  v_cur public.billing_subscriptions;
  v_is_current boolean;
  v_takes_over boolean;
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

  -- Trava a assistência ANTES de gravar qualquer coisa. Sem isso, duas conferências da
  -- mesma assistência ao mesmo tempo (webhook + cron + retorno) pegam primeiro a trava
  -- leve das chaves estrangeiras e depois disputam a trava forte: deadlock (40P01).
  select * into a from public.assistances where id = s.assistance_id for update;

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

  -- Qual assinatura manda na conta (uma só por assistência):
  -- - a vigente (assistances.mp_preapproval_id) sempre atualiza a conta;
  -- - uma autorizada só assume o lugar da vigente se for MAIS NOVA que ela, ou se a
  --   vigente já foi cancelada. Assim, conferir uma assinatura antiga não "volta" a
  --   conta para ela. As que sobram autorizadas são canceladas no Mercado Pago pelo
  --   servidor (para não cobrar duas vezes).
  v_is_current := a.mp_preapproval_id is not distinct from p_provider_id;
  if not v_is_current and p_status = 'authorized' then
    select * into v_cur from public.billing_subscriptions c
     where c.provider = 'mercadopago' and c.provider_id = a.mp_preapproval_id;
    v_takes_over := v_cur.id is null
                    or v_cur.status = 'cancelled'
                    or (v_cur.created_at, v_cur.id) < (s.created_at, s.id);
  else
    v_takes_over := false;
  end if;

  if v_is_current or v_takes_over then
    v_new_status := case
      when a.subscription_status = 'suspended' then 'suspended'
      when p_status = 'cancelled' then 'canceled'
      when p_status = 'paused' then 'past_due'
      when p_status = 'pending' then a.subscription_status
      when v_paid_until is not null and v_paid_until > now() then 'active'
      when v_paid_until is not null then 'past_due'
      else 'trialing'   -- autorizada, 1ª cobrança ainda não feita (assinou durante o teste)
    end;

    update public.assistances
       set subscription_status = v_new_status,
           mp_preapproval_id = p_provider_id,
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
