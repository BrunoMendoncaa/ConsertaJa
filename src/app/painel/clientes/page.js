import Link from 'next/link';
import { Users, Plus, Search } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink, Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, THead, TBody, TH, TD } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { formatPhone } from '@/lib/phone';
import { formatDocument } from '@/lib/document';
import { formatDate } from '@/lib/dates';

export const metadata = { title: 'Clientes' };
const PAGE_SIZE = 30;

export default async function CustomersPage({ searchParams }) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const q = typeof sp?.q === 'string' ? sp.q.trim() : '';
  const page = Math.max(1, Number(sp?.pagina) || 1);

  let query = supabase
    .from('customers')
    .select('id, name, phone, document, email, created_at, anonymized_at', { count: 'exact' })
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) {
    const digits = q.replace(/\D/g, '');
    const safe = q.replace(/[^\p{L}\p{N}\s.'-]/gu, ' ').trim();
    const filters = [];
    if (safe) filters.push(`name.ilike.%${safe}%`);
    if (digits.length >= 4) filters.push(`phone_e164.ilike.%${digits}%`, `document.ilike.%${digits}%`);
    if (filters.length) query = query.or(filters.join(','));
  }

  const { data: customers, count } = await query;
  const pages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${count ?? 0} cliente(s)`}
        actions={<ButtonLink href="/painel/clientes/novo"><Plus className="size-4" aria-hidden="true" /> Novo cliente</ButtonLink>}
      />
      <form className="mb-4 flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Buscar por nome, telefone ou CPF/CNPJ" className="max-w-md" />
        <Button type="submit" variant="outline"><Search className="size-4" aria-hidden="true" /> Buscar</Button>
      </form>
      <Card>
        {customers?.length ? (
          <Table>
            <THead>
              <tr><TH>Nome</TH><TH>Telefone</TH><TH className="hidden md:table-cell">CPF/CNPJ</TH><TH className="hidden lg:table-cell">Cliente desde</TH></tr>
            </THead>
            <TBody>
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <TD>
                    <Link href={`/painel/clientes/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">{c.name}</Link>
                    {c.email && <p className="text-xs text-slate-500">{c.email}</p>}
                  </TD>
                  <TD className="whitespace-nowrap">{formatPhone(c.phone)}</TD>
                  <TD className="hidden md:table-cell">{c.document ? formatDocument(c.document) : '—'}</TD>
                  <TD className="hidden lg:table-cell">{formatDate(c.created_at)}</TD>
                </tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState
            icon={Users}
            title={q ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}
            description={q ? 'Tente buscar por outro termo.' : 'Os clientes também são cadastrados ao abrir uma OS.'}
            action={<ButtonLink href="/painel/clientes/novo" variant="outline">Cadastrar cliente</ButtonLink>}
          />
        )}
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>Página {page} de {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <ButtonLink variant="outline" size="sm" href={`?q=${encodeURIComponent(q)}&pagina=${page - 1}`}>Anterior</ButtonLink>}
            {page < pages && <ButtonLink variant="outline" size="sm" href={`?q=${encodeURIComponent(q)}&pagina=${page + 1}`}>Próxima</ButtonLink>}
          </div>
        </div>
      )}
    </>
  );
}
