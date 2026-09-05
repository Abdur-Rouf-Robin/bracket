import type { Metadata } from 'next';
import { BracketGenerator } from '@/components/marketing/bracket-generator';
import { MarketingShell } from '@/components/marketing/marketing-shell';

export const metadata: Metadata = {
  title: 'Free tournament bracket generator',
  description:
    'Create a single elimination, double elimination, round robin, Swiss or groups + knockout bracket in seconds. Print it, download as PNG, or save it to run online.',
};

export default function BracketGeneratorPage() {
  return (
    <MarketingShell>
      <section className="container-page pt-12 pb-6">
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">Free tool</p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">Tournament bracket generator</h1>
        <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
          Paste participants, pick a format and get a bracket instantly — no account needed. Print it, download a PNG, or
          save it to run the tournament online with live scores.
        </p>
      </section>
      <section className="container-page pb-20">
        <BracketGenerator />
      </section>
    </MarketingShell>
  );
}
