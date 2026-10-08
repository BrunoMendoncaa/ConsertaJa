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
