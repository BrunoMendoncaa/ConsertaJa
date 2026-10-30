import Link from 'next/link';
import {
  ClipboardList, Camera, FileText, Smartphone, Wallet, ShieldCheck, ArrowRight, CircleCheck,
  BadgeCheck, CalendarClock, ListChecks, Printer, MessageCircle, Wrench,
} from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { ButtonLink } from '@/components/ui/button';
import { PLANS, TRIAL_DAYS, FREE_OS_LIMIT } from '@/lib/billing';
import { SiteTracker } from '@/features/analytics/components/site-tracker';
import { MobileCtaBar } from '@/features/site/components/mobile-cta-bar';
import { CampaignNote } from '@/features/site/components/campaign-note';
import { HeroDemo } from '@/features/site/components/hero-demo';
import { whatsappLink } from '@/lib/contact';

const WHATSAPP = whatsappLink();

// Vídeo do topo (public/site/demo-sistema.mp4): onde começa cada passo, em segundos.
const DEMO_STEPS = [
  { at: 0, title: 'Você abre a OS', text: 'Em 1 minuto, no celular ou no computador.' },
  { at: 6.77, title: 'O cliente aprova pelo celular', text: 'Pelo link, sem ligação.' },
  { at: 13.47, title: 'A garantia sai pronta', text: 'Na entrega do aparelho.' },
];
const monthly = PLANS.monthly;
const yearly = PLANS.yearly;

