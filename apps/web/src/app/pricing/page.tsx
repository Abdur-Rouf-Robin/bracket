import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Faq } from '@/components/marketing/faq';
import { FeatureTable } from '@/components/marketing/feature-table';
import { MarketingShell, SectionHeading } from '@/components/marketing/marketing-shell';
import { PricingPlans } from '@/components/marketing/pricing-plans';
import { FEATURE_SECTIONS, PLANS } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Standard is free forever. Premier removes ads, raises participant limits, and unlocks the auto-scheduler, exports and custom branding.',
};

const PRICING_FAQ = [
  {
    q: 'Is Standard really free?',
    a: `Yes. Unlimited tournaments, communities and events with up to ${PLANS.FREE.limits.maxParticipants} participants each. Standard pages show a small, unobtrusive ad to viewers.`,
  },
  {
    q: 'What happens when I upgrade mid-tournament?',
    a: 'Premier applies to your whole account immediately: ads disappear from all your tournaments, limits increase, and Premier features unlock in the manage view.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from Settings → Billing and you keep Premier until the end of the current billing period. No refunds for partial periods.',
  },
  {
    q: 'Do participants or viewers need to pay?',
    a: 'Never. Plans are for organizers only. Viewers, participants and community members always use the platform for free.',
  },
  {
    q: 'How do paid registrations work?',
    a: 'Connect Stripe to charge entry fees during sign-up. Payments go to your Stripe account; a small platform fee applies on both plans.',
  },
  {
    q: 'Do you offer team, school or non-profit pricing?',
    a: 'Contact us — we offer discounts for schools, charities and multi-organizer clubs.',
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="container-page pt-16 pb-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple pricing for every organizer"
          description="Start free. Upgrade when you want to remove ads or run bigger, more complex events."
        />
      </section>
      <section className="container-page pb-16">
        <Suspense fallback={<div className="skeleton mx-auto h-96 max-w-4xl" />}>
          <PricingPlans />
        </Suspense>
      </section>

      <section className="border-t border-[var(--color-line)] bg-[var(--color-surface)]/30 py-16">
        <div className="container-page">
          <SectionHeading title="Compare plans" description="A quick look at what each plan includes." />
          <div className="mx-auto mt-10 max-w-4xl">
            <FeatureTable compact sections={FEATURE_SECTIONS.filter((s) => ['formats', 'tournament-page', 'scheduling', 'sharing'].includes(s.id))} />
            <p className="mt-4 text-center text-sm text-[var(--color-muted)]">
              <Link href="/features" className="text-[var(--color-accent)] underline-offset-4 hover:underline">
                See the full feature comparison →
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <SectionHeading align="left" eyebrow="FAQ" title="Billing questions" />
          <Faq items={PRICING_FAQ} />
        </div>
      </section>
    </MarketingShell>
  );
}
