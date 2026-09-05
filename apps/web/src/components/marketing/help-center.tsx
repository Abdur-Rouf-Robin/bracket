'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BookOpen, ChevronRight, Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import {
  HELP_CATEGORIES,
  articlesInCategory,
  searchArticles,
  type HelpCategoryId,
} from '@/lib/help-content';
import { cn } from '@/lib/utils';

export function HelpSearch({
  value,
  onChange,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--color-muted)]" aria-hidden />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search help articles — e.g. byes, embed, Buchholz…"
        aria-label="Search help articles"
        className="h-14 w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] pl-12 pr-4 text-base shadow-sm outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]/50 focus:ring-2 focus:ring-[var(--color-accent)]/30"
      />
    </div>
  );
}

export function HelpCenter() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<HelpCategoryId | 'all'>('all');
  const results = useMemo(() => searchArticles(query), [query]);
  const searching = query.trim().length > 0;

  return (
    <div className="space-y-10">
      <HelpSearch value={query} onChange={setQuery} className="mx-auto max-w-2xl" />

      {searching ? (
        <section aria-live="polite">
          <p className="mb-4 text-sm text-[var(--color-muted)]">
            {results.length} result{results.length === 1 ? '' : 's'} for “{query}”
          </p>
          {results.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No articles match"
              description="Try different words, or browse by category below."
              action={
                <Link href="/contact" className="text-sm font-semibold text-[var(--color-accent)]">
                  Contact support →
                </Link>
              }
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {results.map((a) => (
                <li key={a.slug}>
                  <ArticleCard slug={a.slug} title={a.title} summary={a.summary} category={a.category} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          <nav aria-label="Categories" className="flex flex-wrap justify-center gap-2">
            <CategoryChip active={category === 'all'} onClick={() => setCategory('all')}>All topics</CategoryChip>
            {HELP_CATEGORIES.map((c) => (
              <CategoryChip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                {c.title}
              </CategoryChip>
            ))}
          </nav>

          <div className="grid gap-6 md:grid-cols-2">
            {HELP_CATEGORIES.filter((c) => category === 'all' || c.id === category).map((c) => {
              const articles = articlesInCategory(c.id);
              return (
                <section key={c.id} id={c.id} className="card p-5">
                  <h2 className="font-display text-lg font-bold">{c.title}</h2>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{c.description}</p>
                  <ul className="mt-4 divide-y divide-[var(--color-line)]">
                    {articles.map((a) => (
                      <li key={a.slug}>
                        <Link
                          href={`/help/${a.slug}`}
                          className="group flex items-center justify-between gap-3 py-2.5 text-sm font-medium transition hover:text-[var(--color-accent)]"
                        >
                          {a.title}
                          <ChevronRight className="size-4 shrink-0 text-[var(--color-muted)] transition group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12 text-[var(--color-accent)]'
          : 'border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-ink)]',
      )}
    >
      {children}
    </button>
  );
}

export function ArticleCard({ slug, title, summary, category }: { slug: string; title: string; summary: string; category: HelpCategoryId }) {
  const cat = HELP_CATEGORIES.find((c) => c.id === category);
  return (
    <Link href={`/help/${slug}`} className="card card-hover block h-full p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent)]">{cat?.title}</p>
      <p className="font-display mt-1 text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{summary}</p>
    </Link>
  );
}
