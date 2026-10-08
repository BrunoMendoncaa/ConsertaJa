-- =============================================================================
-- Conserta Já · 0004 · Ordens de serviço, histórico, fotos e senha de desbloqueio
-- =============================================================================

create table public.service_orders (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null default private.current_assistance_id(),
  customer_id      uuid not null,
  equipment_id     uuid not null,
  year             int  not null,
  number           int  not null,
  code             text generated always as ('OS-' || year::text || '-' || lpad(number::text, 6, '0')) stored,
  status           text not null default 'RECEBIDO',
  outcome          text,
  priority         text not null default 'NORMAL',
  reported_issue   text not null,
  entry_condition  jsonb not null default '{}'::jsonb,
  entry_condition_notes text,
  accessories      text[] not null default '{}',
  diagnosis        text,
  solution         text,
  customer_notes   text,
  internal_notes   text,
  access_code      text not null default private.generate_access_code(),
  technician_id    uuid,
  received_at      timestamptz not null default now(),
  estimated_completion_at timestamptz,
  completed_at     timestamptz,
  delivered_at     timestamptz,
  warranty_until   date,
  cancel_reason    text,
  parent_service_order_id uuid,
  created_by       uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint service_orders_tenant_id_unique unique (assistance_id, id),
  constraint service_orders_number_unique unique (assistance_id, year, number),
  constraint service_orders_customer_fk foreign key (assistance_id, customer_id)
    references public.customers (assistance_id, id),
  constraint service_orders_equipment_fk foreign key (assistance_id, customer_id, equipment_id)
    references public.equipment (assistance_id, customer_id, id),
  constraint service_orders_technician_fk foreign key (assistance_id, technician_id)
    references public.assistance_members (assistance_id, user_id),
  constraint service_orders_parent_fk foreign key (assistance_id, parent_service_order_id)
    references public.service_orders (assistance_id, id),
  constraint service_orders_status_check check (status in (
    'RECEBIDO','EM_DIAGNOSTICO','AGUARDANDO_APROVACAO','ORCAMENTO_RECUSADO',
    'APROVADO','AGUARDANDO_PECA','EM_MANUTENCAO','PRONTO','ENTREGUE','CANCELADO')),
  constraint service_orders_outcome_check check (outcome is null or outcome in
    ('REPARADO','NAO_REPARADO_RECUSADO','NAO_REPARADO_INVIAVEL')),
  constraint service_orders_priority_check check (priority in ('BAIXA','NORMAL','ALTA','URGENTE')),
  constraint service_orders_issue_check check (length(trim(reported_issue)) >= 3),
  constraint service_orders_cancel_reason check (status <> 'CANCELADO' or cancel_reason is not null),
  constraint service_orders_delivered_check check (status <> 'ENTREGUE' or (delivered_at is not null and outcome is not null))
);
create index service_orders_status_idx   on public.service_orders (assistance_id, status);
create index service_orders_received_idx on public.service_orders (assistance_id, received_at desc);
create index service_orders_customer_idx on public.service_orders (assistance_id, customer_id);
create index service_orders_equipment_idx on public.service_orders (assistance_id, equipment_id);

create table public.service_order_status_history (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null,
  service_order_id uuid not null,
  from_status      text,
  to_status        text not null,
  note             text,
  visible_to_customer boolean not null default true,
  changed_by       uuid references public.profiles(id) on delete set null,
  changed_via      text not null,
  created_at       timestamptz not null default now(),
  constraint status_history_os_fk foreign key (assistance_id, service_order_id)
    references public.service_orders (assistance_id, id) on delete cascade,
  constraint status_history_via_check check (changed_via in ('STAFF','PORTAL','SYSTEM'))
);
create index status_history_os_idx on public.service_order_status_history (assistance_id, service_order_id, created_at);

