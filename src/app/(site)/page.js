import Link from 'next/link';
import {
  ClipboardList, Camera, FileText, Smartphone, Wallet, ShieldCheck, ArrowRight, CircleCheck, QrCode,
  BadgeCheck, CalendarClock, ListChecks, Printer,
} from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { ButtonLink } from '@/components/ui/button';
import { PLANS, PLAN_FEATURES, TRIAL_DAYS } from '@/lib/billing';

const features = [
  { icon: ClipboardList, title: 'Ordem de serviço em 1 minuto', text: 'Cliente, equipamento, defeito, acessórios e condição de entrada num fluxo rápido de balcão. Número OS-2026-000123 gerado na hora.' },
  { icon: Camera, title: 'Fotos como evidência', text: 'Fotografe frente, traseira, tela e danos pelo celular. As fotos ficam privadas e só a sua assistência acessa.' },
  { icon: FileText, title: 'Orçamento profissional', text: 'Peças e serviços discriminados, desconto, prazo, garantia e condições. Cada envio vira uma versão que nunca é sobrescrita.' },
  { icon: Smartphone, title: 'Aprovação pelo celular', text: 'O cliente acompanha a OS e aprova ou recusa o orçamento no link da sua assistência, sem instalar nada.' },
  { icon: Wallet, title: 'Caixa sem complicação', text: 'Entradas, saídas, valores previstos e a receber, lucro estimado por OS e indicadores do período.' },
  { icon: ShieldCheck, title: 'Seus dados isolados', text: 'Cada assistência é isolada no próprio banco de dados. Ninguém de fora enxerga seus clientes ou números.' },
];

const steps = ['Receba', 'Registre', 'Fotografe', 'Diagnostique', 'Orce', 'Cliente aprova', 'Conserte', 'Receba o pagamento', 'Entregue com garantia'];

const warrantyPoints = [
  { icon: CalendarClock, title: 'Gerado na entrega', text: 'Ao registrar a retirada, o prazo começa a contar e o sistema calcula o vencimento sozinho.' },
  { icon: ListChecks, title: 'Tudo documentado', text: 'Defeito, solução, peças e serviços do orçamento aprovado, número de série e IMEI do aparelho.' },
  { icon: BadgeCheck, title: 'Suas condições', text: 'Você define o que a garantia cobre e quando ela perde a validade. O certificado sai com o seu logo.' },
  { icon: Printer, title: 'Impresso ou no celular', text: 'Entregue impresso no balcão ou em PDF pelo WhatsApp. O cliente também abre pelo link da sua assistência enquanto a garantia valer.' },
];

