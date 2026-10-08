-- =============================================================================
-- Conserta Já · Dados fictícios para desenvolvimento
-- Roda depois das migrations (supabase db reset). Usa as próprias funções do
-- sistema, então também serve de teste de ponta a ponta do fluxo.
--
-- Logins (senha de todos: consertaja123)
--   ana@techsp.dev       proprietária · Assistência Tech São Paulo
--   bruno@techsp.dev     técnico      · Assistência Tech São Paulo
--   carla@techsp.dev     atendente    · Assistência Tech São Paulo
--   diego@rapidorio.dev  proprietário · Conserta Rápido Rio
-- =============================================================================

begin;

-- Usuários do Auth -------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('consertaja123', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', u.full_name), now(), now(), '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'ana@techsp.dev',      'Ana Souza'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bruno@techsp.dev',    'Bruno Lima'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'carla@techsp.dev',    'Carla Mendes'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'diego@rapidorio.dev', 'Diego Rocha')
) as u(id, email, full_name);

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('ana@techsp.dev','bruno@techsp.dev','carla@techsp.dev','diego@rapidorio.dev');

-- Fluxo completo ---------------------------------------------------------------
do $$
declare
  ana   constant uuid := '11111111-1111-4111-8111-111111111111';
  bruno constant uuid := '22222222-2222-4222-8222-222222222222';
  carla constant uuid := '33333333-3333-4333-8333-333333333333';
  diego constant uuid := '44444444-4444-4444-8444-444444444444';
  a_sp uuid; a_rio uuid;
  cat_cel uuid; cat_tv uuid; cat_note uuid; cat_game uuid; cat_eletro uuid;
  r record;
  os_iphone uuid; os_tv uuid; os_note uuid; os_ps5 uuid; os_galaxy uuid; os_micro uuid; os_rio uuid;
  b uuid;
  sup uuid;