create table public.service_order_photos (
  id               uuid primary key default gen_random_uuid(),
  assistance_id    uuid not null default private.current_assistance_id(),
  service_order_id uuid not null,
  storage_path     text not null,
  stage            text not null default 'ENTRADA',
  kind             text not null default 'OUTRO',
  description      text,
  visible_to_customer boolean not null default true,
  mime_type        text not null,
  size_bytes       int  not null,
  uploaded_by      uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint photos_path_unique unique (storage_path),
  constraint photos_os_fk foreign key (assistance_id, service_order_id)
    references public.service_orders (assistance_id, id),
  constraint photos_stage_check check (stage in ('ENTRADA','DIAGNOSTICO','SAIDA')),
  constraint photos_kind_check check (kind in ('FRENTE','TRASEIRA','LATERAL','TELA','CONECTOR',
    'ETIQUETA','NUMERO_SERIE','DANO','ACESSORIO','OUTRO')),
  constraint photos_mime_check check (mime_type in ('image/jpeg','image/png','image/webp')),
  constraint photos_size_check check (size_bytes between 1 and 10485760),
  constraint photos_path_prefix check (storage_path like assistance_id::text || '/' || service_order_id::text || '/%')
);
create index photos_os_idx on public.service_order_photos (assistance_id, service_order_id);

-- Senha/PIN/padrão de desbloqueio. Apagada automaticamente na entrega ou cancelamento.
create table public.service_order_secrets (
  service_order_id uuid primary key,
  assistance_id    uuid not null default private.current_assistance_id(),
  unlock_code      text not null,
  created_by       uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint secrets_os_fk foreign key (assistance_id, service_order_id)
    references public.service_orders (assistance_id, id) on delete cascade,
  constraint secrets_length check (length(unlock_code) between 1 and 100)
);

-- -----------------------------------------------------------------------------
-- Numeração: OS-AAAA-000001, sequencial por assistência e por ano, sem buracos.
-- O UPDATE no contador trava a linha: duas OS simultâneas nunca pegam o mesmo número.
-- -----------------------------------------------------------------------------
create or replace function private.assign_service_order_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year int := extract(year from private.today_br())::int;
  v_next bigint;
begin
  insert into public.assistance_counters as c (assistance_id, key, last_value)
  values (new.assistance_id, 'service_order:' || v_year, 1)
  on conflict (assistance_id, key) do update set last_value = c.last_value + 1
  returning c.last_value into v_next;

  new.year := v_year;
  new.number := v_next;
  return new;
end;
$$;

-- Contexto do histórico de status (nota, origem, visibilidade) para o trigger.
create or replace function private.set_status_context(p_note text, p_via text, p_visible boolean default true)
returns void
language sql
set search_path = ''
as $$
  select set_config('app.status_note', coalesce(p_note, ''), true),
         set_config('app.status_via', coalesce(p_via, ''), true),
         set_config('app.status_visible', coalesce(p_visible, true)::text, true);
$$;

create or replace function private.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.service_order_status_history
      (assistance_id, service_order_id, from_status, to_status, note, visible_to_customer, changed_by, changed_via)
    values (
      new.assistance_id,
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      nullif(current_setting('app.status_note', true), ''),
      coalesce(nullif(current_setting('app.status_visible', true), '')::boolean, true),
      auth.uid(),
      coalesce(nullif(current_setting('app.status_via', true), ''),
               case when auth.uid() is null then 'SYSTEM' else 'STAFF' end)
    );
  end if;
  return new;
end;
$$;

create or replace function private.purge_secrets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('ENTREGUE', 'CANCELADO') then
    delete from public.service_order_secrets where service_order_id = new.id;
  end if;
  return new;
end;
$$;

-- Triggers (executam em ordem alfabética do nome)
create trigger a_enforce_tenant before insert or update on public.service_orders
  for each row execute function private.enforce_tenant();
create trigger b_assign_number before insert on public.service_orders
  for each row execute function private.assign_service_order_number();
create trigger set_updated_at before update on public.service_orders
  for each row execute function private.set_updated_at();
create trigger y_log_status after insert or update of status on public.service_orders
  for each row execute function private.log_status_change();
create trigger y_purge_secrets after update of status on public.service_orders
  for each row execute function private.purge_secrets();
create trigger z_audit after insert or update on public.service_orders
  for each row execute function private.audit();

create trigger a_enforce_tenant before insert or update on public.service_order_photos
  for each row execute function private.enforce_tenant();
create trigger z_audit after insert or delete on public.service_order_photos
  for each row execute function private.audit();

