'use client';

import { useRef, useState } from 'react';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { BR_STATES } from '@/lib/constants';

const HINTS = {
  buscando: 'Buscando o endereço…',
  'nao-encontrado': 'CEP não encontrado. Preencha o endereço à mão.',
  erro: 'Não deu para buscar o CEP agora. Preencha o endereço à mão.',
};

/**
 * Endereço da assistência (obrigatório). Ao digitar o CEP, preenche rua, bairro, cidade e UF
 * pelo ViaCEP. Se a busca falhar, a pessoa preenche à mão — nada trava.
 */
export function AddressFields({ address = {} }) {
  const [v, setV] = useState({
    cep: address.cep || '', rua: address.rua || '', numero: address.numero || '',
    complemento: address.complemento || '', bairro: address.bairro || '',
    cidade: address.cidade || '', uf: address.uf || '',
  });
  const [status, setStatus] = useState(null);
  const looked = useRef(String(address.cep || '').replace(/\D/g, ''));
  const numeroRef = useRef(null);
  const set = (k) => (e) => setV((o) => ({ ...o, [k]: e.target.value }));

  async function lookup(digits) {
    if (digits.length !== 8 || digits === looked.current) return;
    looked.current = digits;
    setStatus('buscando');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: ctrl.signal });
      const data = await res.json();
      if (!res.ok || data.erro) { setStatus('nao-encontrado'); return; }
      setV((o) => ({
        ...o,
        cep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
        rua: data.logradouro || o.rua,
        bairro: data.bairro || o.bairro,
        cidade: data.localidade || o.cidade,
        uf: BR_STATES.includes(data.uf) ? data.uf : o.uf,
      }));
      setStatus(null);
      if (data.logradouro) numeroRef.current?.focus();
    } catch {
      setStatus('erro');
    } finally {
      clearTimeout(timer);
    }
  }

  function onCep(e) {
    const value = e.target.value;
    setV((o) => ({ ...o, cep: value }));
    lookup(value.replace(/\D/g, ''));
  }

  return (
    <>
      <Field label="CEP" name="cep" required hint={HINTS[status] || 'Digite o CEP e o endereço é preenchido sozinho.'}>
        <Input id="cep" name="cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9}
          value={v.cep} onChange={onCep} aria-busy={status === 'buscando'} />
      </Field>
      <Field label="Rua" name="rua" required>
        <Input id="rua" name="rua" autoComplete="address-line1" value={v.rua} onChange={set('rua')} />
      </Field>
      <Field label="Número" name="numero" required hint="Sem número? Escreva S/N.">
        <Input id="numero" name="numero" ref={numeroRef} value={v.numero} onChange={set('numero')} />
      </Field>
      <Field label="Complemento" name="complemento">
        <Input id="complemento" name="complemento" autoComplete="address-line2" value={v.complemento} onChange={set('complemento')} />
      </Field>
      <Field label="Bairro" name="bairro" required>
        <Input id="bairro" name="bairro" value={v.bairro} onChange={set('bairro')} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Cidade" name="cidade" required className="col-span-2">
          <Input id="cidade" name="cidade" autoComplete="address-level2" value={v.cidade} onChange={set('cidade')} />
        </Field>
        <Field label="UF" name="uf" required>
          <Select id="uf" name="uf" value={v.uf} onChange={set('uf')}>
            <option value="">—</option>
            {BR_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </Select>
        </Field>
      </div>
    </>
  );
}
