import Link from 'next/link';
import { Smartphone, Search } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, THead, TBody, TH, TD } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata = { title: 'Equipamentos' };

export default async function EquipmentListPage({ searchParams }) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const q = typeof sp?.q === 'string' ? sp.q.trim() : '';

  let query = supabase
    .from('equipment')
    .select('id, brand, model, serial_number, imei, color, created_at, category:equipment_categories!equipment_category_fk(name), customer:customers!equipment_customer_fk(id, name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (q) {
    const safe = q.replace(/[^\p{L}\p{N}\s.'-]/gu, ' ').trim();
    if (safe) query = query.or(`brand.ilike.%${safe}%,model.ilike.%${safe}%,serial_number.ilike.%${safe}%,imei.ilike.%${safe}%`);
  }
  const { data: items } = await query;

  return (
    <>
      <PageHeader title="Equipamentos" description="Busque por marca, modelo, número de série ou IMEI." />
      <form className="mb-4 flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Ex.: iPhone, 3567890…, LG50UR" className="max-w-md" />
        <Button type="submit" variant="outline"><Search className="size-4" aria-hidden="true" /> Buscar</Button>
      </form>
      <Card>
        {items?.length ? (
          <Table>
            <THead><tr><TH>Equipamento</TH><TH>Cliente</TH><TH className="hidden md:table-cell">Série / IMEI</TH></tr></THead>
            <TBody>
              {items.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <TD>
                    <Link href={`/painel/equipamentos/${e.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {[e.brand, e.model].filter(Boolean).join(' ') || 'Equipamento'}
                    </Link>
                    <p className="text-xs text-slate-500">{[e.category?.name, e.color].filter(Boolean).join(' · ')}</p>
                  </TD>
                  <TD><Link href={`/painel/clientes/${e.customer?.id}`} className="hover:text-brand-700">{e.customer?.name}</Link></TD>
                  <TD className="hidden text-xs md:table-cell">{[e.serial_number, e.imei].filter(Boolean).join(' · ') || '—'}</TD>
                </tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState icon={Smartphone} title="Nenhum equipamento encontrado" description="Equipamentos são cadastrados no cliente ou ao abrir uma OS." />
        )}
      </Card>
    </>
  );
}