create trigger a_enforce_tenant before insert or update on public.service_order_secrets
  for each row execute function private.enforce_tenant();
-- (sem auditoria: a senha não pode ficar registrada em lugar nenhum)

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.service_orders               enable row level security;
alter table public.service_order_status_history enable row level security;
alter table public.service_order_photos         enable row level security;
alter table public.service_order_secrets        enable row level security;

create policy service_orders_select on public.service_orders for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));
create policy service_orders_insert on public.service_orders for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id()));
create policy service_orders_update on public.service_orders for update to authenticated
  using (assistance_id = (select private.current_assistance_id()))
  with check (assistance_id = (select private.current_assistance_id()));

create policy status_history_select on public.service_order_status_history for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));

create policy photos_select on public.service_order_photos for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));
create policy photos_insert on public.service_order_photos for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id()));
create policy photos_update on public.service_order_photos for update to authenticated
  using (assistance_id = (select private.current_assistance_id()))
  with check (assistance_id = (select private.current_assistance_id()));
create policy photos_delete on public.service_order_photos for delete to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin'])));

create policy secrets_select on public.service_order_secrets for select to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin','technician'])));
create policy secrets_insert on public.service_order_secrets for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id()));
create policy secrets_update on public.service_order_secrets for update to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin','technician'])))
  with check (assistance_id = (select private.current_assistance_id()));
create policy secrets_delete on public.service_order_secrets for delete to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin','technician'])));

-- Privilégios de coluna: status, numeração e código de acesso só mudam por função.
revoke insert, update, delete on public.service_orders from authenticated;
grant insert (customer_id, equipment_id, priority, reported_issue, entry_condition, entry_condition_notes,
              accessories, customer_notes, internal_notes, technician_id, estimated_completion_at,
              parent_service_order_id)
  on public.service_orders to authenticated;
grant update (priority, reported_issue, entry_condition, entry_condition_notes, accessories, diagnosis,
              solution, customer_notes, internal_notes, technician_id, estimated_completion_at)
  on public.service_orders to authenticated;

revoke insert, update, delete on public.service_order_status_history from authenticated;

revoke insert, update on public.service_order_photos from authenticated;
grant insert (service_order_id, storage_path, stage, kind, description, visible_to_customer, mime_type, size_bytes)
  on public.service_order_photos to authenticated;
grant update (stage, kind, description, visible_to_customer) on public.service_order_photos to authenticated;

revoke insert, update on public.service_order_secrets from authenticated;
grant insert (service_order_id, unlock_code) on public.service_order_secrets to authenticated;
grant update (unlock_code) on public.service_order_secrets to authenticated;

-- -----------------------------------------------------------------------------
-- View de listagem (security_invoker: o RLS de quem consulta continua valendo)
-- -----------------------------------------------------------------------------
create view public.v_service_orders with (security_invoker = true) as
select so.id, so.assistance_id, so.code, so.year, so.number, so.status, so.outcome, so.priority,
       so.reported_issue, so.received_at, so.estimated_completion_at, so.completed_at, so.delivered_at,
       so.warranty_until, so.updated_at,
       so.customer_id, c.name as customer_name, c.phone as customer_phone, c.phone_e164 as customer_phone_e164,
       so.equipment_id, cat.name as category_name, e.brand, e.model, e.serial_number, e.imei, e.color,
       so.technician_id, tp.full_name as technician_name
from public.service_orders so
join public.customers c on c.id = so.customer_id
join public.equipment e on e.id = so.equipment_id
join public.equipment_categories cat on cat.id = e.category_id
left join public.profiles tp on tp.id = so.technician_id;

-- -----------------------------------------------------------------------------
-- RPC: abertura de OS (cliente e equipamento novos opcionais) em uma transação.
-- SECURITY INVOKER: o RLS e os privilégios de coluna valem dentro da função.
-- -----------------------------------------------------------------------------
create or replace function public.create_service_order(p jsonb)
returns table (id uuid, code text, access_code text)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_customer  uuid := nullif(p ->> 'customer_id', '')::uuid;
  v_equipment uuid := nullif(p ->> 'equipment_id', '')::uuid;
  v_os        uuid;
  c jsonb := nullif(p -> 'customer', 'null'::jsonb);
  e jsonb := nullif(p -> 'equipment', 'null'::jsonb);
