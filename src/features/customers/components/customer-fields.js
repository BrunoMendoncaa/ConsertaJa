import { Field } from '@/components/ui/field';
import { Input, Textarea, Select } from '@/components/ui/input';
import { BR_STATES } from '@/lib/constants';

/** Campos do cadastro de cliente. `prefix` permite reaproveitar dentro de outro formulário. */
export function CustomerFields({ customer = {}, prefix = '', compact = false }) {
  const n = (k) => `${prefix}${k}`;
  const a = customer.address || {};
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome completo" name={n('name')} required className="sm:col-span-2">
        <Input id={n('name')} name={n('name')} defaultValue={customer.name || ''} autoComplete="off" />
      </Field>
      <Field label="Telefone (WhatsApp)" name={n('phone')} required hint="Usado no acesso do cliente ao portal.">
        <Input id={n('phone')} name={n('phone')} type="tel" inputMode="tel" defaultValue={customer.phone || ''} placeholder="(11) 98765-4321" />
      </Field>
      <Field label="Telefone secundário" name={n('phone_secondary')}>
        <Input id={n('phone_secondary')} name={n('phone_secondary')} type="tel" inputMode="tel" defaultValue={customer.phone_secondary || ''} />
      </Field>
      <Field label="E-mail" name={n('email')}>
        <Input id={n('email')} name={n('email')} type="email" defaultValue={customer.email || ''} />
      </Field>
      <Field label="CPF/CNPJ" name={n('document')} hint="Opcional.">
        <Input id={n('document')} name={n('document')} inputMode="numeric" defaultValue={customer.document || ''} />
      </Field>
      {!compact && (
        <>
          <Field label="CEP" name={n('cep')}>
            <Input id={n('cep')} name={n('cep')} inputMode="numeric" defaultValue={a.cep || ''} />
          </Field>
          <Field label="Rua" name={n('rua')}>
            <Input id={n('rua')} name={n('rua')} defaultValue={a.rua || ''} />
          </Field>
          <Field label="Número" name={n('numero')}>
            <Input id={n('numero')} name={n('numero')} defaultValue={a.numero || ''} />
          </Field>
          <Field label="Complemento" name={n('complemento')}>
            <Input id={n('complemento')} name={n('complemento')} defaultValue={a.complemento || ''} />
          </Field>
          <Field label="Bairro" name={n('bairro')}>
            <Input id={n('bairro')} name={n('bairro')} defaultValue={a.bairro || ''} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Cidade" name={n('cidade')} className="col-span-2">
              <Input id={n('cidade')} name={n('cidade')} defaultValue={a.cidade || ''} />
            </Field>
            <Field label="UF" name={n('uf')}>
              <Select id={n('uf')} name={n('uf')} defaultValue={a.uf || ''}>
                <option value="">—</option>
                {BR_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Observações" name={n('notes')} className="sm:col-span-2">
            <Textarea id={n('notes')} name={n('notes')} defaultValue={customer.notes || ''} />
          </Field>
        </>
      )}
    </div>
  );
}
