-- =============================================================================
-- Conserta Já · 0001 · Base
-- Extensões, schema privado e funções utilitárias usadas por todas as tabelas.
-- =============================================================================

-- No Supabase as extensões ficam no schema "extensions".
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- Schema privado: funções auxiliares que NÃO são expostas pela API REST.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Nenhuma função nova do schema private é executável por padrão.
alter default privileges in schema private revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Telefone brasileiro → E.164 (+55DDDNUMERO). Retorna null se inválido.
-- Aceita: (11) 98765-4321 · 11987654321 · +55 11 98765-4321 · 011 98765-4321
-- -----------------------------------------------------------------------------
create or replace function private.normalize_br_phone(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text;
begin
  if p is null then
    return null;
  end if;

  d := regexp_replace(p, '\D', '', 'g');

  -- Já veio com DDI 55 (12 ou 13 dígitos)
  if left(d, 2) = '55' and length(d) in (12, 13) then
    d := substr(d, 3);
  end if;

  -- Zero de longa distância: 0 + DDD + número
  if left(d, 1) = '0' and length(d) in (11, 12) then
    d := substr(d, 2);
  end if;

  if length(d) not in (10, 11) or left(d, 1) = '0' then
    return null;
  end if;

  return '+55' || d;
end;
$$;

-- -----------------------------------------------------------------------------
-- Código de acesso da OS: 6 caracteres, alfabeto de 31 símbolos sem ambíguos
-- (sem I, L, O, 0, 1) → 31^6 ≈ 887 milhões de combinações.
-- -----------------------------------------------------------------------------
create or replace function private.generate_access_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(6);
  result text := '';
begin
  for i in 0..5 loop
    result := result || substr(alphabet, (get_byte(b, i) % 31) + 1, 1);
  end loop;
  return result;
end;
$$;

-- Token aleatório (hex) e seu hash — usados em convites e sessões do portal.
create or replace function private.random_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

create or replace function private.hash_token(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(coalesce(p_token, ''), 'UTF8'));
$$;

-- Data de hoje no fuso de São Paulo (validade de orçamento, numeração por ano).
create or replace function private.today_br()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Limpa o contexto de auditoria/histórico usado pelos triggers (fim de cada RPC).
create or replace function private.reset_context()
returns void
language sql
set search_path = ''
as $$
  select set_config('app.audit_action', '', true),
         set_config('app.status_note', '', true),
         set_config('app.status_via', '', true),
         set_config('app.status_visible', '', true);
$$;

grant execute on function private.normalize_br_phone(text) to authenticated, service_role;
grant execute on function private.reset_context()          to authenticated, service_role;
grant execute on function private.generate_access_code()  to authenticated, service_role;
grant execute on function private.today_br()              to authenticated, service_role;