begin
  if v_customer is null then
    if c is null then
      raise exception 'Selecione ou cadastre o cliente.' using errcode = 'P0001';
    end if;
    insert into public.customers (name, phone, phone_secondary, email, document, address, notes)
    values (
      trim(c ->> 'name'), c ->> 'phone', nullif(c ->> 'phone_secondary', ''), nullif(lower(c ->> 'email'), ''),
      nullif(c ->> 'document', ''), coalesce(c -> 'address', '{}'::jsonb), nullif(c ->> 'notes', '')
    )
    returning customers.id into v_customer;
  end if;

  if v_equipment is null then
    if e is null then
      raise exception 'Selecione ou cadastre o equipamento.' using errcode = 'P0001';
    end if;
    insert into public.equipment (customer_id, category_id, brand, model, serial_number, imei, color, description, notes)
    values (
      v_customer, (e ->> 'category_id')::uuid, nullif(e ->> 'brand', ''), nullif(e ->> 'model', ''),
      nullif(e ->> 'serial_number', ''), nullif(e ->> 'imei', ''), nullif(e ->> 'color', ''),
      nullif(e ->> 'description', ''), nullif(e ->> 'notes', '')
    )
    returning equipment.id into v_equipment;
  end if;

  perform private.set_status_context('Equipamento recebido', 'STAFF', true);

  insert into public.service_orders (
    customer_id, equipment_id, priority, reported_issue, entry_condition, entry_condition_notes,
    accessories, customer_notes, internal_notes, technician_id, estimated_completion_at
  ) values (
    v_customer, v_equipment, coalesce(nullif(p ->> 'priority', ''), 'NORMAL'), trim(p ->> 'reported_issue'),
    coalesce(p -> 'entry_condition', '{}'::jsonb), nullif(p ->> 'entry_condition_notes', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'accessories', '[]'::jsonb))), '{}'),
    nullif(p ->> 'customer_notes', ''), nullif(p ->> 'internal_notes', ''),
    nullif(p ->> 'technician_id', '')::uuid, nullif(p ->> 'estimated_completion_at', '')::timestamptz
  )
  returning service_orders.id into v_os;

  if nullif(trim(coalesce(p ->> 'unlock_code', '')), '') is not null then
    insert into public.service_order_secrets (service_order_id, unlock_code)
    values (v_os, trim(p ->> 'unlock_code'));
  end if;

  perform private.reset_context();

  return query
    select so.id, so.code, so.access_code from public.service_orders so where so.id = v_os;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: mudança manual de status (máquina de estados)
