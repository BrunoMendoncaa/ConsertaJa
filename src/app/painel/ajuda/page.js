import { requireStaff } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { HelpBrowser } from '@/features/help/components/help-browser';
import { HELP_CATEGORIES, guidesForRole, faqForRole, searchableText } from '@/features/help/guides';
import { normalizeSearch } from '@/features/help/text';

export const metadata = { title: 'Como usar' };

export default async function HelpPage() {
  const { role } = await requireStaff();

  // Só os guias e perguntas da função de quem está vendo (técnico não vê os de caixa, etc.).
  const guides = guidesForRole(role).map((g) => ({
    slug: g.slug,
    category: g.category,
    title: g.title,
    summary: g.summary,
    hasVideo: Boolean(g.media?.some((m) => m.type === 'video')),
    search: searchableText(g),
  }));
  const categories = HELP_CATEGORIES
    .map((c) => ({ id: c.id, title: c.title, icon: c.icon, guides: guides.filter((g) => g.category === c.id) }))
    .filter((c) => c.guides.length > 0);
  const faq = faqForRole(role).map((f) => ({ q: f.q, a: f.a, search: normalizeSearch(`${f.q} ${f.a.replace(/\*\*/g, '')}`) }));

  return (
    <>
      <PageHeader title="Como usar o TecnoFix" description="Guias curtos de cada função, com passo a passo, prints e vídeos." />
      <HelpBrowser categories={categories} faq={faq} />
    </>
  );
}