begin
  select id into cat_cel    from public.equipment_categories where assistance_id is null and name = 'Celular';
  select id into cat_tv     from public.equipment_categories where assistance_id is null and name = 'Televisão';
  select id into cat_note   from public.equipment_categories where assistance_id is null and name = 'Notebook';
  select id into cat_game   from public.equipment_categories where assistance_id is null and name = 'Videogame';
  select id into cat_eletro from public.equipment_categories where assistance_id is null and name = 'Eletrodoméstico';

  -- Assistência A ------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
  a_sp := public.create_assistance('Assistência Tech São Paulo', 'assistencia-tech-sp');

  update public.assistances set
    legal_name = 'Tech SP Assistência Técnica Ltda', document = '12345678000190',
    phone = '(11) 3333-4444', whatsapp = '(11) 98888-7777', email = 'contato@techsp.dev',
    address = '{"cep":"01310-100","rua":"Av. Paulista","numero":"1000","complemento":"Loja 12","bairro":"Bela Vista","cidade":"São Paulo","uf":"SP"}',
    brand_color = '#1d4ed8', business_hours = 'Seg a sex, 9h às 18h · Sáb, 9h às 13h',
    welcome_message = 'Acompanhe aqui o conserto do seu equipamento.',
    warranty_policy = 'Garantia de 90 dias para o serviço executado e peças trocadas, conforme o CDC.',
    entry_terms = 'Equipamentos não retirados em até 90 dias após o aviso de conclusão poderão ser considerados abandonados.',
    default_payment_terms = 'PIX, cartão de crédito em até 3x ou dinheiro.',
    diagnosis_fee = 50
  where id = a_sp;

  insert into public.assistance_members (assistance_id, user_id, role) values
    (a_sp, bruno, 'technician'), (a_sp, carla, 'attendant');
  update public.profiles set active_assistance_id = a_sp where id in (bruno, carla);

  -- OS 1: João · iPhone 13 · orçamento enviado, aguardando o cliente --------
  perform set_config('request.jwt.claims', json_build_object('sub', carla, 'role', 'authenticated')::text, true);
  select * into r from public.create_service_order(jsonb_build_object(
    'customer', jsonb_build_object('name', 'João da Silva', 'phone', '(11) 98765-4321', 'email', 'joao@exemplo.com'),
    'equipment', jsonb_build_object('category_id', cat_cel, 'brand', 'Apple', 'model', 'iPhone 13', 'color', 'Azul', 'imei', '356789012345678'),
    'reported_issue', 'Tela quebrada após queda. Touch não responde na parte de baixo.',
    'accessories', jsonb_build_array('Capa', 'Película'),
    'entry_condition', jsonb_build_object('liga', true, 'tela_trincada', true, 'riscos', true),
    'unlock_code', '123456',
    'technician_id', bruno,
    'estimated_completion_at', now() + interval '3 days'));
  os_iphone := r.id;

  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  perform public.change_service_order_status(os_iphone, 'EM_DIAGNOSTICO', null);
  update public.service_orders set diagnosis = 'Display danificado; necessária a substituição do conjunto da tela.' where id = os_iphone;
  b := public.create_budget_version(os_iphone);
  insert into public.budget_items (budget_version_id, position, kind, description, quantity, unit_price) values
    (b, 1, 'PECA', 'Display Apple iPhone 13 (original)', 1, 450.00),
    (b, 2, 'SERVICO', 'Mão de obra', 1, 150.00),
    (b, 3, 'SERVICO', 'Limpeza interna', 1, 50.00);
  update public.budget_versions set estimated_days = 3, technical_notes = 'Teste de Face ID após a troca.' where id = b;
  perform public.send_budget_version(b, null);

  -- OS 2: João · TV LG 50" · v1 recusada, v2 aprovada no balcão, em manutenção
  perform set_config('request.jwt.claims', json_build_object('sub', carla, 'role', 'authenticated')::text, true);
  select * into r from public.create_service_order(jsonb_build_object(
    'customer_id', (select id from public.customers where assistance_id = a_sp and phone_e164 = '+5511987654321'),
    'equipment', jsonb_build_object('category_id', cat_tv, 'brand', 'LG', 'model', 'Smart TV 50" 50UR8750', 'serial_number', 'LG50UR-0098'),
    'reported_issue', 'Liga, tem som, mas não aparece imagem.',
    'accessories', jsonb_build_array('Controle remoto'),
    'technician_id', bruno));
  os_tv := r.id;

  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  perform public.change_service_order_status(os_tv, 'EM_DIAGNOSTICO', null);
  update public.service_orders set diagnosis = 'Barramento de LED queimado.' where id = os_tv;
  b := public.create_budget_version(os_tv);
  insert into public.budget_items (budget_version_id, position, kind, description, quantity, unit_price) values
    (b, 1, 'PECA', 'Kit de barras de LED (paralelo)', 1, 350.00),
    (b, 2, 'SERVICO', 'Mão de obra', 1, 150.00);
  update public.budget_versions set estimated_days = 5 where id = b;
  perform public.send_budget_version(b, null);

  perform set_config('request.jwt.claims', json_build_object('sub', carla, 'role', 'authenticated')::text, true);
  perform public.staff_decide_budget(b, 'RECUSADO', 'TELEFONE', 'Prefere peça original.');

  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  b := public.create_budget_version(os_tv);
  update public.budget_items set description = 'Kit de barras de LED original LG', unit_price = 500.00
   where budget_version_id = b and position = 1;
  perform public.send_budget_version(b, null);

  perform set_config('request.jwt.claims', json_build_object('sub', carla, 'role', 'authenticated')::text, true);
  perform public.staff_decide_budget(b, 'APROVADO', 'BALCAO', null);

  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  perform public.change_service_order_status(os_tv, 'EM_MANUTENCAO', null);

  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
  insert into public.suppliers (name, phone, notes) values ('Fornecedor XYZ', '(11) 2222-3333', 'Peças originais LG e Samsung')
  returning id into sup;
  insert into public.cash_transactions (direction, category, amount, occurred_at, payment_method, description, quantity, service_order_id, supplier_id)
  values ('OUT', 'COMPRA_PECA', 350.00, now() - interval '1 day', 'PIX', 'Kit de barras de LED original LG', 1, os_tv, sup);
  insert into public.cash_transactions (direction, category, amount, occurred_at, payment_method, description, service_order_id)
  values ('IN', 'RECEBIMENTO_OS', 300.00, now() - interval '1 day', 'PIX', 'Sinal do conserto da TV', os_tv);

  -- OS 3: Maria · Notebook · reparado e entregue, pago -----------------------
  perform set_config('request.jwt.claims', json_build_object('sub', carla, 'role', 'authenticated')::text, true);
  select * into r from public.create_service_order(jsonb_build_object(
    'customer', jsonb_build_object('name', 'Maria Oliveira', 'phone', '11 97654-3210', 'document', '52998224725'),
    'equipment', jsonb_build_object('category_id', cat_note, 'brand', 'Dell', 'model', 'Inspiron 15 3520'),
    'reported_issue', 'Muito lento e esquentando.',
    'accessories', jsonb_build_array('Carregador'),
    'technician_id', bruno));
  os_note := r.id;

  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  perform public.change_service_order_status(os_note, 'EM_DIAGNOSTICO', null);
  update public.service_orders set diagnosis = 'Pasta térmica ressecada e HD com setores defeituosos.' where id = os_note;
  b := public.create_budget_version(os_note);
  insert into public.budget_items (budget_version_id, position, kind, description, quantity, unit_price, discount_amount) values
    (b, 1, 'PECA', 'SSD 480 GB', 1, 230.00, 0),
    (b, 2, 'SERVICO', 'Limpeza e troca de pasta térmica', 1, 80.00, 0),
    (b, 3, 'SERVICO', 'Instalação do sistema e migração de arquivos', 1, 100.00, 30.00);
  update public.budget_versions set estimated_days = 2 where id = b;
  perform public.send_budget_version(b, null);
  perform public.staff_decide_budget(b, 'APROVADO', 'WHATSAPP', null);
  perform public.change_service_order_status(os_note, 'EM_MANUTENCAO', null);
  insert into public.cash_transactions (direction, category, amount, occurred_at, payment_method, description, quantity, service_order_id, supplier_id)
  values ('OUT', 'COMPRA_PECA', 160.00, now() - interval '4 days', 'CARTAO_DEBITO', 'SSD 480 GB', 1, os_note, sup);
  update public.service_orders set solution = 'SSD instalado, sistema reinstalado, limpeza completa.' where id = os_note;
  perform public.change_service_order_status(os_note, 'PRONTO', null);

  perform set_config('request.jwt.claims', json_build_object('sub', carla, 'role', 'authenticated')::text, true);
  insert into public.cash_transactions (direction, category, amount, occurred_at, payment_method, description, service_order_id)
  values ('IN', 'RECEBIMENTO_OS', 380.00, now() - interval '2 days', 'CARTAO_CREDITO', 'Pagamento do conserto do notebook', os_note);
  perform public.change_service_order_status(os_note, 'ENTREGUE', null);

  -- OS 4: Carlos · PS5 · orçamento recusado, devolvido sem reparo com taxa ----
  select * into r from public.create_service_order(jsonb_build_object(
    'customer', jsonb_build_object('name', 'Carlos Pereira', 'phone', '(11) 96543-2109'),
    'equipment', jsonb_build_object('category_id', cat_game, 'brand', 'Sony', 'model', 'PlayStation 5'),
    'reported_issue', 'Desliga sozinho durante o jogo.',
    'accessories', jsonb_build_array('Cabo de força', 'Cabo HDMI')));
  os_ps5 := r.id;

  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  perform public.change_service_order_status(os_ps5, 'EM_DIAGNOSTICO', null);
  update public.service_orders set diagnosis = 'Fonte interna com defeito.' where id = os_ps5;
  b := public.create_budget_version(os_ps5);
  insert into public.budget_items (budget_version_id, position, kind, description, quantity, unit_price) values
    (b, 1, 'PECA', 'Fonte de alimentação PS5', 1, 420.00),
    (b, 2, 'SERVICO', 'Mão de obra', 1, 130.00);
  update public.budget_versions set estimated_days = 7, discount_amount = 50.00 where id = b;
  perform public.send_budget_version(b, null);

  perform set_config('request.jwt.claims', json_build_object('sub', carla, 'role', 'authenticated')::text, true);
  perform public.staff_decide_budget(b, 'RECUSADO', 'BALCAO', 'Vai comprar um console novo.');
  perform public.change_service_order_status(os_ps5, 'PRONTO', 'Cliente vai retirar sem reparo.');
  insert into public.cash_transactions (direction, category, amount, occurred_at, payment_method, description, service_order_id)
  values ('IN', 'TAXA_DIAGNOSTICO', 50.00, now(), 'DINHEIRO', 'Taxa de diagnóstico', os_ps5);
  perform public.change_service_order_status(os_ps5, 'ENTREGUE', null);

  -- OS 5 e 6: recém-chegadas -------------------------------------------------
  select * into r from public.create_service_order(jsonb_build_object(
    'customer_id', (select id from public.customers where assistance_id = a_sp and phone_e164 = '+5511976543210'),
    'equipment', jsonb_build_object('category_id', cat_cel, 'brand', 'Samsung', 'model', 'Galaxy A54'),
    'reported_issue', 'Não carrega.', 'priority', 'ALTA',
    'accessories', jsonb_build_array('Carregador')));
  os_galaxy := r.id;

  select * into r from public.create_service_order(jsonb_build_object(
    'customer_id', (select id from public.customers where assistance_id = a_sp and phone_e164 = '+5511965432109'),
    'equipment', jsonb_build_object('category_id', cat_eletro, 'brand', 'Electrolux', 'model', 'Micro-ondas MEO44'),
    'reported_issue', 'Liga mas não esquenta.',
    'technician_id', bruno));
  os_micro := r.id;
  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  perform public.change_service_order_status(os_micro, 'EM_DIAGNOSTICO', null);

  -- Despesa operacional
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
  insert into public.cash_transactions (direction, category, amount, occurred_at, payment_method, description)
  values ('OUT', 'DESPESA_OPERACIONAL', 280.00, now() - interval '3 days', 'BOLETO', 'Conta de energia elétrica');

  -- Datas de entrada espalhadas na última semana (para o dashboard)
  update public.service_orders set received_at = now() - interval '6 days' where id in (os_note, os_ps5);
  update public.service_orders set received_at = now() - interval '3 days' where id = os_tv;
  update public.service_orders set received_at = now() - interval '1 day'  where id = os_iphone;

  -- Assistência B (para testar isolamento) -----------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', diego, 'role', 'authenticated')::text, true);
  a_rio := public.create_assistance('Conserta Rápido Rio', 'conserta-rapido-rio');
  update public.assistances set phone = '(21) 3555-1000', whatsapp = '(21) 99999-1000', brand_color = '#047857',
    address = '{"rua":"Rua da Assembleia","numero":"10","bairro":"Centro","cidade":"Rio de Janeiro","uf":"RJ"}'
  where id = a_rio;

  -- Mesmo telefone do João, em outra assistência: são clientes diferentes.
  select * into r from public.create_service_order(jsonb_build_object(
    'customer', jsonb_build_object('name', 'João da Silva', 'phone', '(11) 98765-4321'),
    'equipment', jsonb_build_object('category_id', cat_note, 'brand', 'Lenovo', 'model', 'IdeaPad 3'),
    'reported_issue', 'Teclado com teclas falhando.'));
  os_rio := r.id;

  select * into r from public.create_service_order(jsonb_build_object(
    'customer', jsonb_build_object('name', 'Fernanda Costa', 'phone', '(21) 99876-5432'),
    'equipment', jsonb_build_object('category_id', cat_cel, 'brand', 'Apple', 'model', 'iPhone 12'),
    'reported_issue', 'Bateria descarrega rápido.'));

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Códigos de acesso fixos para facilitar o teste do portal em desenvolvimento.
update public.service_orders so set access_code = 'TESTE7'
from public.customers c
where c.id = so.customer_id and c.name = 'João da Silva' and so.year = extract(year from now())::int and so.number = 1
  and so.assistance_id = (select id from public.assistances where slug = 'assistencia-tech-sp');

commit;
