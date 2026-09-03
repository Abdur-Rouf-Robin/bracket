'use client';

import type { Tournament } from '@/lib/types';
import { teamColor } from '@/lib/team-display';

type PlayerRow = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  isCaptain: boolean;
  isSub: boolean;
  photoUrl: string | null;
  teamLogoUrl: string | null;
  poolColor: string | null;
};

function allPlayers(tournament: Tournament): PlayerRow[] {
  const rows: PlayerRow[] = [];
  for (const team of tournament.teams) {
    for (const p of team.players ?? []) {
      rows.push({
        id: p.id,
        name: p.name,
        teamId: team.id,
        teamName: team.name,
        isCaptain: p.isCaptain ?? false,
        isSub: p.isSub ?? false,
        photoUrl: p.photoUrl ?? null,
        teamLogoUrl: team.logoUrl ?? null,
        poolColor: team.poolColor ?? null,
      });
    }
  }
  return rows.sort((a, b) => {
    const teamCmp = a.teamName.localeCompare(b.teamName);
    if (teamCmp !== 0) return teamCmp;
    if (a.isCaptain !== b.isCaptain) return a.isCaptain ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function AllPlayersView({ tournament }: { tournament: Tournament }) {
  const players = allPlayers(tournament);

  if (!players.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        No players listed yet. Add player names under Players → Edit rosters
        (manage) or when creating the tournament.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface)]/60 text-xs uppercase tracking-wider text-[var(--color-muted)]">
          <tr>
            <th className="px-4 py-3">Player</th>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3">Role</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const color =
              p.poolColor ?? teamColor({ name: p.teamName, poolColor: null });
            return (
              <tr
                key={p.id}
                className="border-b border-[var(--color-line)] last:border-0"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photoUrl}
                        alt=""
                        className="size-8 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="font-medium">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.teamLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.teamLogoUrl}
                        alt=""
                        className="size-6 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {p.teamName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="text-[var(--color-muted)]">{p.teamName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--color-muted)]">
                  {p.isCaptain ? 'Captain' : p.isSub ? 'Substitute' : 'Player'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-[var(--color-line)] px-4 py-2 text-xs text-[var(--color-muted)]">
        {players.length} player{players.length === 1 ? '' : 's'} across{' '}
        {new Set(players.map((p) => p.teamId)).size} teams
      </p>
    </div>
  );
}

export function PlayersByTeamView({ tournament }: { tournament: Tournament }) {
  const teams = [...tournament.teams].sort(
    (a, b) => (a.seed ?? 999) - (b.seed ?? 999),
  );
  const withPlayers = teams.filter((t) => (t.players?.length ?? 0) > 0);

  if (!withPlayers.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        No team rosters with player names yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {withPlayers.map((team) => {
        const color =
          team.poolColor ?? teamColor({ name: team.name, poolColor: null });
        return (
          <section
            key={team.id}
            className="gaming-card rounded-xl border border-[var(--color-line)] p-4"
          >
            <div className="flex items-center gap-3 border-b border-[var(--color-line)] pb-3">
              {team.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.logoUrl}
                  alt=""
                  className="size-10 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {team.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div>
                <h3 className="font-display font-semibold">{team.name}</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  {team.players!.length} player
                  {team.players!.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {team.players!.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photoUrl}
                      alt=""
                      className="size-7 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="font-medium">{p.name}</span>
                  {p.isCaptain && (
                    <span className="rounded bg-[var(--color-accent)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-accent)]">
                      Captain
                    </span>
                  )}
                  {p.isSub && !p.isCaptain && (
                    <span className="rounded bg-[var(--color-muted)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-muted)]">
                      Sub
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
