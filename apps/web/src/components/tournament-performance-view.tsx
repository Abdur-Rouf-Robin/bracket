'use client';

import type { TournamentMvpRow } from '@bracket/shared';
import { MvpLeaderboard } from '@/components/mvp-leaderboard';
import type { Tournament } from '@/lib/types';
import {
  computeKnockoutStats,
  computeTeamPerformance,
  type KnockoutStatRow,
  type TeamPerformanceRow,
} from '@/lib/tournament-stats';

export function PlayerPerformanceTable({
  rows,
}: {
  rows: TournamentMvpRow[];
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Player stats appear after match results include player performance.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface)]/60 text-xs uppercase tracking-wider text-[var(--color-muted)]">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Player</th>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3">Matches</th>
            <th className="px-4 py-3">MVP</th>
            <th className="px-4 py-3">Pts</th>
            <th className="px-4 py-3">G</th>
            <th className="px-4 py-3">A</th>
            <th className="px-4 py-3">K</th>
            <th className="px-4 py-3">D</th>
            <th className="px-4 py-3">Rating</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.playerId}
              className="border-b border-[var(--color-line)] last:border-0"
            >
              <td className="px-4 py-3 font-bold tabular-nums">{r.rank}</td>
              <td className="px-4 py-3 font-medium">{r.playerName}</td>
              <td className="px-4 py-3 text-[var(--color-muted)]">{r.teamName}</td>
              <td className="px-4 py-3 tabular-nums">{r.matchesPlayed}</td>
              <td className="px-4 py-3 font-semibold tabular-nums">
                {r.mvpAwards}
              </td>
              <td className="px-4 py-3 tabular-nums">{r.totalMvpScore}</td>
              <td className="px-4 py-3 tabular-nums">{r.totalGoals}</td>
              <td className="px-4 py-3 tabular-nums">{r.totalAssists}</td>
              <td className="px-4 py-3 tabular-nums">{r.totalKills}</td>
              <td className="px-4 py-3 tabular-nums">{r.totalDeaths}</td>
              <td className="px-4 py-3 tabular-nums">{r.avgRating ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TeamPerformanceTable({ rows }: { rows: TeamPerformanceRow[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Team performance appears after matches are played.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface)]/60 text-xs uppercase tracking-wider text-[var(--color-muted)]">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3">P</th>
            <th className="px-4 py-3">W</th>
            <th className="px-4 py-3">L</th>
            <th className="px-4 py-3">D</th>
            <th className="px-4 py-3">GF</th>
            <th className="px-4 py-3">GA</th>
            <th className="px-4 py-3">Pts</th>
            <th className="px-4 py-3">MVP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.teamId}
              className="border-b border-[var(--color-line)] last:border-0"
            >
              <td className="px-4 py-3 font-bold tabular-nums">{r.rank}</td>
              <td className="px-4 py-3 font-semibold">{r.teamName}</td>
              <td className="px-4 py-3 tabular-nums">{r.played}</td>
              <td className="px-4 py-3 tabular-nums">{r.wins}</td>
              <td className="px-4 py-3 tabular-nums">{r.losses}</td>
              <td className="px-4 py-3 tabular-nums">{r.draws}</td>
              <td className="px-4 py-3 tabular-nums">{r.goalsFor}</td>
              <td className="px-4 py-3 tabular-nums">{r.goalsAgainst}</td>
              <td className="px-4 py-3 font-semibold tabular-nums">{r.points}</td>
              <td className="px-4 py-3 tabular-nums">{r.mvpAwards}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KnockoutStatsTable({ rows }: { rows: KnockoutStatRow[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Knockout stats appear once elimination matches are completed.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface)]/60 text-xs uppercase tracking-wider text-[var(--color-muted)]">
          <tr>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3">Placement</th>
            <th className="px-4 py-3">Last round</th>
            <th className="px-4 py-3">W</th>
            <th className="px-4 py-3">L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.teamId}
              className="border-b border-[var(--color-line)] last:border-0"
            >
              <td className="px-4 py-3 font-semibold">{r.teamName}</td>
              <td className="px-4 py-3">{r.placement}</td>
              <td className="px-4 py-3 text-[var(--color-muted)]">
                {r.lastRoundLabel}
              </td>
              <td className="px-4 py-3 tabular-nums">{r.wins}</td>
              <td className="px-4 py-3 tabular-nums">{r.losses}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TournamentStatsSection({
  tournament,
  mvpRows,
  sub,
}: {
  tournament: Tournament;
  mvpRows: TournamentMvpRow[];
  sub: string;
}) {
  const teamRows = computeTeamPerformance(tournament, mvpRows);
  const knockoutRows = computeKnockoutStats(tournament);

  switch (sub) {
    case 'leaderboard':
      return <MvpLeaderboard rows={mvpRows} />;
    case 'knockout':
      return <KnockoutStatsTable rows={knockoutRows} />;
    case 'teams':
    default:
      return <TeamPerformanceTable rows={teamRows} />;
  }
}
