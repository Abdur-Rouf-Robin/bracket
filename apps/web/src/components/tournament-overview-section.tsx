'use client';

import Link from 'next/link';
import type { Tournament } from '@/lib/types';
import type { TournamentMvpRow } from '@bracket/shared';
import { navHref } from '@/lib/tournament-nav';
import { computeTeamPerformance } from '@/lib/tournament-stats';
import { StandingsTable } from '@/components/bracket-view';

export function TournamentOverviewSection({
  tournament,
  mvpRows,
  basePath,
  showStandings,
  showAnnouncements,
}: {
  tournament: Tournament;
  mvpRows: TournamentMvpRow[];
  basePath: string;
  showStandings: boolean;
  showAnnouncements: boolean;
}) {
  const completed = tournament.matches.filter((m) => m.status === 'COMPLETED')
    .length;
  const total = tournament.matches.length;
  const topTeams = computeTeamPerformance(tournament, mvpRows).slice(0, 5);
  const topPlayers = mvpRows.slice(0, 5);

  const cards = [
    {
      label: 'Teams',
      value: String(tournament.teams.length),
      href: navHref(basePath, 'teams', 'participants'),
    },
    {
      label: 'Matches played',
      value: total ? `${completed}/${total}` : '—',
      href: navHref(basePath, 'matches'),
    },
    {
      label: 'Format',
      value: tournament.format?.replaceAll('_', ' ') ?? 'Draft',
      href: navHref(basePath, 'bracket', 'full'),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="gaming-card rounded-xl border border-[var(--color-line)] p-4 transition hover:border-[var(--color-accent)]/40"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {c.label}
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{c.value}</p>
          </Link>
        ))}
      </div>

      {showAnnouncements && (tournament.announcements?.length ?? 0) > 0 && (
        <section>
          <h3 className="font-display text-lg font-semibold">Announcements</h3>
          <div className="mt-3 space-y-2">
            {tournament.announcements!.map((a) => (
              <div
                key={a.id}
                className="gaming-card rounded-xl px-4 py-3"
              >
                <p className="font-semibold">{a.title}</p>
                <p className="text-sm text-[var(--color-muted)]">{a.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {showStandings && topTeams.length > 0 && (
        <section>
          <div className="flex items-end justify-between gap-2">
            <h3 className="font-display text-lg font-semibold">Standings snapshot</h3>
            <Link
              href={navHref(basePath, 'standings')}
              className="text-xs font-semibold text-[var(--color-accent)]"
            >
              View all →
            </Link>
          </div>
          <div className="mt-3">
            <StandingsTable
              tournament={{
                ...tournament,
                standings: (tournament.standings ?? []).slice(0, 8),
              }}
            />
          </div>
        </section>
      )}

      {topPlayers.length > 0 && (
        <section>
          <div className="flex items-end justify-between gap-2">
            <h3 className="font-display text-lg font-semibold">Top performers</h3>
            <Link
              href={navHref(basePath, 'players', 'performance')}
              className="text-xs font-semibold text-[var(--color-accent)]"
            >
              Player stats →
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {topPlayers.map((p) => (
              <li
                key={p.playerId}
                className="flex items-center justify-between rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm"
              >
                <span>
                  <span className="font-semibold">{p.playerName}</span>
                  <span className="ml-2 text-[var(--color-muted)]">
                    {p.teamName}
                  </span>
                </span>
                <span className="tabular-nums text-[var(--color-muted)]">
                  {p.totalMvpScore} pts
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
