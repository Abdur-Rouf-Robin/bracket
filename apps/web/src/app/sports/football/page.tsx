'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { detectSport } from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { SportNav } from '@/components/sport-nav';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';

type BrowseRow = Pick<
  Tournament,
  'id' | 'name' | 'slug' | 'status' | 'format' | 'startAt' | 'game'
> & { _count?: { teams: number; matches: number } };

const FOOTBALL_METHODS = [
  'Create with Football / Soccer or EA FC preset (groups → knockout, 3-1-0).',
  'Enter full-time scores, extra time, and penalties on knockout ties.',
  'Per-player goals, assists, yellow/red cards roll up to fair-play points.',
  'Two-legged ties (home/away aggregate) for groups and knockouts.',
  'Toss/coin flip, check-in, roster lock, and auditable group draw.',
  'Standings with head-to-head, goal difference, and UEFA-style best-thirds.',
  'Share prematch and result cards; MVP leaderboard from player stats.',
];

export default function FootballSportPage() {
  const { user } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: ['tournaments-browse'],
    queryFn: () => api<BrowseRow[]>('/tournaments/browse'),
  });

  const footballTournaments = data.filter(
    (t) => detectSport(t.game?.name) === 'football',
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <SportNav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-wide text-[var(--color-accent)]">
            Football mode
          </p>
          <h1 className="font-display text-4xl font-bold">Football tournaments</h1>
          <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
            FIFA / UEFA-style group stages, knockout rounds, player goals & cards,
            fair-play from discipline, two-legged ties, ET/penalties, and live standings.
          </p>
        </div>

        <section className="mb-10 gaming-card rounded-xl p-6">
          <h2 className="font-display text-lg font-bold">Playing methods</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--color-muted)]">
            {FOOTBALL_METHODS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {user && (
            <Link
              href="/tournaments/new"
              className="mt-5 inline-block rounded-md bg-[var(--color-accent)] px-5 py-2 text-sm font-bold text-[#041018]"
            >
              New football tournament
            </Link>
          )}
        </section>

        <h2 className="font-display mb-4 text-xl font-bold">Football tournaments</h2>
        {isLoading && <p className="text-[var(--color-muted)]">Loading…</p>}
        {!isLoading && footballTournaments.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-[var(--color-muted)]">
            No public football tournaments yet. Use the Football / EA FC game preset when creating.
          </p>
        )}
        <ul className="space-y-3">
          {footballTournaments.map((t) => (
            <li key={t.id}>
              <Link
                href={`/t/${t.slug}/manage?tab=matches`}
                className="gaming-card flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4 transition hover:border-[var(--color-accent)]/40"
              >
                <div>
                  <h3 className="font-display text-lg font-bold">{t.name}</h3>
                  <p className="text-sm text-[var(--color-muted)]">
                    {t.game?.name} · {t.format?.replaceAll('_', ' ')} · {t.status}
                  </p>
                </div>
                <span className="text-sm text-[var(--color-accent)]">Enter scores →</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
