'use client';

import type { TournamentMvpRow } from '@bracket/shared';

export function MvpLeaderboard({
  rows,
  title = 'Player of the Tournament',
}: {
  rows: TournamentMvpRow[];
  title?: string;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        MVP leaderboard appears after match player stats are recorded.
      </p>
    );
  }

  const leader = rows[0];

  return (
    <div className="space-y-4">
      {leader && (
        <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-transparent p-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/80">
            {title}
          </p>
          <p className="font-display text-2xl font-bold text-amber-200">
            {leader.playerName}
          </p>
          <p className="text-sm text-[var(--color-muted)]">{leader.teamName}</p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            {leader.mvpAwards} match MVP{leader.mvpAwards === 1 ? '' : 's'} ·{' '}
            {leader.totalMvpScore} pts · {leader.matchesPlayed} matches
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-sand)]/50 text-left text-xs uppercase tracking-wider text-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">MVP</th>
              <th className="px-3 py-2">Pts</th>
              <th className="px-3 py-2">G</th>
              <th className="px-3 py-2">A</th>
              <th className="px-3 py-2">K</th>
              <th className="px-3 py-2">D</th>
              <th className="px-3 py-2">Rating</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.playerId}
                className={`border-t border-[var(--color-line)] ${
                  r.rank === 1 ? 'bg-amber-500/5' : ''
                }`}
              >
                <td className="px-3 py-2 font-bold tabular-nums">{r.rank}</td>
                <td className="px-3 py-2 font-medium">
                  {r.playerName}
                  {r.rank === 1 && (
                    <span className="ml-1 text-amber-400">★</span>
                  )}
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">
                  {r.teamName}
                </td>
                <td className="px-3 py-2 font-semibold tabular-nums">
                  {r.mvpAwards}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.totalMvpScore}</td>
                <td className="px-3 py-2 tabular-nums">{r.totalGoals}</td>
                <td className="px-3 py-2 tabular-nums">{r.totalAssists}</td>
                <td className="px-3 py-2 tabular-nums">{r.totalKills}</td>
                <td className="px-3 py-2 tabular-nums">{r.totalDeaths}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.avgRating ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
