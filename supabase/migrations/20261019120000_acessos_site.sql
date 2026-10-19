-- =============================================================================
-- TecnoFix · 0016 · Acessos do site (landing e cadastro) para a área admin
--
-- Cada visita ou clique nas páginas públicas vira uma linha em site_events.
-- Privacidade: sem cookie e sem IP. O visitante é um código que muda todo dia
-- (hash do IP + navegador + data com um sal secreto, calculado no servidor), e a
-- localização é só cidade/estado/país, vinda do cabeçalho da Vercel.
-- Só o servidor (service_role) grava e lê. Os dados somem depois de 13 meses.
-- =============================================================================

create table public.site_events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  event         text not null check (event in ('page_view', 'cta_click')),
  path          text not null check (char_length(path) between 1 and 200),
  label         text check (char_length(label) <= 80),
  visitor       text not null check (char_length(visitor) between 8 and 64),
  session       text check (char_length(session) <= 64),
  referrer_host text check (char_length(referrer_host) <= 120),
  utm_source    text check (char_length(utm_source) <= 80),
  utm_medium    text check (char_length(utm_medium) <= 80),
  utm_campaign  text check (char_length(utm_campaign) <= 80),
  device        text check (device in ('mobile', 'tablet', 'desktop')),
  browser       text check (char_length(browser) <= 40),
  os            text check (char_length(os) <= 40),
  country       text check (char_length(country) <= 2),
  region        text check (char_length(region) <= 10),
  city          text check (char_length(city) <= 80)
);
create index site_events_created_idx on public.site_events (created_at desc);
create index site_events_visitor_idx on public.site_events (visitor, created_at desc);

alter table public.site_events enable row level security;
-- Sem policies: só a service_role (que ignora o RLS) acessa.
revoke all on public.site_events from public, anon, authenticated, service_role;
grant select on public.site_events to service_role;  -- gravar só pela função abaixo (com limite)

-- -----------------------------------------------------------------------------
-- Grava um evento. Limite: 60 eventos por visitante por minuto (evita lixo e abuso).
-- Devolve true se gravou.
-- -----------------------------------------------------------------------------
create or replace function public.track_site_event(
  p_event text, p_path text, p_visitor text,
  p_session text default null, p_label text default null, p_referrer_host text default null,
  p_utm_source text default null, p_utm_medium text default null, p_utm_campaign text default null,
  p_device text default null, p_browser text default null, p_os text default null,
  p_country text default null, p_region text default null, p_city text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.site_events
       where visitor = p_visitor and created_at > now() - interval '1 minute') >= 60 then
    return false;
  end if;
  insert into public.site_events (event, path, label, visitor, session, referrer_host,
    utm_source, utm_medium, utm_campaign, device, browser, os, country, region, city)
  values (p_event, p_path, p_label, p_visitor, p_session, p_referrer_host,
    p_utm_source, p_utm_medium, p_utm_campaign, p_device, p_browser, p_os, p_country, p_region, p_city);
  return true;
end;
$$;

-- Apaga eventos com mais de 13 meses (chamada pela rotina diária).
create or replace function public.cleanup_site_events()
returns integer
language sql
security definer
set search_path = ''
as $$
  with apagados as (
    delete from public.site_events where created_at < now() - interval '13 months' returning 1
  )
  select count(*)::int from apagados;
$$;

revoke execute on function public.track_site_event(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.cleanup_site_events() from public, anon, authenticated;
grant execute on function public.track_site_event(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text)
  to service_role;
grant execute on function public.cleanup_site_events() to service_role;
