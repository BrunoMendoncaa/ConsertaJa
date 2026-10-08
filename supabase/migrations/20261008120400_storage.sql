-- =============================================================================
-- Conserta Já · 0005 · Storage
-- Fotos de OS em bucket PRIVADO, uma pasta por assistência:
--   service-order-photos/{assistance_id}/{service_order_id}/{uuid}.webp
-- Logos em bucket público (leitura), gravação só por owner/admin:
--   logos/{assistance_id}/logo-{timestamp}.webp
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('service-order-photos', 'service-order-photos', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('logos',                'logos',                true,  2097152,  array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Fotos de OS ---------------------------------------------------------------
create policy os_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'service-order-photos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
  );

create policy os_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'service-order-photos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
  );

create policy os_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'service-order-photos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
    and (select private.has_role(array['owner','admin']))
  );

-- Logos -----------------------------------------------------------------------
create policy logos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
  );

create policy logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
    and (select private.has_role(array['owner','admin']))
  );

create policy logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
    and (select private.has_role(array['owner','admin']))
  );

create policy logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select private.current_assistance_id())::text
    and (select private.has_role(array['owner','admin']))
  );
