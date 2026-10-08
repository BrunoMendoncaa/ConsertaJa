import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { moneyInputValue } from '@/lib/money';
import { ITEM_KINDS } from '@/lib/constants';

export function ItemFields({ item = {}, idPrefix = 'new' }) {
  const id = (k) => `${idPrefix}_${k}`;
  return (
    <div className="grid gap-3 sm:grid-cols-12">
      <Field label="Tipo" name="kind" className="sm:col-span-3">
        <Select id={id('kind')} name="kind" defaultValue={item.kind || 'SERVICO'}>
          {Object.entries(ITEM_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Descrição" name="description" className="sm:col-span-4">
        <Input id={id('description')} name="description" defaultValue={item.description || ''} placeholder="Ex.: Display original, Mão de obra" />
      </Field>
      <Field label="Qtd" name="quantity" className="sm:col-span-1">
        <Input id={id('quantity')} name="quantity" inputMode="decimal" defaultValue={item.quantity ? String(Number(item.quantity)).replace('.', ',') : '1'} />
      </Field>
      <Field label="Valor unitário" name="unit_price" className="sm:col-span-2">
        <Input id={id('unit_price')} name="unit_price" inputMode="decimal" placeholder="0,00" defaultValue={moneyInputValue(item.unit_price)} />
      </Field>
      <Field label="Desconto" name="discount_amount" className="sm:col-span-2">
        <Input id={id('discount_amount')} name="discount_amount" inputMode="decimal" placeholder="0,00" defaultValue={Number(item.discount_amount) > 0 ? moneyInputValue(item.discount_amount) : ''} />
      </Field>
    </div>
  );
}
