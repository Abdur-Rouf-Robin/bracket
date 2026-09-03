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

const PLAYING_METHODS = [
  'Create a Cricket tournament (Round Robin → playoffs preset).',
  'Add teams with full player rosters — required for ball-by-ball scoring.',
  'Generate bracket / fixtures from the manage panel.',
  'Open any match → Cricket scoreboard for per-ball entry.',
  'Track runs, wickets, overs, extras, strike rotation, and fall of wickets.',
  'T20 / ODI formats with automatic target calculation for chase innings.',
  'Final score syncs to tournament standings when both innings complete.',
  'Public scoreboard link for spectators (live updates via WebSocket).',
];

export default function CricketSportPage() {
  const { user } = useAuth();
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['tournaments-browse'],
    queryFn: () => api<BrowseRow[]>('/tournaments/browse'),
    retry: 1,
    staleTime: 60_000,
  });

  const cricketTournaments = data.filter(
    (t) => detectSport(t.game?.name) === 'cricket',
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <SportNav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-wide text-[var(--color-accent)]">
            Cricket mode
          </p>
          <h1 className="font-display text-4xl font-bold">Ball-by-ball scoreboard</h1>
          <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
            Full cricket scoring — overs, runs per ball, wickets, batting & bowling
            cards, fall of wickets, and live chase targets. Integrated with tournament
            brackets and standings.
          </p>
        </div>

        <div className="mb-10 grid gap-4 md:grid-cols-2">
          <Link
            href="/sports/cricket/free/new"
            className="gaming-card rounded-xl p-6 transition hover:border-[var(--color-accent)]/50"
          >
            <p className="text-xs uppercase tracking-wide text-[var(--color-accent)]">Free mode</p>
            <h2 className="font-display mt-1 text-xl font-bold">Scoreboard only</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              No tournament needed. Create a match, score ball-by-ball with run rate, ducks, DLS rain rule, and all-out.
            </p>
            <span className="mt-4 inline-block text-sm font-semibold text-[var(--color-accent)]">
              Create free scoreboard →
            </span>
          </Link>
          <Link
            href="/tournaments/new"
            className="gaming-card rounded-xl p-6 transition hover:border-[var(--color-accent)]/50"
          >
            <p className="text-xs uppercase tracking-wide text-[var(--color-accent)]">Tournament mode</p>
            <h2 className="font-display mt-1 text-xl font-bold">From tournament</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Full league or knockout with standings, brackets, and cricket scoreboard linked to each fixture.
            </p>
            <span className="mt-4 inline-block text-sm font-semibold text-[var(--color-accent)]">
              New cricket tournament →
            </span>
          </Link>
        </div>

        <section className="mb-10 gaming-card rounded-xl p-6">
          <h2 className="font-display text-lg font-bold">How to run a cricket match</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--color-muted)]">
            {PLAYING_METHODS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {user && (
            <Link
              href="/tournaments/new"
              className="mt-5 inline-block rounded-md bg-[var(--color-accent)] px-5 py-2 text-sm font-bold text-[#041018]"
            >
              New cricket tournament
            </Link>
          )}
        </section>

        <h2 className="font-display mb-4 text-xl font-bold">Cricket tournaments</h2>
        {isLoading && (
          <p className="text-[var(--color-muted)]">Loading public tournaments…</p>
        )}
        {isError && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900">
            Could not load tournaments: {error instanceof Error ? error.message : 'API unavailable'}.
            You can still use the free scoreboard above.
          </p>
        )}
        {!isLoading && !isError && cricketTournaments.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-[var(--color-muted)]">
            No public cricket tournaments yet. Create one and select the Cricket game preset.
          </p>
        )}
        <ul className="space-y-3">
          {cricketTournaments.map((t) => (
            <li key={t.id}>
              <Link
                href={`/t/${t.slug}/manage?tab=matches`}
                className="gaming-card flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4 transition hover:border-[var(--color-accent)]/40"
              >
                <div>
                  <h3 className="font-display text-lg font-bold">{t.name}</h3>
                  <p className="text-sm text-[var(--color-muted)]">
                    {t.format?.replaceAll('_', ' ')} · {t.status}
                  </p>
                </div>
                <span className="text-sm text-[var(--color-accent)]">Manage matches →</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