/** Celular com um print real do sistema. */
function Phone({ src, alt, className = '', priority = false }) {
  return (
    <div className={`rounded-[2.2rem] bg-slate-900 p-2 shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/10 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={600} height={1297} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'}
        className="block w-full rounded-[1.75rem]" />
    </div>
  );
}

const howItWorks = [
  { n: 1, title: 'Abra a OS em 1 minuto', text: 'Cliente, aparelho, defeito, acessórios e fotos de como chegou. O link de acompanhamento sai pronto para o WhatsApp.', img: '/site/os-aberta.webp', alt: 'Ordem de serviço aberta no TecnoFix' },
  { n: 2, title: 'O cliente aprova pelo celular', text: 'Ele abre o link, vê peças e serviços e toca em "Aprovar". Fica registrado com data e hora. Sem ligação, sem "não foi isso que eu falei".', img: '/site/cliente-aprova.webp', alt: 'Cliente aprovando o orçamento pelo celular' },
  { n: 3, title: 'Entregue com garantia', text: 'Na retirada, a garantia sai pronta para imprimir ou mandar em PDF, com prazo e vencimento calculados.', img: '/site/garantia.webp', alt: 'Garantia de 90 dias no celular do cliente' },
];

const features = [
  { icon: ClipboardList, title: 'Ordem de serviço em 1 minuto', text: 'Fluxo rápido de balcão, com número gerado na hora e comprovante com QR code.' },
  { icon: Camera, title: 'Fotos como evidência', text: 'Frente, traseira, tela e danos fotografados pelo celular. Ficam privadas, só para a sua assistência.' },
  { icon: FileText, title: 'Orçamento organizado', text: 'Peças e serviços separados, desconto, prazo e garantia. Cada envio vira uma versão que nunca se perde.' },
  { icon: Smartphone, title: 'Cliente acompanha sozinho', text: 'Menos "já ficou pronto?" no WhatsApp: o cliente vê o andamento pelo link da sua assistência.' },
  { icon: Wallet, title: 'Caixa sem complicação', text: 'Entradas, saídas, valores a receber e lucro estimado por OS.' },
  { icon: ShieldCheck, title: 'Seus dados protegidos', text: 'Cada assistência é isolada no próprio espaço. Ninguém de fora enxerga seus clientes ou números.' },
];

const warrantyPoints = [
  { icon: CalendarClock, title: 'Gerada na entrega', text: 'Ao registrar a retirada, o prazo começa a contar e o vencimento é calculado sozinho.' },
  { icon: ListChecks, title: 'Tudo documentado', text: 'Defeito, solução, número de série e IMEI do aparelho, com a assinatura do cliente.' },
  { icon: BadgeCheck, title: 'Menos discussão no balcão', text: 'Quando o cliente volta, está tudo escrito: o que foi feito e o que a garantia cobre.' },
  { icon: Printer, title: 'Impressa ou no celular', text: 'Entregue no papel ou em PDF pelo WhatsApp. O cliente também abre pelo link enquanto a garantia valer.' },
];

const freeItems = [
  `Até ${FREE_OS_LIMIT} ordens de serviço por mês`,
  'Orçamento aprovado pelo celular',
  'Portal de acompanhamento para o cliente',
  'Comprovante de garantia na entrega',
  'Caixa e relatórios',
];
const proItems = [
  'Ordens de serviço sem limite',
  'Certificado de garantia com o seu logo, peças e serviços',
  'Equipe com técnicos e atendentes, cada um com seu login',
  'Portal do cliente só com a sua marca',
];

const faq = [
  ['É grátis mesmo?', `É. O plano Grátis não tem prazo e não pede cartão: dá para usar todo mês, com até ${FREE_OS_LIMIT} ordens de serviço. Os ${TRIAL_DAYS} primeiros dias têm o Pro completo para você experimentar tudo; depois, a conta continua no Grátis sem perder nada.`],
  ['E se eu precisar de mais OS no mês?', `É só assinar o Pro: ${monthly.priceLabel.replace('/mês', ' por mês')}, sem fidelidade, ou ${yearly.priceLabel.replace('/ano', ' por ano')} (${yearly.note}). As OS ficam sem limite na hora. Pagamento pelo Mercado Pago.`],
  ['Preciso instalar alguma coisa?', 'Não. O TecnoFix funciona no navegador do celular e do computador. Seu cliente também não instala nada: abre o link ou o QR code do comprovante.'],
  ['Serve para a minha assistência?', 'Serve para quem conserta celular, informática, eletrônicos ou eletrodomésticos: recebe o aparelho, faz o orçamento e entrega com garantia.'],
  ['Minha equipe pode usar?', 'No Pro, sim: você convida técnicos e atendentes e escolhe o que cada um pode ver e fazer.'],
  ['Se eu cancelar o Pro, perco alguma coisa?', 'Não. A conta volta para o plano Grátis e tudo o que você cadastrou continua lá.'],
];

export default function LandingPage() {
  return (
    <div className="bg-white">
      <SiteTracker />
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-5">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <ButtonLink href="/entrar" variant="ghost" size="sm" className="sm:h-10 sm:px-4" data-track="topo-entrar">Entrar</ButtonLink>
          <ButtonLink href="/cadastro" size="sm" className="whitespace-nowrap sm:h-10 sm:px-4" data-track="topo-criar-conta"><span>Criar conta<span className="hidden sm:inline"> grátis</span></span></ButtonLink>
        </nav>
      </header>

      {/* ------------------------------------------------------------ Topo
          Pensado para a primeira tela do celular (navegador do Facebook/Instagram): chamada para o
          dono de assistência (a mesma dos anúncios), o título, o sistema funcionando e o botão. */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-brand-100/60 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-x-12 px-4 pb-12 pt-2 sm:px-6 sm:pb-20 sm:pt-8 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-600 ring-1 ring-accent-500/30">
              <Wrench className="size-3.5" aria-hidden="true" /> Para donos de assistência técnica
            </p>
            <h1 className="mt-3 text-[1.85rem] font-bold leading-[1.12] tracking-tight text-slate-900 max-[359px]:text-[1.6rem] sm:mt-5 sm:text-5xl sm:leading-[1.08]">
              Sistema de OS <span className="text-accent-600">grátis</span> para a sua assistência.
            </h1>
            <p className="mt-4 hidden text-lg leading-relaxed text-slate-600 sm:block">
              Abra a OS, mande o orçamento que o cliente aprova pelo celular e entregue com garantia. Sem prazo e sem cartão.
            </p>
          </div>

          <div className="mt-5 max-[359px]:mt-3 sm:mt-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
            <HeroDemo
              src="/site/demo-sistema.mp4"
              webm="/site/demo-sistema.webm"
              poster="/site/demo-sistema-poster.webp"
              steps={DEMO_STEPS}
              label="Vídeo do TecnoFix: abrindo uma OS no celular, o cliente aprovando o orçamento e a garantia pronta"
            />
          </div>

          <div className="mt-5 max-[359px]:mt-3 sm:mt-8 lg:col-start-1 lg:row-start-2 lg:self-start">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Link id="cta-principal" href="/cadastro" data-track="hero-teste-gratis"
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-7 text-lg font-bold text-slate-900 shadow-lg shadow-accent-500/30 transition-colors hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 sm:w-auto">
                Criar conta grátis <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" data-track="hero-whatsapp"
                className="hidden items-center gap-2 text-sm font-medium text-emerald-700 underline-offset-4 hover:underline sm:inline-flex">
                <MessageCircle className="size-4" aria-hidden="true" /> Dúvidas? Fale no WhatsApp
              </a>
            </div>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-600 sm:text-sm">
              {['Leva 2 minutos', 'Só nome, e-mail e senha', 'Sem cartão'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1"><CircleCheck className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />{t}</span>
              ))}
            </p>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" data-track="hero-whatsapp"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 sm:hidden">
              <MessageCircle className="size-4" aria-hidden="true" /> Dúvidas? Fale no WhatsApp
            </a>
            <CampaignNote />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Como funciona */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-sm font-semibold text-brand-700">Como funciona</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Do balcão à entrega, em 3 passos</h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {howItWorks.map((s) => (
              <li key={s.n} className="flex flex-col">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{s.n}</span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
                  </div>
                </div>
                <Phone src={s.img} alt={s.alt} className="mx-auto mt-6 w-full max-w-[13rem] sm:max-w-[15rem]" />
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Link href="/cadastro" data-track="meio-teste-gratis"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-6 text-base font-bold text-slate-900 shadow-md shadow-accent-500/25 hover:bg-accent-600 sm:w-auto">
              Criar conta grátis <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <p className="text-sm text-slate-600">Sem cartão. Os {TRIAL_DAYS} primeiros dias têm tudo liberado.</p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Recursos */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Tudo o que a assistência precisa no dia a dia</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ Garantia */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Garantia na entrega
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Garantia que o cliente leva para casa</h2>
            <p className="mt-3 text-lg leading-relaxed text-slate-300">
              Na retirada, o TecnoFix gera a garantia com tudo o que foi feito no aparelho. Menos discussão quando o cliente volta, mais confiança para ele voltar.
            </p>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {warrantyPoints.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <Icon className="size-5 text-emerald-400" aria-hidden="true" />
                  <p className="mt-2 font-semibold">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{text}</p>
                </li>
              ))}
            </ul>
          </div>
          <Phone src="/site/garantia.webp" alt="Garantia de 90 dias aberta no celular do cliente" className="mx-auto w-full max-w-[16rem] -rotate-2 ring-white/10" />
        </div>
      </section>

      {/* ------------------------------------------------------------ Planos (discreto) */}
      <section id="precos" className="mx-auto max-w-5xl px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Comece grátis. Cresça com o Pro.</h2>
          <p className="mt-3 text-slate-600">Toda conta nova começa com {TRIAL_DAYS} dias de Pro, sem cartão. Depois, você escolhe: continua no Grátis ou assina o Pro.</p>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-slate-600">Grátis</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">R$ 0<span className="text-base font-medium text-slate-500"> para sempre</span></p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
              {freeItems.map((f) => (
                <li key={f} className="flex gap-2"><CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />{f}</li>
              ))}
            </ul>
            <ButtonLink href="/cadastro" variant="outline" className="mt-6 w-full" data-track="precos-gratis">Criar conta grátis</ButtonLink>
          </div>
          <div className="flex flex-col rounded-2xl border-2 border-brand-600 bg-white p-6 shadow-lg shadow-brand-900/5">
            <p className="flex items-center justify-between gap-2 text-sm font-semibold text-brand-700">
              Pro
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{TRIAL_DAYS} dias grátis na conta nova</span>
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900">R$ {monthly.amount}<span className="text-base font-medium text-slate-500">/mês</span></p>
            <p className="text-xs text-slate-500">ou R$ {yearly.amount}/ano ({yearly.note})</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
              <li className="flex gap-2 font-medium text-slate-900"><CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />Tudo do Grátis, e mais:</li>
              {proItems.map((f) => (
                <li key={f} className="flex gap-2"><CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />{f}</li>
              ))}
            </ul>
            <ButtonLink href="/cadastro" className="mt-6 w-full" data-track="precos-pro">Começar com {TRIAL_DAYS} dias de Pro</ButtonLink>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">Pro sem fidelidade, pago pelo Mercado Pago. Se cancelar, a conta volta para o Grátis e nada é apagado.</p>
      </section>

      {/* ------------------------------------------------------------ Perguntas */}
      <section className="mx-auto max-w-3xl px-6 pb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Perguntas frequentes</h2>
        <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {faq.map(([q, a], i) => (
            <details key={q} className="group px-5 py-4" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden="true" className="text-xl leading-none text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Ficou outra dúvida?{' '}
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" data-track="duvidas-whatsapp" className="font-medium text-emerald-700 underline-offset-4 hover:underline">
            Chame no WhatsApp
          </a>
          . A resposta vem direto da equipe do TecnoFix.
        </p>
      </section>

      {/* ------------------------------------------------------------ Final */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-10 text-white sm:px-12">
          <h2 className="text-2xl font-semibold sm:text-3xl">Organize sua assistência hoje, de graça</h2>
          <ul className="mt-4 grid gap-2 text-sm text-brand-50 sm:grid-cols-2">
            {['Grátis, sem prazo e sem cartão', `${TRIAL_DAYS} dias de Pro para experimentar tudo`, 'Link próprio para seus clientes acompanharem', 'Garantia pronta na entrega'].map((t) => (
              <li key={t} className="flex items-center gap-2"><CircleCheck className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />{t}</li>
            ))}
          </ul>
          <Link href="/cadastro" data-track="rodape-teste-gratis" className="mt-7 inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-base font-semibold text-brand-800 hover:bg-brand-50">
            Criar conta grátis <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 pb-28 pt-8 text-center text-xs text-slate-500 sm:pb-8">
        © 2026 BSM Technology · TecnoFix
      </footer>

      <MobileCtaBar watchId="cta-principal" whatsappHref={WHATSAPP} />
    </div>
  );
}
