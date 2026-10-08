import { Truck } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input, Textarea, Select } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { EmptyState } from '@/components/ui/empty-state';
import { createSupplier, updateSupplier } from '@/features/finance/actions';
import { TECH_ROLES } from '@/lib/constants';

export const metadata = { title: 'Fornecedores' };

function SupplierFields({ s = {} }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nome" name="name" required><Input name="name" defaultValue={s.name || ''} /></Field>
      <Field label="Telefone" name="phone"><Input name="phone" defaultValue={s.phone || ''} /></Field>
      <Field label="CNPJ/CPF" name="document"><Input name="document" defaultValue={s.document || ''} /></Field>
      <Field label="Observações" name="notes" className="sm:col-span-2"><Textarea name="notes" rows={2} defaultValue={s.notes || ''} /></Field>
    </div>
  );
}

export default async function SuppliersPage() {
  const { supabase } = await requireStaff(TECH_ROLES);
  const { data: suppliers } = await supabase.from('suppliers').select('*').order('active', { ascending: false }).order('name');

  return (
    <>
      <PageHeader title="Fornecedores" description="Usados nos lançamentos de compra de peças." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`${suppliers?.length || 0} fornecedor(es)`} />
          {suppliers?.length ? (
            <ul className="divide-y divide-slate-100">
              {suppliers.map((s) => (
                <li key={s.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className={`font-medium ${s.active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{s.name}</p>
                      <p className="text-sm text-slate-500">{[s.phone, s.document, s.notes].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                  <Toggle label="Editar" buttonClassName="mt-1 text-xs font-medium text-brand-700 hover:underline">
                    <ActionForm action={updateSupplier.bind(null, s.id)} className="mt-2 space-y-3 rounded-lg border border-slate-200 p-3">
                      <SupplierFields s={s} />
                      <Field label="Situação" name="active">
                        <Select name="active" defaultValue={String(s.active)} className="w-40">
                          <option value="true">Ativo</option>
                          <option value="false">Inativo</option>
                        </Select>
                      </Field>
                      <SubmitButton size="sm">Salvar</SubmitButton>
                    </ActionForm>
                  </Toggle>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Truck} title="Nenhum fornecedor" />}
        </Card>
        <Card className="h-fit">
          <CardHeader title="Novo fornecedor" />
          <CardContent>
            <ActionForm action={createSupplier} resetOnSuccess className="space-y-3">
              <SupplierFields />
              <SubmitButton>Cadastrar</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
