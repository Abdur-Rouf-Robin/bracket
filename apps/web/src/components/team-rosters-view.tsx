'use client';

import type { Team, Tournament } from '@/lib/types';
import { teamColor } from '@/lib/team-display';

export function TeamRostersView({ tournament }: { tournament: Tournament }) {
  const teams = [...tournament.teams].sort(
    (a, b) => (a.seed ?? 999) - (b.seed ?? 999),
  );

  if (!teams.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">No teams registered yet.</p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => (
        <TeamRosterCard key={team.id} team={team} hideSeeds={
          (tournament.settings as { hideSeedNumbers?: boolean } | undefined)
            ?.hideSeedNumbers === true
        } />
      ))}
    </div>
  );
}

function TeamRosterCard({
  team,
  hideSeeds,
}: {
  team: Team;
  hideSeeds: boolean;
}) {
  const color = team.poolColor ?? teamColor({ name: team.name, poolColor: null });
  const players = team.players ?? [];

  return (
    <article className="gaming-card overflow-hidden rounded-xl border border-[var(--color-line)]">
      {team.teamPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.teamPhotoUrl}
          alt=""
          className="h-32 w-full object-cover"
        />
      ) : (
        <div
          className="flex h-24 items-center justify-center"
          style={{ backgroundColor: `${color}33` }}
        >
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logoUrl}
              alt=""
              className="size-16 rounded-full object-cover ring-2 ring-white/20"
            />
          ) : (
            <span
              className="flex size-16 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {team.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2">
          {team.logoUrl && team.teamPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logoUrl}
              alt=""
              className="size-8 rounded-full object-cover"
            />
          )}
          <div>
            <h3 className="font-display font-semibold">{team.name}</h3>
            {!hideSeeds && team.seed != null && (
              <p className="text-xs text-[var(--color-muted)]">Seed #{team.seed}</p>
            )}
          </div>
        </div>

        <ul className="mt-3 space-y-2">
          {players.length === 0 && (
            <li className="text-xs text-[var(--color-muted)]">No players listed</li>
          )}
          {players.map((p) => (
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
              <span>
                {p.name}
                {p.isCaptain && (
                  <span className="ml-1 text-xs text-[var(--color-muted)]">
                    (C)
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
