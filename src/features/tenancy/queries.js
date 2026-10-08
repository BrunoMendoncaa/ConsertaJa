import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function getCategories({ includeInactive = false } = {}) {
  const supabase = await createClient();
  let q = supabase.from('equipment_categories').select('id, name, assistance_id, active, sort_order')
    .order('sort_order').order('name');
  if (!includeInactive) q = q.eq('active', true);
  const { data } = await q;
  return data || [];
}

export async function getMyAssistances() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_assistances');
  return data || [];
}

export async function getTechnicians() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('team_members');
  return (data || []).filter((m) => m.active && ['owner', 'admin', 'technician'].includes(m.role));
}

/** URL pública do logo (bucket público). */
export function logoUrl(path, version) {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/logos/${path}${version ? `?v=${encodeURIComponent(version)}` : ''}`;
}
