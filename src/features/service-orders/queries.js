import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/supabase/env';

export function portalLink(slug, accessCode) {
  return `${SITE_URL}/a/${slug}${accessCode ? `?c=${accessCode}` : ''}`;
}

export async function getServiceOrder(id) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_orders')
    .select(`*,
      customer:customers!service_orders_customer_fk(id, name, phone, phone_e164, email, document, anonymized_at),
      equipment:equipment!service_orders_equipment_fk(id, brand, model, serial_number, imei, color, description,
        category:equipment_categories!equipment_category_fk(name))`)
    .eq('id', id)
    .maybeSingle();
  return data;
}

/** Fotos com URL assinada de 10 minutos (bucket privado). */
export async function getPhotosWithUrls(serviceOrderId) {
  const supabase = await createClient();
  const { data: photos } = await supabase
    .from('service_order_photos')
    .select('id, storage_path, kind, stage, description, visible_to_customer, created_at')
    .eq('service_order_id', serviceOrderId)
    .order('created_at');
  if (!photos?.length) return [];
  const { data: signed } = await supabase.storage
    .from('service-order-photos')
    .createSignedUrls(photos.map((p) => p.storage_path), 600);
  const urlByPath = new Map((signed || []).map((s) => [s.path, s.signedUrl]));
  return photos.map((p) => ({ ...p, url: urlByPath.get(p.storage_path) || null }));
}
