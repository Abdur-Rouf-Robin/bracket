import type { Metadata } from 'next';
import Link from 'next/link';
import { Faq } from '@/components/marketing/faq';
import { FeatureTable } from '@/components/marketing/feature-table';
import { MarketingShell, SectionHeading } from '@/components/marketing/marketing-shell';
import { PricingPlans } from '@/components/marketing/pricing-plans';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Bracket is free forever. Every format, game catalog, scheduler, export and cricket scoreboard is included — no subscription.',
};

const PRICING_FAQ = [
  {
    q: 'Is it really all free?',
    a: 'Yes. Every organizer feature is included: all formats, the full game catalog, auto-scheduler, referees, CSV/PDF, custom branding, embeds, TV mode, communities, events and the cricket scoreboard. There is no Premier paywall.',
  },
  {
    q: 'Are there ads?',
    a: 'No. Public pages, embeds and TV mode stay ad-free.',
  },
  {
    q: 'Do participants or viewers need to pay?',
    a: 'Never. Viewers, participants and community members always use the platform for free.',
  },
  {
    q: 'How do paid registrations work?',
    a: 'If you want to charge an entry fee or event ticket, connect your own Stripe account. Payments go to you. Bracket does not sell a platform subscription.',
  },
  {
    q: 'Is there a participant limit?',
    a: 'A single tournament can hold up to 4096 participants. Create as many tournaments, communities and events as you need.',
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="container-page pt-16 pb-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Everything is free"
          description="Score7-simple to run, Challonge-deep in options — without locking any of it behind a subscription."
        />
      </section>
      <section className="container-page pb-16">
        <PricingPlans />
      </section>

      <section className="border-t border-[var(--color-line)] bg-[var(--color-surface)]/30 py-16">
        <div className="container-page">
          <SectionHeading title="What you get" description="The full organizer toolkit on one free plan." />
          <div className="mx-auto mt-10 max-w-4xl">
            <FeatureTable compact />
            <p className="mt-4 text-center text-sm text-[var(--color-muted)]">
              <Link href="/features" className="text-[var(--color-accent)] underline-offset-4 hover:underline">
                See every feature →
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <SectionHeading align="left" eyebrow="FAQ" title="Pricing questions" />
          <Faq items={PRICING_FAQ} />
        </div>
      </section>
    </MarketingShell>
  );
}
