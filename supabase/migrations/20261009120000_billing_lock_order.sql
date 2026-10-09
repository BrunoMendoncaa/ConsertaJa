-- =============================================================================
-- Conserta Já · 0012 · Cobrança: conferências simultâneas sem deadlock
--
-- Duas sincronizações da mesma assistência ao mesmo tempo (ex.: a conferência diária
-- conferindo a assinatura vigente e um pagamento pendente) podiam travar uma à outra
-- (erro 40P01 "deadlock detected"). Agora a assistência é travada primeiro, e a
-- segunda conferência simplesmente espera a primeira terminar.
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
  perform 1 from public.assistances where id = s.assistance_id for update;

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
