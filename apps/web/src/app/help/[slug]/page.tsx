import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { ArticleCard } from '@/components/marketing/help-center';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { Breadcrumbs } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  HELP_ARTICLES,
  articlesInCategory,
  categoryOf,
  getArticle,
} from '@/lib/help-content';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: 'Article not found' };
  return {
    title: `${article.title} · Help`,
    description: article.summary,
  };
}

export default async function HelpArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const category = categoryOf(article.category);
  const siblings = articlesInCategory(article.category).filter((a) => a.slug !== article.slug);
  const related = (article.related ?? [])
    .map((s) => getArticle(s))
    .filter((a): a is NonNullable<typeof a> => !!a);

  return (
    <MarketingShell>
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/help"><ArrowLeft /> All topics</Link>
            </Button>
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">{category.title}</p>
              <ul className="mt-3 space-y-1 border-l border-[var(--color-line)]">
                {articlesInCategory(article.category).map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/help/${a.slug}`}
                      aria-current={a.slug === article.slug ? 'page' : undefined}
                      className={
                        a.slug === article.slug
                          ? '-ml-px block border-l-2 border-[var(--color-accent)] py-1 pl-3 text-sm font-semibold text-[var(--color-ink)]'
                          : 'block py-1 pl-3 text-sm text-[var(--color-muted)] transition hover:text-[var(--color-ink)]'
                      }
                    >
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <Breadcrumbs
            items={[
              { label: 'Help', href: '/help' },
              { label: category.title, href: `/help#${category.id}` },
              { label: article.title },
            ]}
          />
          <h1 className="font-display mt-4 text-3xl font-bold tracking-tight md:text-4xl">{article.title}</h1>
          <p className="mt-3 text-lg text-[var(--color-muted)]">{article.summary}</p>

          <nav aria-label="On this page" className="card mt-8 p-4 lg:hidden">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">On this page</p>
            <ul className="mt-2 space-y-1">
              {article.sections.map((s, i) => (
                <li key={i}>
                  <a href={`#s-${i}`} className="text-sm text-[var(--color-accent)]">{s.heading}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="prose-brand mt-8">
            {article.sections.map((s, i) => (
              <section key={i} id={`s-${i}`}>
                <h2>{s.heading}</h2>
                {s.body?.map((p, j) => <p key={j}>{p}</p>)}
                {s.bullets && (
                  <ul>
                    {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {(related.length > 0 || siblings.length > 0) && (
            <section className="mt-14 border-t border-[var(--color-line)] pt-8">
              <h2 className="font-display text-lg font-bold">Related articles</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {(related.length > 0 ? related : siblings.slice(0, 4)).map((a) => (
                  <li key={a.slug}>
                    <ArticleCard slug={a.slug} title={a.title} summary={a.summary} category={a.category} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="card mt-10 flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-[var(--color-muted)]">Was this helpful? Tell us what is missing.</p>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/contact?topic=help&article=${article.slug}`}>Send feedback <ChevronRight /></Link>
            </Button>
          </div>
        </article>
      </div>
    </MarketingShell>
  );
}
