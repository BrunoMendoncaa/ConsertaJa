import Link from 'next/link';
import { Store } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Input, Textarea, Checkbox } from '@/components/ui/input';
import { CopyButton } from '@/components/ui/copy-button';
import { LogoUploader } from '@/features/tenancy/components/logo-uploader';
import { AddressFields } from '@/features/tenancy/components/address-fields';
import { missingProfileFields } from '@/features/tenancy/profile';
import { updateAssistanceSettings, addCategory, toggleCategory } from '@/features/tenancy/actions';
import { getCategories, logoUrl } from '@/features/tenancy/queries';
import { SITE_URL } from '@/lib/supabase/env';
import { moneyInputValue } from '@/lib/money';
import { MANAGER_ROLES } from '@/lib/constants';

export const metadata = { title: 'Configurações' };

function Section({ title, description, children }) {
  return (
    <section className="grid gap-4 border-b border-slate-100 pb-6 last:border-0 lg:grid-cols-3">
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">{children}</div>
    </section>
  );
}

export default async function SettingsPage({ searchParams }) {
  const sp = await searchParams;
  const { assistance: a } = await requireStaff(MANAGER_ROLES);
  const categories = await getCategories({ includeInactive: true });
  const portalUrl = `${SITE_URL}/a/${a.slug}`;
  const missing = missingProfileFields(a);
  // inicio: acabou de criar a assistência · completar: veio do aviso/login com cadastro incompleto
  const firstAccess = sp?.inicio === '1';
  const after = firstAccess ? 'inicio' : sp?.completar === '1' && missing.length ? 'completar' : null;

  return (
    <>
      <PageHeader title="Configurações" description="Identidade da assistência, portal do cliente e padrões do orçamento." />

      {(firstAccess || missing.length > 0) && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 text-brand-900">
          <p className="flex items-center gap-2 font-semibold">
            <Store className="size-5 shrink-0" aria-hidden="true" />
            {firstAccess ? `Bem-vindo ao TecnoFix! Agora, os dados da ${a.name}` : `Falta completar o cadastro: ${missing.join(' e ')}`}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-brand-900/85">
            Esses dados aparecem no comprovante de entrada, no orçamento, no certificado de garantia e no portal do cliente.
            Preencha o <strong>WhatsApp</strong> (ou telefone) e o <strong>endereço completo</strong>, que são obrigatórios,
            envie o <a href="#logo" className="font-medium underline">logo</a> e clique em <strong>Salvar configurações</strong>.
          </p>
          {firstAccess && (
            <Link href="/painel" className="mt-2 inline-block text-sm text-brand-800 underline-offset-4 hover:underline">Preencher depois</Link>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardContent className="py-6">
            <ActionForm action={updateAssistanceSettings} className="space-y-6">
              {after && <input type="hidden" name="apos" value={after} />}
              <Section title="Identidade" description="Como a assistência aparece para os clientes.">
                <Field label="Nome fantasia" name="name" required className="sm:col-span-2">
                  <Input id="name" name="name" defaultValue={a.name} />
                </Field>
                <Field label="Razão social" name="legal_name"><Input id="legal_name" name="legal_name" defaultValue={a.legal_name || ''} /></Field>
                <Field label="CNPJ/CPF" name="document"><Input id="document" name="document" defaultValue={a.document || ''} /></Field>
                <Field label="Cor da marca" name="brand_color" hint="Usada no portal e no orçamento.">
                  <Input id="brand_color" name="brand_color" type="color" defaultValue={a.brand_color || '#2563eb'} className="h-10 w-24 p-1" />
                </Field>
              </Section>

              <Section title="Contato" description="Mostrado no portal, no comprovante e no orçamento. Campos com * são obrigatórios.">
                <Field label="WhatsApp" name="whatsapp" required hint="Se a loja não tiver WhatsApp, preencha o telefone.">
                  <Input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" placeholder="(11) 98888-7777" defaultValue={a.whatsapp || ''} />
                </Field>
                <Field label="Telefone" name="phone"><Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={a.phone || ''} /></Field>
                <Field label="E-mail" name="email" className="sm:col-span-2"><Input id="email" name="email" type="email" defaultValue={a.email || ''} /></Field>
                <AddressFields address={a.address || {}} />
                <Field label="Horário de atendimento" name="business_hours" className="sm:col-span-2">
                  <Input id="business_hours" name="business_hours" defaultValue={a.business_hours || ''} placeholder="Seg a sex, 9h às 18h" />
                </Field>
              </Section>

              <Section title="Portal do cliente" description="O que o cliente vê ao acompanhar a OS.">
                <Field label="Mensagem de boas-vindas" name="welcome_message" className="sm:col-span-2">
                  <Input id="welcome_message" name="welcome_message" defaultValue={a.welcome_message || ''} />
                </Field>
                <div className="sm:col-span-2">
                  <Checkbox name="portal_show_photos" label="Mostrar ao cliente as fotos marcadas como visíveis" defaultChecked={a.settings?.portal_show_photos !== false} />
                </div>
              </Section>

              <Section title="Orçamento e garantia" description="Padrões aplicados a cada novo orçamento.">
                <Field label="Validade do orçamento (dias)" name="default_budget_validity_days" hint="Sem estipulação, o CDC considera 10 dias.">
                  <Input id="default_budget_validity_days" name="default_budget_validity_days" type="number" min="1" max="90" defaultValue={a.default_budget_validity_days} />
                </Field>
                <Field label="Garantia padrão (dias)" name="default_warranty_days">
                  <Input id="default_warranty_days" name="default_warranty_days" type="number" min="0" max="3650" defaultValue={a.default_warranty_days} />
                </Field>
                <Field label="Taxa de diagnóstico (R$)" name="diagnosis_fee" hint="Cobrada se o orçamento for recusado. Avise no comprovante.">
                  <Input id="diagnosis_fee" name="diagnosis_fee" inputMode="decimal" defaultValue={Number(a.diagnosis_fee) ? moneyInputValue(a.diagnosis_fee) : ''} placeholder="0,00" />
                </Field>
                <Field label="Condições de pagamento padrão" name="default_payment_terms">
                  <Input id="default_payment_terms" name="default_payment_terms" defaultValue={a.default_payment_terms || ''} />
                </Field>
                <Field label="Condições de garantia" name="warranty_policy" className="sm:col-span-2" hint="Uma condição por linha. Saem no certificado de garantia entregue na retirada. Em branco, o certificado usa condições padrão (cobertura do serviço e das peças trocadas; perda por queda, líquido, violação ou mau uso).">
                  <Textarea id="warranty_policy" name="warranty_policy" rows={4} defaultValue={a.warranty_policy || ''} />
                </Field>
                <Field label="Termos do comprovante de entrada" name="entry_terms" className="sm:col-span-2" hint="Ex.: prazo para retirada, responsabilidade sobre dados do aparelho.">
                  <Textarea id="entry_terms" name="entry_terms" rows={4} defaultValue={a.entry_terms || ''} />
                </Field>
              </Section>

              <div className="flex justify-end"><SubmitButton pendingText="Salvando...">Salvar configurações</SubmitButton></div>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Endereço do portal" description="Fixo após a criação (QR codes já impressos continuam valendo)." />
            <CardContent className="space-y-2">
              <p className="break-all rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">{portalUrl}</p>
              <CopyButton text={portalUrl} label="Copiar endereço" />
            </CardContent>
          </Card>
          <Card id="logo" className="scroll-mt-6">
            <CardHeader title="Logo" />
            <CardContent><LogoUploader assistanceId={a.id} currentUrl={logoUrl(a.logo_path, a.updated_at)} /></CardContent>
          </Card>
          <Card>
            <CardHeader title="Categorias de equipamento" description="As padrão do sistema e as suas." />
            <CardContent className="space-y-4">
              <ul className="space-y-1.5 text-sm">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className={c.active ? 'text-slate-800' : 'text-slate-400 line-through'}>{c.name}</span>
                    {c.assistance_id ? (
                      <ActionForm action={toggleCategory}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={String(!c.active)} />
                        <SubmitButton variant="link" size="sm" className="text-xs">{c.active ? 'Desativar' : 'Reativar'}</SubmitButton>
                      </ActionForm>
                    ) : <span className="text-xs text-slate-400">padrão</span>}
                  </li>
                ))}
              </ul>
              <ActionForm action={addCategory} resetOnSuccess className="flex gap-2">
                <Input name="name" placeholder="Nova categoria" />
                <SubmitButton variant="outline">Adicionar</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