-- As mudanças ligadas ao orçamento (enviar, aprovar, recusar) são feitas pelas
-- funções de orçamento, não por aqui.
-- -----------------------------------------------------------------------------
create or replace function public.change_service_order_status(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.current_assistance_id();
  v_os public.service_orders;
  v_tech constant text[] := array['owner','admin','technician'];
  v_all  constant text[] := array['owner','admin','technician','attendant'];
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_warranty int;
begin
  if v_assistance is null then
    raise exception 'Nenhuma assistência ativa. Entre novamente.' using errcode = '42501';
  end if;

  select * into v_os from public.service_orders so
  where so.id = p_id and so.assistance_id = v_assistance
  for update;

  if not found then
    raise exception 'OS não encontrada.' using errcode = 'P0001';
  end if;

  if v_os.status = p_status then
    return;
  end if;

  perform private.set_status_context(v_note, 'STAFF', true);

  -- Cancelamento: de qualquer status, exceto ENTREGUE
  if p_status = 'CANCELADO' then
    if v_os.status = 'ENTREGUE' then
      raise exception 'Uma OS entregue não pode ser cancelada.' using errcode = 'P0001';
    end if;
    perform private.require_role(array['owner','admin']);
    if v_note is null or length(v_note) < 3 then
      raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
    end if;
    perform set_config('app.audit_action', 'OS_CANCELLED', true);
    update public.budget_versions set status = 'CANCELADO'
     where service_order_id = p_id and status in ('RASCUNHO','ENVIADO');
    update public.service_orders set status = 'CANCELADO', cancel_reason = v_note where id = p_id;
    perform private.reset_context();
    return;
  end if;

  if v_os.status = 'RECEBIDO' and p_status = 'EM_DIAGNOSTICO' then
    perform private.require_role(v_tech);
    update public.service_orders set status = p_status where id = p_id;

  elsif v_os.status = 'EM_DIAGNOSTICO' and p_status = 'PRONTO' then
    perform private.require_role(v_tech);
    if nullif(trim(coalesce(v_os.diagnosis, '')), '') is null then
      raise exception 'Registre o diagnóstico antes de marcar o reparo como inviável.' using errcode = 'P0001';
    end if;
    update public.service_orders
       set status = 'PRONTO', outcome = 'NAO_REPARADO_INVIAVEL', completed_at = now()
     where id = p_id;

  elsif v_os.status = 'ORCAMENTO_RECUSADO' and p_status = 'PRONTO' then
    perform private.require_role(v_all);
    update public.service_orders
       set status = 'PRONTO', outcome = 'NAO_REPARADO_RECUSADO', completed_at = now()
     where id = p_id;

  elsif v_os.status = 'ORCAMENTO_RECUSADO' and p_status = 'EM_MANUTENCAO' then
    perform private.require_role(v_tech);
    if not exists (select 1 from public.budget_versions b where b.service_order_id = p_id and b.status = 'APROVADO') then
      raise exception 'Não há orçamento aprovado para continuar o reparo.' using errcode = 'P0001';
    end if;
    update public.service_orders set status = p_status where id = p_id;

  elsif (v_os.status = 'APROVADO' and p_status in ('EM_MANUTENCAO', 'AGUARDANDO_PECA'))
     or (v_os.status = 'EM_MANUTENCAO' and p_status = 'AGUARDANDO_PECA')
     or (v_os.status = 'AGUARDANDO_PECA' and p_status = 'EM_MANUTENCAO') then
    perform private.require_role(v_tech);
    update public.service_orders set status = p_status where id = p_id;

  elsif v_os.status = 'EM_MANUTENCAO' and p_status = 'PRONTO' then
    perform private.require_role(v_tech);
    if nullif(trim(coalesce(v_os.solution, '')), '') is null then
      raise exception 'Descreva a solução aplicada antes de concluir.' using errcode = 'P0001';
    end if;
    update public.service_orders
       set status = 'PRONTO', outcome = 'REPARADO', completed_at = now()
     where id = p_id;

  elsif v_os.status = 'PRONTO' and p_status = 'EM_MANUTENCAO' then
    perform private.require_role(v_tech);
    if v_note is null then
      raise exception 'Informe o motivo para reabrir o reparo.' using errcode = 'P0001';
    end if;
    update public.service_orders
       set status = 'EM_MANUTENCAO', outcome = null, completed_at = null
     where id = p_id;

  elsif v_os.status = 'PRONTO' and p_status = 'ENTREGUE' then
    perform private.require_role(v_all);
    perform set_config('app.audit_action', 'OS_DELIVERED', true);
    if v_os.outcome = 'REPARADO' then
      select b.warranty_days into v_warranty
      from public.budget_versions b
      where b.service_order_id = p_id and b.status = 'APROVADO'
      order by b.version desc limit 1;
    end if;
    update public.service_orders
       set status = 'ENTREGUE',
           delivered_at = now(),
           warranty_until = case when v_warranty is not null and v_warranty > 0
                                 then private.today_br() + v_warranty end
     where id = p_id;

  else
    raise exception 'Mudança de status não permitida (de % para %).', v_os.status, p_status using errcode = 'P0001';
  end if;

  perform private.reset_context();
end;
$$;

-- Gera um novo código de acesso do portal para a OS (ex.: comprovante perdido).
create or replace function public.regenerate_access_code(p_service_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin','technician','attendant']);
  v_code text := private.generate_access_code();
begin
  perform set_config('app.audit_action', 'ACCESS_CODE_REGENERATED', true);
  update public.service_orders set access_code = v_code
   where id = p_service_order_id and assistance_id = v_assistance;
  if not found then
    raise exception 'OS não encontrada.' using errcode = 'P0001';
  end if;
  perform private.reset_context();
  return v_code;
end;
$$;
