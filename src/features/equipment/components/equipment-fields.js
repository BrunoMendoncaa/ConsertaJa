import { Field } from '@/components/ui/field';
import { Input, Textarea, Select } from '@/components/ui/input';

export function EquipmentFields({ equipment = {}, categories = [], prefix = '', compact = false }) {
  const n = (k) => `${prefix}${k}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Categoria" name={n('category_id')} required>
        <Select id={n('category_id')} name={n('category_id')} defaultValue={equipment.category_id || ''}>
          <option value="" disabled>Selecione…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Marca" name={n('brand')}>
        <Input id={n('brand')} name={n('brand')} defaultValue={equipment.brand || ''} placeholder="Samsung, Apple, LG…" />
      </Field>
      <Field label="Modelo" name={n('model')}>
        <Input id={n('model')} name={n('model')} defaultValue={equipment.model || ''} placeholder="Galaxy A54, iPhone 13…" />
      </Field>
      <Field label="Cor" name={n('color')}>
        <Input id={n('color')} name={n('color')} defaultValue={equipment.color || ''} />
      </Field>
      <Field label="Número de série" name={n('serial_number')}>
        <Input id={n('serial_number')} name={n('serial_number')} defaultValue={equipment.serial_number || ''} />
      </Field>
      <Field label="IMEI" name={n('imei')} hint="Celulares: *#06# no discador.">
        <Input id={n('imei')} name={n('imei')} inputMode="numeric" defaultValue={equipment.imei || ''} />
      </Field>
      {!compact && (
        <>
          <Field label="Descrição" name={n('description')} className="sm:col-span-2">
            <Input id={n('description')} name={n('description')} defaultValue={equipment.description || ''} />
          </Field>
          <Field label="Observações" name={n('notes')} className="sm:col-span-2">
            <Textarea id={n('notes')} name={n('notes')} defaultValue={equipment.notes || ''} />
          </Field>
        </>
      )}
    </div>
  );
}