export default function LandingPage() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <ButtonLink href="/entrar" variant="ghost" size="sm" className="sm:h-10 sm:px-4">Entrar</ButtonLink>
          <ButtonLink href="/cadastro" size="sm" className="sm:h-10 sm:px-4">Criar conta<span className="hidden sm:inline">&nbsp;grátis</span></ButtonLink>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-2">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            Para assistências de eletrônicos e eletrodomésticos
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Do balcão à entrega, cada conserto sob controle.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Abra ordens de serviço, registre fotos, envie orçamentos que o cliente aprova pelo celular, entregue com certificado de garantia e acompanhe o caixa da sua assistência num só lugar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/cadastro" size="lg">
              Testar grátis por {TRIAL_DAYS} dias <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/entrar" variant="outline" size="lg">Já tenho conta</ButtonLink>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Orçamento</p>
                <p className="text-lg font-semibold text-slate-900">OS-2026-000123</p>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">Aguardando aprovação</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">iPhone 13 · Tela quebrada</p>
            <div className="mt-4 divide-y divide-slate-100 text-sm">
              {[['Display original', 'R$ 450,00'], ['Mão de obra', 'R$ 150,00'], ['Limpeza interna', 'R$ 50,00']].map(([d, v]) => (
                <div key={d} className="flex justify-between py-2"><span className="text-slate-600">{d}</span><span className="tabular text-slate-900">{v}</span></div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 text-base font-semibold">
              <span>Total</span><span className="tabular">R$ 650,00</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <span className="rounded-lg bg-emerald-600 py-2 text-center text-sm font-medium text-white">Aprovar</span>
              <span className="rounded-lg border border-slate-300 py-2 text-center text-sm font-medium text-slate-700">Recusar</span>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <QrCode className="size-4" aria-hidden="true" /> O cliente abre pelo QR code do comprovante.
          </p>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Tudo o que a assistência precisa no dia a dia</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-white p-5">
                <Icon className="size-5 text-brand-600" aria-hidden="true" />
                <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            <ShieldCheck className="size-3.5" aria-hidden="true" /> Certificado de garantia
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">Garantia que o cliente leva para casa</h2>
          <p className="mt-3 text-lg leading-relaxed text-slate-600">
            Na retirada, o Conserta Já gera o certificado com tudo o que foi feito no aparelho. Menos discussão no balcão quando o cliente volta, mais confiança para ele voltar.
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {warrantyPoints.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon className="size-5 text-emerald-700" aria-hidden="true" />
                <p className="mt-2 font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Certificado de garantia</p>
                <p className="text-lg font-semibold text-slate-900">OS-2026-000123</p>
              </div>
              <p className="text-right text-xs text-slate-500">Retirada em<br /><span className="font-medium text-slate-700">08/10/2026</span></p>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-3">
              <ShieldCheck className="size-8 shrink-0 text-emerald-700" aria-hidden="true" />
              <div>
                <p className="text-lg font-bold text-slate-900">90 dias de garantia</p>
                <p className="text-sm text-slate-700">Válida até <strong>06/01/2027</strong></p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">iPhone 13 · IMEI 3567••••••2345</p>
            <div className="mt-2 divide-y divide-slate-100 text-sm">
              {[['Peça', 'Display original'], ['Serviço', 'Mão de obra'], ['Serviço', 'Limpeza interna']].map(([k, d]) => (
                <div key={d} className="flex justify-between gap-3 py-2"><span className="text-slate-900">{d}</span><span className="text-slate-500">{k}</span></div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-6 text-center text-[11px] text-slate-500">
              <span className="border-t border-slate-300 pt-1.5">Cliente</span>
              <span className="border-t border-slate-300 pt-1.5">Assistência</span>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Smartphone className="size-4" aria-hidden="true" /> O cliente também abre o certificado pelo celular.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">O fluxo completo, sem planilha</h2>
        <ol className="mt-6 flex flex-wrap gap-2">
          {steps.map((s, i) => (
            <li key={s} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section id="precos" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Preço simples, sem surpresa</h2>
            <p className="mt-3 text-lg text-slate-600">Teste tudo por {TRIAL_DAYS} dias, sem cartão. Gostou? Assine um plano único, com tudo liberado.</p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-medium text-slate-600">Teste grátis</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{TRIAL_DAYS} dias</p>
              <p className="mt-2 text-sm text-slate-600">Sem cartão de crédito e sem compromisso. Tudo liberado desde o primeiro dia.</p>
            </div>
            {Object.values(PLANS).map((p) => (
              <div key={p.cycle} className={`rounded-2xl border bg-white p-6 ${p.cycle === 'yearly' ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200'}`}>
                <p className="flex items-center justify-between gap-2 text-sm font-medium text-slate-600">
                  {p.label}
                  {p.note && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">{p.note}</span>}
                </p>
                <p className="mt-1 text-3xl font-bold text-slate-900">R$ {p.amount}<span className="text-base font-medium text-slate-500">/{p.cycle === 'yearly' ? 'ano' : 'mês'}</span></p>
                <p className="mt-2 text-sm text-slate-600">{p.cycle === 'yearly' ? 'Equivale a R$ 40,83 por mês.' : 'Sem fidelidade. Cancele quando quiser.'}</p>
              </div>
            ))}
          </div>
          <ul className="mt-6 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            {PLAN_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2"><CircleCheck className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />{f}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">Pagamento pelo Mercado Pago. Se o teste acabar sem assinatura, nada é apagado: você continua vendo e concluindo o que já existe.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-2xl bg-slate-900 px-8 py-10 text-white">
          <h2 className="text-2xl font-semibold">Comece hoje com a sua assistência</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {[`${TRIAL_DAYS} dias grátis, sem cartão`, 'Cadastro em 2 minutos', 'Link próprio para seus clientes', 'Certificado de garantia na entrega'].map((t) => (
              <li key={t} className="flex items-center gap-2"><CircleCheck className="size-4 text-emerald-400" aria-hidden="true" />{t}</li>
            ))}
          </ul>
          <Link href="/cadastro" className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-slate-900 hover:bg-slate-100">
            Começar o teste grátis <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        © 2026 BSM Technology · Conserta Já
      </footer>
    </div>
  );
}
