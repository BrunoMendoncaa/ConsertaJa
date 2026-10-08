'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Search, UserPlus, Plus, Check, ArrowLeft, ArrowRight, LoaderCircle, Smartphone } from 'lucide-react';
import { searchCustomers } from '@/features/customers/actions';
import { listCustomerEquipment } from '@/features/equipment/actions';
import { createServiceOrder } from '@/features/service-orders/actions';
import { PhotoUploader } from './photo-uploader';
import { AccessPanel } from './access-panel';
import { Input, Textarea, Select, Label, Checkbox } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { ACCESSORIES, ENTRY_CHECKLIST, PRIORITIES } from '@/lib/constants';
import { formatPhone, whatsappLink } from '@/lib/phone';
import { cn } from '@/lib/cn';

const STEPS = ['Cliente', 'Equipamento', 'Entrada', 'Revisão', 'Fotos e link'];

function Err({ errors, name }) {
  const msg = errors?.[name];
  return msg ? <p className="mt-1 text-xs font-medium text-red-600">{msg}</p> : null;
}

function equipmentLabel(e) {
  return [e.brand, e.model].filter(Boolean).join(' ') || e.category?.name || 'Equipamento';
}

export function NewOrderWizard({
  categories, technicians, assistance, siteUrl, initialCustomer = null, initialEquipmentList = [], initialEquipmentId = null,
}) {
  const [step, setStep] = useState(initialCustomer ? (initialEquipmentId ? 2 : 1) : 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});

  // Cliente
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [customer, setCustomer] = useState(initialCustomer);
  const [customerMode, setCustomerMode] = useState('existing');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', phone_secondary: '', email: '', document: '' });

  // Equipamento
  const [equipmentList, setEquipmentList] = useState(initialEquipmentList);
  const [equipmentId, setEquipmentId] = useState(initialEquipmentId);
  const [equipmentMode, setEquipmentMode] = useState(initialEquipmentList.length ? 'existing' : 'new');
  const [newEquipment, setNewEquipment] = useState({ category_id: '', brand: '', model: '', serial_number: '', imei: '', color: '' });

  // Entrada
  const [entry, setEntry] = useState({
    reported_issue: '', accessories: [], accessories_other: '', entry_condition: {}, entry_condition_notes: '',
    priority: 'NORMAL', technician_id: '', estimated_completion_at: '', unlock_code: '', customer_notes: '', internal_notes: '',
  });

  const [result, setResult] = useState(null);

  // Busca de cliente com atraso (debounce)
  useEffect(() => {
    if (customerMode !== 'existing' || term.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const t = setTimeout(() => {
      startTransition(async () => setResults(await searchCustomers(term)));
    }, 300);
    return () => clearTimeout(t);
  }, [term, customerMode]);

  function chooseCustomer(c) {
    setCustomer(c);
    setEquipmentId(null);
    setErrors({});
    startTransition(async () => {
      const list = await listCustomerEquipment(c.id);
      setEquipmentList(list);
      setEquipmentMode(list.length ? 'existing' : 'new');
      setStep(1);
    });
  }

  function validateStep(s) {
    const e = {};
    if (s === 0 && customerMode === 'new') {
      if (newCustomer.name.trim().length < 2) e['customer.name'] = 'Informe o nome do cliente.';
      if (newCustomer.phone.replace(/\D/g, '').length < 10) e['customer.phone'] = 'Informe o telefone com DDD.';
    }
    if (s === 0 && customerMode === 'existing' && !customer) e.customer_id = 'Selecione um cliente ou cadastre um novo.';
    if (s === 1 && equipmentMode === 'existing' && !equipmentId) e.equipment_id = 'Selecione o equipamento ou cadastre um novo.';
    if (s === 1 && equipmentMode === 'new' && !newEquipment.category_id) e['equipment.category_id'] = 'Escolha a categoria.';
    if (s === 2 && entry.reported_issue.trim().length < 3) e.reported_issue = 'Descreva o problema relatado pelo cliente.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    if (step === 0 && customerMode === 'new') {
      setCustomer(null);
      setEquipmentList([]);
      setEquipmentMode('new');
    }
    setStep((s) => s + 1);
  }

  const accessories = useMemo(() => {
    const extra = entry.accessories_other.split(',').map((s) => s.trim()).filter(Boolean);
    return [...entry.accessories, ...extra];
  }, [entry.accessories, entry.accessories_other]);

  function submit() {
    setError(null);
    const payload = {
      customer_id: customerMode === 'existing' ? customer?.id : null,
      customer: customerMode === 'new' ? newCustomer : null,
      equipment_id: equipmentMode === 'existing' ? equipmentId : null,
      equipment: equipmentMode === 'new' ? newEquipment : null,
      reported_issue: entry.reported_issue,
      accessories,
      entry_condition: entry.entry_condition,
      entry_condition_notes: entry.entry_condition_notes,
      priority: entry.priority,
      technician_id: entry.technician_id || null,
      estimated_completion_at: entry.estimated_completion_at || null,
      unlock_code: entry.unlock_code,
      customer_notes: entry.customer_notes,
      internal_notes: entry.internal_notes,
    };
    startTransition(async () => {
      const res = await createServiceOrder(payload);
      if (!res?.ok) {
        setError(res?.error || 'Não foi possível abrir a OS.');
        setErrors(res?.fieldErrors || {});
        const keys = Object.keys(res?.fieldErrors || {});
        if (keys.some((k) => k.startsWith('customer'))) setStep(0);
        else if (keys.some((k) => k.startsWith('equipment'))) setStep(1);
        else if (keys.length) setStep(2);
        return;
      }
      setResult(res.data);
      setStep(4);
    });
  }

  const customerName = customerMode === 'new' ? newCustomer.name : customer?.name;
  const customerPhone = customerMode === 'new' ? newCustomer.phone : customer?.phone;
  const selectedEquipment = equipmentList.find((e) => e.id === equipmentId);
  const equipmentText = equipmentMode === 'new'
    ? [categories.find((c) => c.id === newEquipment.category_id)?.name, newEquipment.brand, newEquipment.model].filter(Boolean).join(' · ')
    : selectedEquipment ? equipmentLabel(selectedEquipment) : '';

  const link = result ? `${siteUrl}/a/${assistance.slug}?c=${result.access_code}` : '';
  const firstName = (customerName || '').split(' ')[0];
  const whatsappMsg = result
    ? `Olá, ${firstName}! Recebemos seu ${equipmentText || 'equipamento'} na ${assistance.name}. Sua OS é ${result.code}. Acompanhe o conserto e o orçamento por aqui: ${link} (telefone cadastrado + código ${result.access_code}).`
    : '';

  return (
    <div className="space-y-6">
      {/* Indicador de passos */}
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className={cn(
            'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm',
            i === step ? 'bg-brand-600 text-white' : i < step ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'
          )}>
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
              {i < step ? <Check className="size-3" aria-hidden="true" /> : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {/* PASSO 1 — Cliente */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setCustomerMode('existing')}
                className={buttonClasses({ variant: customerMode === 'existing' ? 'secondary' : 'outline', size: 'sm' })}>
                <Search className="size-4" aria-hidden="true" /> Buscar cliente
              </button>
              <button type="button" onClick={() => setCustomerMode('new')}
                className={buttonClasses({ variant: customerMode === 'new' ? 'secondary' : 'outline', size: 'sm' })}>
                <UserPlus className="size-4" aria-hidden="true" /> Novo cliente
              </button>
            </div>

            {customerMode === 'existing' ? (
              <div>
                <Label htmlFor="term">Telefone, nome ou CPF</Label>
                <div className="relative">
                  <Input id="term" autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Ex.: 98765 ou Maria" />
                  {pending && <LoaderCircle className="absolute right-3 top-2.5 size-5 animate-spin text-slate-400" aria-hidden="true" />}
                </div>
                <Err errors={errors} name="customer_id" />
                {customer && (
                  <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
                    Selecionado: <strong>{customer.name}</strong> · {formatPhone(customer.phone)}
                  </p>
                )}
                <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 empty:hidden">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => chooseCustomer(c)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                        <span className="font-medium text-slate-900">{c.name}</span>
                        <span className="text-sm text-slate-500">{formatPhone(c.phone)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {term.trim().length >= 2 && !pending && results.length === 0 && (
                  <p className="mt-3 text-sm text-slate-500">
                    Nenhum cliente encontrado.{' '}
                    <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => {
                      setCustomerMode('new');
                      const digits = term.replace(/\D/g, '');
                      setNewCustomer((v) => ({ ...v, ...(digits.length >= 8 ? { phone: term } : { name: term }) }));
                    }}>Cadastrar novo cliente</button>
                  </p>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="c_name">Nome completo *</Label>
                  <Input id="c_name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                  <Err errors={errors} name="customer.name" />
                </div>
                <div>
                  <Label htmlFor="c_phone">Telefone (WhatsApp) *</Label>
                  <Input id="c_phone" type="tel" inputMode="tel" placeholder="(11) 98765-4321" value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                  <Err errors={errors} name="customer.phone" />
                </div>
                <div>
                  <Label htmlFor="c_phone2">Telefone secundário</Label>
                  <Input id="c_phone2" type="tel" inputMode="tel" value={newCustomer.phone_secondary}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone_secondary: e.target.value })} />
                  <Err errors={errors} name="customer.phone_secondary" />
                </div>
                <div>
                  <Label htmlFor="c_email">E-mail</Label>
                  <Input id="c_email" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                  <Err errors={errors} name="customer.email" />
                </div>
                <div>
                  <Label htmlFor="c_doc">CPF/CNPJ</Label>
                  <Input id="c_doc" inputMode="numeric" value={newCustomer.document} onChange={(e) => setNewCustomer({ ...newCustomer, document: e.target.value })} />
                  <Err errors={errors} name="customer.document" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASSO 2 — Equipamento */}
        {step === 1 && (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">Cliente: <strong className="text-slate-900">{customerName}</strong></p>
            {equipmentList.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setEquipmentMode('existing')}
                  className={buttonClasses({ variant: equipmentMode === 'existing' ? 'secondary' : 'outline', size: 'sm' })}>
                  <Smartphone className="size-4" aria-hidden="true" /> Equipamento já cadastrado
                </button>
                <button type="button" onClick={() => setEquipmentMode('new')}
                  className={buttonClasses({ variant: equipmentMode === 'new' ? 'secondary' : 'outline', size: 'sm' })}>
                  <Plus className="size-4" aria-hidden="true" /> Novo equipamento
                </button>
              </div>
            )}
            {equipmentMode === 'existing' && equipmentList.length > 0 ? (
              <div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {equipmentList.map((e) => (
                    <button key={e.id} type="button" onClick={() => setEquipmentId(e.id)}
                      className={cn('rounded-lg border px-4 py-3 text-left transition-colors',
                        equipmentId === e.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 hover:bg-slate-50')}>
                      <p className="font-medium text-slate-900">{equipmentLabel(e)}</p>
                      <p className="text-xs text-slate-500">{[e.category?.name, e.color, e.serial_number, e.imei].filter(Boolean).join(' · ')}</p>
                    </button>
                  ))}
                </div>
                <Err errors={errors} name="equipment_id" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="e_cat">Categoria *</Label>
                  <Select id="e_cat" value={newEquipment.category_id} onChange={(e) => setNewEquipment({ ...newEquipment, category_id: e.target.value })}>
                    <option value="">Selecione…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                  <Err errors={errors} name="equipment.category_id" />
                </div>
                <div>
                  <Label htmlFor="e_brand">Marca</Label>
                  <Input id="e_brand" value={newEquipment.brand} onChange={(e) => setNewEquipment({ ...newEquipment, brand: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="e_model">Modelo</Label>
                  <Input id="e_model" value={newEquipment.model} onChange={(e) => setNewEquipment({ ...newEquipment, model: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="e_color">Cor</Label>
                  <Input id="e_color" value={newEquipment.color} onChange={(e) => setNewEquipment({ ...newEquipment, color: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="e_serial">Número de série</Label>
                  <Input id="e_serial" value={newEquipment.serial_number} onChange={(e) => setNewEquipment({ ...newEquipment, serial_number: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="e_imei">IMEI</Label>
                  <Input id="e_imei" inputMode="numeric" value={newEquipment.imei} onChange={(e) => setNewEquipment({ ...newEquipment, imei: e.target.value })} />
                  <Err errors={errors} name="equipment.imei" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASSO 3 — Entrada */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <Label htmlFor="issue">Problema relatado pelo cliente *</Label>
              <Textarea id="issue" rows={3} autoFocus value={entry.reported_issue}
                onChange={(e) => setEntry({ ...entry, reported_issue: e.target.value })}
                placeholder="Ex.: Tela quebrada após queda; touch não responde embaixo." />
              <Err errors={errors} name="reported_issue" />
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">Acessórios recebidos</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {ACCESSORIES.map((a) => (
                  <Checkbox key={a} label={a} checked={entry.accessories.includes(a)}
                    onChange={(e) => setEntry({
                      ...entry,
                      accessories: e.target.checked ? [...entry.accessories, a] : entry.accessories.filter((x) => x !== a),
                    })} />
                ))}
              </div>
              <Input className="mt-3" placeholder="Outros (separe por vírgula)" value={entry.accessories_other}
                onChange={(e) => setEntry({ ...entry, accessories_other: e.target.value })} />
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">Condição de entrada</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {ENTRY_CHECKLIST.map((c) => (
                  <Checkbox key={c.key} label={c.label} checked={Boolean(entry.entry_condition[c.key])}
                    onChange={(e) => setEntry({ ...entry, entry_condition: { ...entry.entry_condition, [c.key]: e.target.checked } })} />
                ))}
              </div>
              <Textarea className="mt-3" rows={2} placeholder="Detalhes do estado físico (riscos, marcas, peças faltando…)"
                value={entry.entry_condition_notes} onChange={(e) => setEntry({ ...entry, entry_condition_notes: e.target.value })} />
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="priority">Prioridade</Label>
                <Select id="priority" value={entry.priority} onChange={(e) => setEntry({ ...entry, priority: e.target.value })}>
                  {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="tech">Técnico responsável</Label>
                <Select id="tech" value={entry.technician_id} onChange={(e) => setEntry({ ...entry, technician_id: e.target.value })}>
                  <option value="">A definir</option>
                  {technicians.map((t) => <option key={t.user_id} value={t.user_id}>{t.full_name || t.email}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="eta">Previsão de conclusão</Label>
                <Input id="eta" type="date" value={entry.estimated_completion_at}
                  onChange={(e) => setEntry({ ...entry, estimated_completion_at: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="unlock">Senha/padrão de desbloqueio</Label>
                <Input id="unlock" autoComplete="off" value={entry.unlock_code} onChange={(e) => setEntry({ ...entry, unlock_code: e.target.value })} />
                <p className="mt-1 text-xs text-slate-500">Só técnicos veem. É apagada automaticamente na entrega.</p>
              </div>
              <div>
                <Label htmlFor="cnotes">Observações para o cliente</Label>
                <Input id="cnotes" value={entry.customer_notes} onChange={(e) => setEntry({ ...entry, customer_notes: e.target.value })} />
                <p className="mt-1 text-xs text-slate-500">Aparece no portal e no comprovante.</p>
              </div>
            </div>
            <div>
              <Label htmlFor="inotes">Observações internas</Label>
              <Textarea id="inotes" rows={2} value={entry.internal_notes} onChange={(e) => setEntry({ ...entry, internal_notes: e.target.value })} />
              <p className="mt-1 text-xs text-slate-500">Nunca aparecem para o cliente.</p>
            </div>
          </div>
        )}

        {/* PASSO 4 — Revisão */}
        {step === 3 && (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Cliente</dt><dd className="font-medium text-slate-900">{customerName} · {formatPhone(customerPhone)}</dd></div>
            <div><dt className="text-slate-500">Equipamento</dt><dd className="font-medium text-slate-900">{equipmentText || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-slate-500">Problema relatado</dt><dd className="text-slate-900">{entry.reported_issue}</dd></div>
            <div><dt className="text-slate-500">Acessórios</dt><dd className="text-slate-900">{accessories.join(', ') || 'Nenhum'}</dd></div>
            <div><dt className="text-slate-500">Condição</dt><dd className="text-slate-900">
              {ENTRY_CHECKLIST.filter((c) => entry.entry_condition[c.key]).map((c) => c.label).join(', ') || 'Sem marcações'}
            </dd></div>
            <div><dt className="text-slate-500">Prioridade</dt><dd className="text-slate-900">{PRIORITIES[entry.priority]}</dd></div>
            <div><dt className="text-slate-500">Senha de desbloqueio</dt><dd className="text-slate-900">{entry.unlock_code ? 'Informada' : 'Não informada'}</dd></div>
          </dl>
        )}

        {/* PASSO 5 — Resultado, fotos e link */}
        {step === 4 && result && (
          <div className="space-y-8">
            <div className="text-center">
              <p className="text-sm text-slate-500">Ordem de serviço criada</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{result.code}</p>
            </div>
            <section>
              <h2 className="mb-3 font-semibold text-slate-900">Acompanhamento do cliente</h2>
              <AccessPanel
                link={link}
                accessCode={result.access_code}
                whatsappHref={whatsappLink(customerPhone, whatsappMsg)}
                receiptHref={`/painel/os/${result.id}/comprovante`}
              />
            </section>
            <section>
              <h2 className="mb-1 font-semibold text-slate-900">Fotos de entrada</h2>
              <p className="mb-3 text-sm text-slate-500">Frente, traseira, tela, etiqueta e danos existentes. Ficam privadas.</p>
              <PhotoUploader assistanceId={assistance.id} serviceOrderId={result.id} />
            </section>
          </div>
        )}
      </div>

      {/* Navegação */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {step > 0 && step < 4 ? (
          <Button variant="ghost" onClick={() => { setErrors({}); setStep((s) => s - 1); }}>
            <ArrowLeft className="size-4" aria-hidden="true" /> Voltar
          </Button>
        ) : <span />}
        {step < 3 && (
          <Button onClick={next} disabled={pending}>Continuar <ArrowRight className="size-4" aria-hidden="true" /></Button>
        )}
        {step === 3 && (
          <Button onClick={submit} disabled={pending} size="lg">
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />} Criar OS
          </Button>
        )}
        {step === 4 && result && (
          <Link href={`/painel/os/${result.id}`} className={buttonClasses({ size: 'lg' })}>
            Concluir e abrir a OS <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
