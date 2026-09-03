'use client';

import { HeroSliderShell } from '@/components/hero-slider-shell';
import { SiteHeader } from '@/components/site-header';
import { SportNav } from '@/components/sport-nav';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

const FEATURES = [
  {
    title: 'Every major format',
    body: 'Single/double elim, Swiss, round robin, groups → KO, leaderboard, and race formats.',
  },
  {
    title: 'Host tools',
    body: 'Shuffle groups, color-pool drafts, announcements, co-admins, and shareable result cards.',
  },
  {
    title: 'Built for players',
    body: 'Public pages with live updates, optional standings, and SEO controls for private events.',
  },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <SportNav />
      <main>
        <HeroSliderShell />

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-10 text-center">
            <p className="font-display text-sm font-bold uppercase tracking-widest text-[var(--color-accent)]">
              Tournament platform
            </p>
            <h2 className="font-display mt-2 text-3xl font-bold md:text-4xl">
              Everything you need to run brackets
            </h2>
            {user && (
              <p className="mt-3 text-[var(--color-muted)]">
                Welcome back, {user.name}.
              </p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="gaming-card rounded-xl p-6 transition hover:border-[var(--color-accent)]/40"
              >
                <h3 className="font-display text-lg font-bold text-[var(--color-accent)]">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                  {f.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[var(--color-line)] bg-[var(--color-surface)]/50">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-14 text-center">
            <h2 className="font-display text-2xl font-bold md:text-3xl">
              Ready to run your next event?
            </h2>
            <p className="max-w-lg text-[var(--color-muted)]">
              Create a tournament, add participants, and generate your bracket in minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/tournaments/new"
                className="gaming-glow rounded-md bg-[var(--color-accent)] px-6 py-2.5 text-sm font-bold text-[#041018] transition hover:bg-[var(--color-accent-deep)] hover:text-white"
              >
                New tournament
              </Link>
              <Link
                href="/browse"
                className="rounded-md border border-[var(--color-line)] bg-[var(--color-card)] px-6 py-2.5 text-sm font-semibold transition hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-hover)]"
              >
                Browse tournaments
              </Link>
              <Link
                href="/dashboard"
                className="rounded-md border border-[var(--color-line)] bg-[var(--color-card)] px-6 py-2.5 text-sm font-semibold transition hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-hover)]"
              >
                Your tournaments
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
