import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Check, Sigma } from 'lucide-react';
import { Faq } from '@/components/marketing/faq';
import { FormatDemo } from '@/components/marketing/format-demo';
import { FORMAT_PAGES, getFormatPage } from '@/components/marketing/format-content';
import { MarketingShell, SectionHeading } from '@/components/marketing/marketing-shell';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/page-header';

type Params = { format: string };

export function generateStaticParams(): Params[] {
  return FORMAT_PAGES.map((f) => ({ format: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { format } = await params;
  const page = getFormatPage(format);
  if (!page) return { title: 'Format not found' };
  return {
    title: `${page.name} tournament generator`,
    description: `${page.tagline} ${page.intro}`,
    keywords: page.keywords,
    openGraph: { title: `${page.name} — Bracket`, description: page.intro },
  };
}

export default async function FormatPage({ params }: { params: Promise<Params> }) {
  const { format } = await params;
  const page = getFormatPage(format);
  if (!page) notFound();

  const others = FORMAT_PAGES.filter((f) => f.slug !== page.slug);
  const createHref = `/tournaments/new?format=${encodeURIComponent(page.apiFormat)}`;

  return (
    <MarketingShell>
      <section className="relative overflow-hidden border-b border-[var(--color-line)]">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="container-page relative py-16">
          <Breadcrumbs items={[{ label: 'Formats', href: '/formats/single-elimination' }, { label: page.name }]} />
          <div className="mt-6 grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">Format</p>
              <h1 className="font-display mt-2 text-4xl font-bold tracking-tight md:text-5xl">{page.name}</h1>
              <p className="mt-3 text-xl text-[var(--color-muted)]">{page.tagline}</p>
              <p className="mt-4 max-w-xl text-[var(--color-muted)]">{page.intro}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" className="gaming-glow" asChild>
                  <Link href={createHref}>Create a {page.name.toLowerCase()} tournament <ArrowRight /></Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/bracket-generator">Quick bracket</Link>
                </Button>
              </div>
            </div>
            <div className="card flex items-start gap-4 p-6">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/12 text-[var(--color-accent)]">
                <Sigma className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">Match count</p>
                <p className="font-display mt-1 text-3xl font-bold">{page.math.formula}</p>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{page.math.explanation}</p>
                <p className="mt-2 text-sm"><span className="font-semibold">Example:</span> {page.math.example}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <SectionHeading align="left" eyebrow="Live demo" title={`An 8-team ${page.name.toLowerCase()} bracket`} description="Generated in your browser by the same engine that powers every tournament on Bracket." />
        <div className="mt-8">
          <FormatDemo format={page.preview} />
        </div>
      </section>

      <section className="border-y border-[var(--color-line)] bg-[var(--color-surface)]/30 py-16">
        <div className="container-page grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold">How it works</h2>
            <ol className="mt-5 space-y-4">
              {page.howItWorks.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="font-display inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-sm font-bold text-[var(--color-accent-fg)]">{i + 1}</span>
                  <p className="text-sm leading-relaxed text-[var(--color-muted)] md:text-base">{step}</p>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">When to use it</h2>
            <ul className="mt-5 space-y-3">
              {page.whenToUse.map((w) => (
                <li key={w} className="flex items-start gap-3 text-sm md:text-base">
                  <Check className="mt-1 size-4 shrink-0 text-[var(--color-ok)]" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <SectionHeading align="left" eyebrow="FAQ" title={`${page.name} questions`} />
          <Faq items={page.faq} />
        </div>
      </section>

      <section className="border-t border-[var(--color-line)] bg-[var(--color-surface)]/30 py-16">
        <div className="container-page">
          <SectionHeading title="Other formats" />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((f) => (
              <Link key={f.slug} href={`/formats/${f.slug}`} className="card card-hover p-4">
                <p className="font-display text-sm font-bold">{f.name}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{f.tagline}</p>
              </Link>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button size="lg" asChild>
              <Link href={createHref}>Start a {page.name.toLowerCase()} tournament</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
