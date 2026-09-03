'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SiteHeader } from '@/components/site-header';
import { SportNav } from '@/components/sport-nav';
import { CricketScoreboardPanel } from '@/components/cricket-scoreboard';
import { CricketScoreboardButton } from '@/components/cricket-scoreboard-button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';

export default function CricketScoreboardPage() {
  const params = useParams<{ slug: string; matchId: string }>();
  const { slug, matchId } = params;
  const { token } = useAuth();

  const { data: tournament, isLoading, error } = useQuery({
    queryKey: ['tournament', slug, token ?? 'anon'],
    queryFn: () => api<Tournament>(`/t/${slug}`, { token: token ?? undefined }),
  });

  const match = tournament?.matches.find((m) => m.id === matchId);
  const playableMatches =
    tournament?.matches.filter(
      (m) =>
        m.homeTeamId &&
        m.awayTeamId &&
        m.status !== 'COMPLETED' &&
        m.status !== 'CANCELLED',
    ) ?? [];
  const invalidMatchId =
    !match &&
    (matchId.includes('{') || matchId.includes('}') || matchId === 'match-id');

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <SportNav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/t/${slug}`} className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            ← {tournament?.name ?? 'Tournament'}
          </Link>
          {tournament?.canManage && (
            <Link
              href={`/t/${slug}/manage?tab=matches`}
              className="text-[var(--color-accent)] hover:underline"
            >
              Manage matches
            </Link>
          )}
        </div>

        {isLoading && <p className="text-[var(--color-muted)]">Loading…</p>}
        {error && (
          <p className="text-red-700">
            {error instanceof Error ? error.message : 'Could not load tournament'}
          </p>
        )}
        {tournament && match && (
          <CricketScoreboardPanel
            match={match}
            tournament={tournament}
            token={token ?? ''}
            canEdit={!!tournament.canManage}
          />
        )}
        {tournament && !match && (
          <div className="space-y-4">
            <p className="text-[var(--color-muted)]">
              {invalidMatchId
                ? 'That link uses a placeholder — open a match from the list below, or use Go to scoreboard on the Matches tab.'
                : 'Match not found in this tournament.'}
            </p>
            {playableMatches.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-display text-lg font-semibold">Open a match</h2>
                {playableMatches.map((m) => (
                  <div
                    key={m.id}
                    className="gaming-card rounded-xl border border-[var(--color-line)] p-4"
                  >
                    <p className="font-semibold">
                      {m.homeTeam?.name ?? 'Home'}{' '}
                      <span className="text-[var(--color-muted)]">vs</span>{' '}
                      {m.awayTeam?.name ?? 'Away'}
                    </p>
                    <div className="mt-3">
                      <CricketScoreboardButton slug={slug} matchId={m.id} fullWidth />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link
              href={`/t/${slug}?tab=matches`}
              className="inline-block text-sm font-semibold text-[var(--color-accent)] hover:underline"
            >
              ← Back to matches
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
