-- Acessos do site: só o servidor (service_role) grava e lê; limite por visitante; limpeza.
begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select * from no_plan();

-- ---------------------------------------------------------------------------
-- Visitante (anon) e equipe logada (authenticated): nada
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.site_events$$, '42501', null, 'visitante não lê os acessos');
select throws_ok($$select public.track_site_event('page_view', '/', 'visitante-teste-1')$$, '42501', null,
  'visitante não grava direto no banco (só pela rota do servidor)');
reset role;

set local role authenticated;
select throws_ok($$select * from public.site_events$$, '42501', null, 'equipe não lê os acessos');
select throws_ok($$insert into public.site_events (event, path, visitor) values ('page_view', '/', 'xxxxxxxxxx')$$,
  '42501', null, 'equipe não insere acessos');
select throws_ok($$select public.cleanup_site_events()$$, '42501', null, 'equipe não apaga acessos');
reset role;

-- ---------------------------------------------------------------------------
-- Servidor (service_role)
-- ---------------------------------------------------------------------------
set local role service_role;
select is(public.track_site_event('page_view', '/', 'visitante-teste-1', 's1', null, 'l.instagram.com',
  'whatsapp', null, 'convite-14-dias', 'mobile', 'Chrome', 'Android', 'BR', 'SP', 'Bauru'), true, 'servidor grava uma visita');
select is((select city from public.site_events where visitor = 'visitante-teste-1'), 'Bauru', 'visita gravada com a cidade');
select throws_ok($$select public.track_site_event('compra', '/', 'visitante-teste-2')$$, '23514', null,
  'evento desconhecido é recusado');
select throws_ok($$select public.track_site_event('page_view', '/', 'curto')$$, '23514', null,
  'código de visitante inválido é recusado');
select throws_ok($$insert into public.site_events (event, path, visitor) values ('page_view', '/', 'xxxxxxxxxx')$$,
  '42501', null, 'nem o servidor insere direto: só pela função');

-- limite: 60 por minuto por visitante
select lives_ok($$select public.track_site_event('page_view', '/', 'visitante-teste-3') from generate_series(1, 59)$$,
  'grava até o limite');
select is((select count(*)::int from public.site_events where visitor = 'visitante-teste-3'), 59, '59 gravados');
select is(public.track_site_event('page_view', '/', 'visitante-teste-3'), true, '60º ainda entra');
select is(public.track_site_event('page_view', '/', 'visitante-teste-3'), false, '61º no mesmo minuto é ignorado');
select is(public.track_site_event('page_view', '/', 'visitante-teste-4'), true, 'outro visitante não é afetado');

-- limpeza de eventos antigos
reset role;
insert into public.site_events (created_at, event, path, visitor)
values (now() - interval '14 months', 'page_view', '/', 'visitante-antigo'),
       (now() - interval '12 months', 'page_view', '/', 'visitante-recente');
set local role service_role;
select is(public.cleanup_site_events(), 1, 'limpeza apaga só o que tem mais de 13 meses');
select is((select count(*)::int from public.site_events where visitor in ('visitante-antigo', 'visitante-recente')), 1,
  'o de 12 meses continua');
reset role;

select * from finish();
rollback;
