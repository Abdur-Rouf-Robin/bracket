import type { Metadata } from 'next';
import Link from 'next/link';
import { HelpCenter } from '@/components/marketing/help-center';
import { MarketingShell, SectionHeading } from '@/components/marketing/marketing-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Help center',
  description:
    'Guides for creating tournaments, formats, seeding and byes, registration, scheduling, standings criteria, sharing, communities, events and billing.',
};

export default function HelpPage() {
  return (
    <MarketingShell>
      <section className="container-page pt-16 pb-10">
        <SectionHeading eyebrow="Help center" title="How can we help?" description="Guides for every part of running a tournament — from first bracket to finals." />
      </section>
      <section className="container-page pb-20">
        <HelpCenter />
        <div className="card mt-12 flex flex-col items-center justify-between gap-4 p-6 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-display text-base font-bold">Still stuck?</p>
            <p className="text-sm text-[var(--color-muted)]">Send us the tournament link and what you expected to happen — we reply fast.</p>
          </div>
          <Button asChild>
            <Link href="/contact">Contact support</Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
