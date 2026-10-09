-- =============================================================================
-- TecnoFix · 0013 · Novo nome do produto (antes "Conserta Já")
--
-- Só textos: a mensagem mostrada quando a conta está sem assinatura passa a dizer
-- "TecnoFix", e o endereço /a/tecnofix fica reservado (nenhuma assistência pode
-- usar o nome do produto como endereço do portal). Nada de dados é alterado.
-- =============================================================================

create or replace function private.enforce_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and private.billing_access(new.assistance_id) = 'blocked' then
    raise exception 'O teste grátis terminou. Assine o TecnoFix em "Meu plano" para abrir novas OS e convidar a equipe.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function private.reserved_slugs()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['admin','api','app','painel','entrar','cadastro','login','logout','sair','auth',
               'convite','onboarding','www','suporte','ajuda','status','blog','a','os',
               'conserta-ja','consertaja','tecnofix','tecno-fix','termos','privacidade','precos','planos'];
$$;
