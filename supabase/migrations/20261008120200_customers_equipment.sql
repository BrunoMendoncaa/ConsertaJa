-- =============================================================================
-- Conserta Já · 0003 · Clientes e equipamentos
-- =============================================================================

create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  assistance_id   uuid not null default private.current_assistance_id()
                  references public.assistances(id) on delete cascade,
  name            text not null,
  phone           text,
  phone_e164      text generated always as (private.normalize_br_phone(phone)) stored,
  phone_secondary text,
  email           text,
  document        text,
  address         jsonb not null default '{}'::jsonb,
  notes           text,
  anonymized_at   timestamptz,
  created_by      uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint customers_tenant_id_unique unique (assistance_id, id),
  constraint customers_phone_unique unique (assistance_id, phone_e164),
  constraint customers_name_check check (length(trim(name)) between 2 and 150),
  constraint customers_phone_valid check (anonymized_at is not null or (phone is not null and phone_e164 is not null)),
  constraint customers_document_format check (document is null or document ~ '^([0-9]{11}|[0-9]{14})$'),
  constraint customers_email_format check (email is null or position('@' in email) > 1)
);
create unique index customers_document_unique on public.customers (assistance_id, document) where document is not null;
create index customers_name_trgm_idx on public.customers using gin (name extensions.gin_trgm_ops);
create index customers_assistance_name_idx on public.customers (assistance_id, name);

create table public.equipment_categories (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid references public.assistances(id) on delete cascade,  -- null = padrão do sistema
  name          text not null,
  sort_order    int not null default 100,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint equipment_categories_name_unique unique nulls not distinct (assistance_id, name),
  constraint equipment_categories_name_check check (length(trim(name)) between 2 and 60)
);

insert into public.equipment_categories (assistance_id, name, sort_order) values
  (null, 'Celular', 10), (null, 'Tablet', 20), (null, 'Notebook', 30), (null, 'Computador', 40),
  (null, 'Televisão', 50), (null, 'Videogame', 60), (null, 'Eletrodoméstico', 70),
  (null, 'Aparelho de som', 80), (null, 'Monitor', 90), (null, 'Impressora', 100), (null, 'Outros', 999);

create table public.equipment (
  id            uuid primary key default gen_random_uuid(),
  assistance_id uuid not null default private.current_assistance_id(),
  customer_id   uuid not null,
  category_id   uuid not null,
  brand         text,
  model         text,
  serial_number text,
  imei          text,
  color         text,
  description   text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint equipment_tenant_id_unique unique (assistance_id, id),
  constraint equipment_customer_id_unique unique (assistance_id, customer_id, id),
  constraint equipment_customer_fk foreign key (assistance_id, customer_id)
    references public.customers (assistance_id, id),
  constraint equipment_category_fk foreign key (category_id)
    references public.equipment_categories (id),
  constraint equipment_imei_format check (imei is null or imei ~ '^[0-9]{15}$')
);
create index equipment_customer_idx on public.equipment (assistance_id, customer_id);
create index equipment_imei_idx on public.equipment (assistance_id, imei) where imei is not null;
create index equipment_serial_idx on public.equipment (assistance_id, serial_number) where serial_number is not null;

-- Categoria precisa ser padrão do sistema ou da mesma assistência.
create or replace function private.check_equipment_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.equipment_categories c
    where c.id = new.category_id
      and (c.assistance_id is null or c.assistance_id = new.assistance_id)
  ) then
    raise exception 'Categoria inválida.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Um equipamento com OS não pode trocar de dono (as FKs também impedem).
-- Triggers
create trigger a_enforce_tenant before insert or update on public.customers
  for each row execute function private.enforce_tenant();
create trigger a_enforce_tenant before insert or update on public.equipment
  for each row execute function private.enforce_tenant();
create trigger b_check_category before insert or update of category_id on public.equipment
  for each row execute function private.check_equipment_category();

create trigger set_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.equipment
  for each row execute function private.set_updated_at();

create trigger z_audit after insert or update or delete on public.customers
  for each row execute function private.audit();
create trigger z_audit after insert or update or delete on public.equipment
  for each row execute function private.audit();

-- Categorias personalizadas: assistance_id vem do banco
create or replace function private.enforce_category_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.assistance_id := private.current_assistance_id();
    elsif new.assistance_id is distinct from old.assistance_id then
      raise exception 'Um registro não pode mudar de assistência.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger a_enforce_tenant before insert or update on public.equipment_categories
  for each row execute function private.enforce_category_tenant();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.customers            enable row level security;
alter table public.equipment_categories enable row level security;
alter table public.equipment            enable row level security;

create policy customers_select on public.customers for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));
create policy customers_insert on public.customers for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id()));
create policy customers_update on public.customers for update to authenticated
  using (assistance_id = (select private.current_assistance_id()))
  with check (assistance_id = (select private.current_assistance_id()));
create policy customers_delete on public.customers for delete to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin'])));

create policy categories_select on public.equipment_categories for select to authenticated
  using (assistance_id is null or assistance_id = (select private.current_assistance_id()));
create policy categories_insert on public.equipment_categories for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id())
              and (select private.has_role(array['owner','admin'])));
create policy categories_update on public.equipment_categories for update to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin'])))
  with check (assistance_id = (select private.current_assistance_id()));

create policy equipment_select on public.equipment for select to authenticated
  using (assistance_id = (select private.current_assistance_id()));
create policy equipment_insert on public.equipment for insert to authenticated
  with check (assistance_id = (select private.current_assistance_id()));
create policy equipment_update on public.equipment for update to authenticated
  using (assistance_id = (select private.current_assistance_id()))
  with check (assistance_id = (select private.current_assistance_id()));
create policy equipment_delete on public.equipment for delete to authenticated
  using (assistance_id = (select private.current_assistance_id())
         and (select private.has_role(array['owner','admin'])));

-- Privilégios de coluna
revoke insert, update on public.customers from authenticated;
grant insert (name, phone, phone_secondary, email, document, address, notes)
  on public.customers to authenticated;
grant update (name, phone, phone_secondary, email, document, address, notes)
  on public.customers to authenticated;

revoke insert, update, delete on public.equipment_categories from authenticated;
grant insert (name, sort_order) on public.equipment_categories to authenticated;
grant update (name, sort_order, active) on public.equipment_categories to authenticated;

revoke insert, update on public.equipment from authenticated;
grant insert (customer_id, category_id, brand, model, serial_number, imei, color, description, notes)
  on public.equipment to authenticated;
grant update (category_id, brand, model, serial_number, imei, color, description, notes)
  on public.equipment to authenticated;

-- -----------------------------------------------------------------------------
-- LGPD: anonimiza um cliente que já tem histórico (em vez de apagar)
-- -----------------------------------------------------------------------------
create or replace function public.anonymize_customer(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assistance uuid := private.require_role(array['owner','admin']);
begin
  perform set_config('app.audit_action', 'CUSTOMER_ANONYMIZED', true);

  update public.customers
     set name = 'Cliente anonimizado',
         phone = null, phone_secondary = null, email = null, document = null,
         address = '{}'::jsonb, notes = null, anonymized_at = now()
   where id = p_customer_id and assistance_id = v_assistance and anonymized_at is null;

  if not found then
    raise exception 'Cliente não encontrado.' using errcode = 'P0001';
  end if;
  perform private.reset_context();

  -- Remove os dados pessoais que ficaram na trilha de auditoria desse cliente.
  update public.audit_logs
     set changes = null
   where assistance_id = v_assistance and table_name = 'customers' and record_id = p_customer_id
     and action <> 'CUSTOMER_ANONYMIZED';
end;
$$;
