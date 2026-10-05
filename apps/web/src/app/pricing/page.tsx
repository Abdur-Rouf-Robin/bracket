import type { Metadata } from 'next';
import Link from 'next/link';
import { Faq } from '@/components/marketing/faq';
import { FeatureTable } from '@/components/marketing/feature-table';
import { MarketingShell, SectionHeading } from '@/components/marketing/marketing-shell';
import { PricingPlans } from '@/components/marketing/pricing-plans';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Starter is free for one active tournament. Premier is $9/month for unlimited active tournaments, co-admins and score editors.',
};

const PRICING_FAQ = [
  {
    q: 'What is an active tournament?',
    a: 'A tournament is active if a match result was saved in the last 30 days. Drafts and untouched events do not count. Starter includes one. Premier removes the cap.',
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
    a: 'Entry fees and event tickets still go to your own Stripe account. Premier is a separate platform subscription for unlimited active tournaments and extra organizers.',
  },
  {
    q: 'Is there a participant limit?',
    a: 'A single tournament can hold up to 4096 participants. Starter can have one of them active at a time. Drafts with no results do not count.',
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="container-page pt-16 pb-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Start with one live event"
          description="Starter is free for one active tournament. Premier is $9 a month when you are running more than one, or when someone else needs to enter scores."
        />
      </section>
      <section className="container-page pb-16">
        <PricingPlans />
      </section>

      <section className="border-t border-[var(--color-line)] bg-[var(--color-surface)]/30 py-16">
        <div className="container-page">
          <SectionHeading title="What you get" description="The same organizer toolkit on both plans. Premier lifts the active-tournament cap and adds editors." />
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
