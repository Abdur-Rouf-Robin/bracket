import type { Metadata } from 'next';
import Link from 'next/link';
import { Globe2, HeartHandshake, Rocket, ShieldCheck } from 'lucide-react';
import { MarketingShell, SectionHeading } from '@/components/marketing/marketing-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'About',
  description: 'Bracket is a tournament platform built by organizers for organizers — brackets, schedules and live results for every sport and game.',
};

const VALUES = [
  { icon: Rocket, title: 'Fast by default', body: 'From names to a published bracket in minutes. Every screen is designed to be run from a phone at a noisy venue.' },
  { icon: ShieldCheck, title: 'Rules done right', body: 'Seeding, byes, tiebreakers, best thirds, Buchholz, bracket resets — implemented and tested against the official rulebooks.' },
  { icon: Globe2, title: 'Open to viewers', body: 'Spectators, parents and players never need an account. Public pages, embeds and TV mode just work.' },
  { icon: HeartHandshake, title: 'Free to start', body: 'Standard is genuinely free with no participant paywall for small events. Premier funds the platform for organizers who need more.' },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <section className="container-page pt-16 pb-12">
        <SectionHeading eyebrow="About" title="Built by people who run tournaments" description="Bracket started as a weekend tool for a local futsal league and grew into a full platform for clubs, esports communities and event organizers around the world." />
      </section>

      <section className="container-page pb-16">
        <div className="prose-brand mx-auto max-w-3xl">
          <h2>Why we built it</h2>
          <p>
            Organizers were stuck between free tools that stopped at the bracket image and enterprise suites priced for federations. We wanted the depth of a professional system — auto-scheduling, referees, registrations, communities and rankings — with the simplicity of pasting a list of names and hitting Generate.
          </p>
          <h2>What we believe</h2>
          <p>
            A tournament is a promise to participants: fair pairings, clear rules and results everyone can see. Software should keep that promise and get out of the way. That is why our engine is open about how it seeds, why viewers never log in, and why the core stays free.
          </p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.title} className="card p-6">
              <v.icon className="size-6 text-[var(--color-accent)]" aria-hidden />
              <h3 className="font-display mt-3 text-lg font-bold">{v.title}</h3>
              <p className="mt-1.5 text-sm text-[var(--color-muted)]">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--color-line)] bg-[var(--color-surface)]/30 py-16">
        <div className="container-page text-center">
          <h2 className="font-display text-2xl font-bold">Want to talk?</h2>
          <p className="mt-2 text-[var(--color-muted)]">Partnerships, press, schools and non-profits — we would love to hear from you.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild><Link href="/contact">Contact us</Link></Button>
            <Button variant="secondary" asChild><Link href="/help">Help center</Link></Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
