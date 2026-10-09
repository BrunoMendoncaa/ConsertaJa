-- =============================================================================
-- TecnoFix · Limpar as assinaturas de TESTE do Mercado Pago
--
-- Quando rodar: UMA VEZ, ao trocar as credenciais de teste do Mercado Pago pelas
-- de produção (antes de começar a vender). As assinaturas criadas em teste não
-- existem na conta de produção e deixariam as assistências "esperando" uma
-- cobrança que nunca vai acontecer.
--
-- O que faz: apaga as assinaturas e pagamentos registrados e volta todas as
-- assistências ao teste grátis, mantendo a data de fim do teste de cada uma.
-- Não mexe em OS, clientes, orçamentos, caixa nem equipe.
--
-- Como rodar: Supabase → SQL Editor → cole tudo → Run.
-- =============================================================================
begin;

update public.assistances
   set mp_preapproval_id   = null,
       billing_cycle       = null,
       paid_until          = null,
       past_due_since      = null,
       billing_synced_at   = null,
       plan                = 'trial',
       subscription_status = case when subscription_status = 'suspended' then 'suspended' else 'trialing' end
 where mp_preapproval_id is not null
    or paid_until is not null
    or subscription_status in ('active', 'past_due', 'canceled');

delete from public.billing_payments;
delete from public.billing_subscriptions;

commit;

-- Conferência: deve mostrar 0 assinaturas e as assistências em teste.
select (select count(*) from public.billing_subscriptions) as assinaturas,
       (select count(*) from public.billing_payments)      as pagamentos,
       (select count(*) from public.assistances where subscription_status = 'trialing') as assistencias_em_teste;
