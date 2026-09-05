import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FeatureTable } from '@/components/marketing/feature-table';
import { MarketingShell, SectionHeading } from '@/components/marketing/marketing-shell';
import { Button } from '@/components/ui/button';
import { FEATURE_SECTIONS } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Compare Standard and Premier: formats, tournament pages, registration, scheduling, sharing, communities, integrations and support.',
};

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="container-page pt-16 pb-10">
        <SectionHeading
          eyebrow="Features"
          title="Everything you need to run a tournament"
          description="Standard is free and complete. Premier removes ads and adds the tools serious organizers ask for."
        />
        <nav aria-label="Feature sections" className="mt-8 flex flex-wrap justify-center gap-2">
          {FEATURE_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-accent)]/50 hover:text-[var(--color-ink)]"
            >
              {s.title}
            </a>
          ))}
        </nav>
      </section>

      <section className="container-page pb-20">
        <FeatureTable />
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            Need something not listed? Check the{' '}
            <Link href="/help" className="text-[var(--color-accent)] underline-offset-4 hover:underline">
              help center
            </Link>{' '}
            or{' '}
            <Link href="/contact" className="text-[var(--color-accent)] underline-offset-4 hover:underline">
              contact us
            </Link>
            .
          </p>
          <Button size="lg" asChild>
            <Link href="/pricing">See pricing <ArrowRight /></Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
