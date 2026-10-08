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
