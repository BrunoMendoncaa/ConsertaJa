import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { CustomerFields } from '@/features/customers/components/customer-fields';
import { createCustomer } from '@/features/customers/actions';

export const metadata = { title: 'Novo cliente' };

export default async function NewCustomerPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Novo cliente" back={{ href: '/painel/clientes', label: 'Clientes' }} />
      <Card className="max-w-3xl">
        <CardContent className="py-6">
          <ActionForm action={createCustomer} className="space-y-6">
            <CustomerFields />
            <div className="flex justify-end">
              <SubmitButton pendingText="Salvando...">Salvar cliente</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </>
  );
}
