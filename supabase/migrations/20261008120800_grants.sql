-- =============================================================================
-- Conserta Já · 0009 · Permissões finais
-- O Supabase concede tudo a anon/authenticated por padrão; aqui fechamos e
-- liberamos só o necessário. O RLS continua sendo a barreira principal.
-- =============================================================================

-- anon (visitante do portal) não lê nem grava nenhuma tabela ou view.
revoke all on all tables in schema public from anon;

-- Funções: ninguém executa nada por padrão...
revoke execute on all functions in schema public from public, anon, authenticated;

-- ...equipe logada
grant execute on function public.create_assistance(text, text)                 to authenticated;
grant execute on function public.my_assistances()                              to authenticated;
grant execute on function public.switch_assistance(uuid)                       to authenticated;
grant execute on function public.create_invitation(text, text)                 to authenticated;
grant execute on function public.accept_invitation(text)                       to authenticated;
grant execute on function public.team_members()                                to authenticated;
grant execute on function public.anonymize_customer(uuid)                      to authenticated;
grant execute on function public.create_service_order(jsonb)                   to authenticated;
grant execute on function public.change_service_order_status(uuid, text, text) to authenticated;
grant execute on function public.regenerate_access_code(uuid)                  to authenticated;
grant execute on function public.create_budget_version(uuid)                   to authenticated;
grant execute on function public.send_budget_version(uuid, int)                to authenticated;
grant execute on function public.staff_decide_budget(uuid, text, text, text)   to authenticated;
grant execute on function public.revoke_customer_portal_sessions(uuid)         to authenticated;
grant execute on function public.void_cash_transaction(uuid, text)             to authenticated;
grant execute on function public.service_order_balance(uuid)                   to authenticated;
grant execute on function public.dashboard_summary(date, date)                 to authenticated;
grant execute on function public.report_summary(date, date)                    to authenticated;

-- ...portal do cliente (o servidor Next.js chama com a chave publishable)
grant execute on function public.invitation_preview(text)                                       to anon, authenticated;
grant execute on function public.portal_assistance(text)                                        to anon, authenticated;
grant execute on function public.portal_login(text, text, text, text, text)                     to anon, authenticated;
grant execute on function public.portal_logout(text)                                            to anon, authenticated;
grant execute on function public.portal_me(text, text)                                          to anon, authenticated;
grant execute on function public.portal_list_orders(text, text)                                 to anon, authenticated;
grant execute on function public.portal_get_order(text, text, text)                             to anon, authenticated;
grant execute on function public.portal_get_budget(text, text, text, int)                       to anon, authenticated;
grant execute on function public.portal_decide_budget(text, text, uuid, text, text, text, text, text) to anon, authenticated;

-- Funções auxiliares usadas dentro de funções SECURITY INVOKER
grant execute on function private.set_status_context(text, text, boolean) to authenticated;

-- service_role (scripts administrativos) mantém acesso total
grant execute on all functions in schema public  to service_role;
grant execute on all functions in schema private to service_role;
