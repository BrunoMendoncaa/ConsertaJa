-- =============================================================================
-- Conserta Já · 0010 · Certificado de garantia no portal do cliente
-- - portal_get_warranty: dados do certificado/termo de retirada de uma OS
--   ENTREGUE do próprio cliente (assistência e cliente vêm DA SESSÃO).
-- - portal_login: o código da OS continua valendo durante a garantia.
-- Não altera tabelas; pode ser aplicada num banco que já tem 0001–0009.
-- =============================================================================

create or replace function public.portal_get_warranty(p_token text, p_slug text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s    public.portal_sessions := private.portal_session(p_token, p_slug);
  v_os public.service_orders;
  v_a  public.assistances;
  v_b  public.budget_versions;
begin
  select so.* into v_os
  from public.service_orders so
  where so.assistance_id = s.assistance_id      -- tenant vem da sessão
    and so.customer_id   = s.customer_id        -- cliente vem da sessão
    and so.code = upper(p_code)
    and so.status = 'ENTREGUE';

  if not found then
    return null;
  end if;

  select a.* into v_a from public.assistances a where a.id = s.assistance_id;

  select b.* into v_b
  from public.budget_versions b
  where b.service_order_id = v_os.id and b.status = 'APROVADO'
  order by b.version desc
  limit 1;

  return jsonb_build_object(
    'assistance', jsonb_build_object(
      'name', v_a.name, 'legal_name', v_a.legal_name, 'document', v_a.document,
      'phone', v_a.phone, 'whatsapp', v_a.whatsapp, 'email', v_a.email, 'address', v_a.address,
      'logo_path', v_a.logo_path, 'warranty_policy', v_a.warranty_policy),
    'order', jsonb_build_object(
      'code', v_os.code, 'status', v_os.status, 'outcome', v_os.outcome,
      'received_at', v_os.received_at, 'delivered_at', v_os.delivered_at, 'warranty_until', v_os.warranty_until,
      'reported_issue', v_os.reported_issue, 'diagnosis', v_os.diagnosis, 'solution', v_os.solution,
      'accessories', to_jsonb(v_os.accessories),
      'customer', (select jsonb_build_object('name', c.name, 'phone', c.phone, 'document', c.document)
                   from public.customers c where c.id = v_os.customer_id),
      'equipment', (select jsonb_build_object(
                       'brand', e.brand, 'model', e.model, 'serial_number', e.serial_number, 'imei', e.imei,
                       'color', e.color, 'category', jsonb_build_object('name', cat.name))
                    from public.equipment e
                    join public.equipment_categories cat on cat.id = e.category_id
                    where e.id = v_os.equipment_id)),
    -- Só os itens do snapshot aprovado (o que o cliente já viu); nada de notas internas.
    'approved', case when v_b.id is null then null else jsonb_build_object(
      'version', v_b.version, 'warranty_days', v_b.warranty_days, 'total', v_b.total,
      'snapshot', jsonb_build_object('items', coalesce(v_b.snapshot -> 'items', '[]'::jsonb))) end
  );
end;
$$;

revoke execute on function public.portal_get_warranty(text, text, text) from public;
grant execute on function public.portal_get_warranty(text, text, text) to anon, authenticated, service_role;

-- Login (mesma função de 0007): agora o código de uma OS entregue também vale
-- enquanto a garantia estiver em vigor, para o cliente abrir o certificado.
-- Nunca lança erro em falha (para que a tentativa fique registrada): devolve error.
create or replace function public.portal_login(
  p_slug text, p_phone text, p_code text, p_ip text default null, p_user_agent text default null)
returns table (token text, error_message text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_assistance uuid;
  v_phone   text := private.normalize_br_phone(p_phone);
  v_code    text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_ip      inet := private.safe_inet(p_ip);
  v_customer uuid;
  v_ok      boolean := false;
  v_token   text;
begin
  select a.id into v_assistance
  from public.assistances a
  where a.slug = lower(p_slug) and a.subscription_status not in ('suspended','canceled');

  if v_assistance is null then
    return query select null::text, 'Assistência não encontrada.'::text;
    return;
  end if;

  -- Limites contra força bruta
  if (select count(*) from public.portal_login_attempts t
      where t.assistance_id = v_assistance and t.phone_e164 = v_phone and not t.success
        and t.created_at > now() - interval '15 minutes') >= 5
     or (v_ip is not null and (select count(*) from public.portal_login_attempts t
      where t.ip = v_ip and not t.success and t.created_at > now() - interval '1 hour') >= 20) then
    return query select null::text, 'Muitas tentativas. Aguarde 15 minutos e tente novamente.'::text;
    return;
  end if;

  if v_phone is not null and length(v_code) = 6 then
    select c.id into v_customer
    from public.customers c
    where c.assistance_id = v_assistance and c.phone_e164 = v_phone and c.anonymized_at is null;

    if v_customer is not null then
      select true into v_ok
      from public.service_orders so
      where so.assistance_id = v_assistance
        and so.customer_id = v_customer
        and so.access_code = v_code
        and (so.status not in ('ENTREGUE','CANCELADO')
             or so.updated_at > now() - interval '90 days'
             or so.warranty_until >= private.today_br())   -- vale enquanto durar a garantia
      limit 1;
    end if;
  end if;

  insert into public.portal_login_attempts (assistance_id, phone_e164, ip, success)
  values (v_assistance, v_phone, v_ip, coalesce(v_ok, false));

  if not coalesce(v_ok, false) then
    return query select null::text, 'Telefone ou código não conferem.'::text;
    return;
  end if;

  v_token := private.random_token();
  insert into public.portal_sessions (assistance_id, customer_id, token_hash, login_method, ip, user_agent)
  values (v_assistance, v_customer, private.hash_token(v_token), 'ACCESS_CODE', v_ip, left(p_user_agent, 500));

  return query select v_token, null::text;
end;
$$;
