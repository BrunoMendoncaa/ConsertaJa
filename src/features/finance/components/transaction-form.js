import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { createCashTransaction } from '@/features/finance/actions';
import { allowedCategories } from '@/features/finance/rules';
import { CASH_CATEGORIES, PAYMENT_METHODS } from '@/lib/constants';
import { todayISO } from '@/lib/dates';
import { moneyInputValue } from '@/lib/money';

/**
 * Formulário de lançamento. Dentro de uma OS, a OS vem fixa (serviceOrderId).
 * `only` limita as categorias exibidas (ex.: só recebimentos).
 */
export function TransactionForm({ role, serviceOrderId, suppliers = [], only, defaultCategory, defaultAmount, defaultDescription, submitLabel = 'Registrar' }) {
  const categories = allowedCategories(role).filter((c) => !only || only.includes(c));
  if (!categories.length) return null;
  return (
    <ActionForm action={createCashTransaction} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
      {serviceOrderId && <input type="hidden" name="service_order_id" value={serviceOrderId} />}
      <Field label="Categoria" name="category" required>
        <Select id="category" name="category" defaultValue={defaultCategory || categories[0]}>
          {categories.map((c) => <option key={c} value={c}>{CASH_CATEGORIES[c].label} ({CASH_CATEGORIES[c].direction === 'IN' ? 'entrada' : 'saída'})</option>)}
        </Select>
      </Field>
      <Field label="Valor (R$)" name="amount" required>
        <Input id="amount" name="amount" inputMode="decimal" placeholder="0,00" defaultValue={moneyInputValue(defaultAmount)} />
      </Field>
      <Field label="Forma de pagamento" name="payment_method" required>
        <Select id="payment_method" name="payment_method" defaultValue="PIX">
          {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Data" name="occurred_at" required>
        <Input id="occurred_at" name="occurred_at" type="date" defaultValue={todayISO()} max={todayISO()} />
      </Field>
      <Field label="Descrição" name="description" required className="sm:col-span-2">
        <Input id="description" name="description" defaultValue={defaultDescription || ''} placeholder="Ex.: Pagamento do conserto, Display iPhone 13…" />
      </Field>
      {!serviceOrderId && (
        <Field label="OS relacionada" name="service_order_code" hint="Número da OS (ex.: 123). Obrigatório para recebimentos.">
          <Input id="service_order_code" name="service_order_code" placeholder="123 ou OS-2026-000123" />
        </Field>
      )}
      {suppliers.length > 0 && (
        <Field label="Fornecedor" name="supplier_id">
          <Select id="supplier_id" name="supplier_id" defaultValue="">
            <option value="">—</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Quantidade (peças)" name="quantity">
        <Input id="quantity" name="quantity" inputMode="decimal" placeholder="Opcional" />
      </Field>
      <div className="flex items-end sm:col-span-2">
        <SubmitButton pendingText="Registrando...">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
