'use client';

import type { Team, Tournament } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function ParticipantsPanel({
  tournament,
  token,
  canManage,
  slug,
  userId,
  onCheckInSelf,
}: {
  tournament: Tournament;
  token?: string;
  canManage?: boolean;
  slug?: string;
  userId?: string;
  onCheckInSelf?: () => void;
}) {
  const teams = [...tournament.teams].sort(
    (a, b) => (a.seed ?? 999) - (b.seed ?? 999),
  );
  const settings = tournament.settings as
    | {
        hideSeedNumbers?: boolean;
        playersPerTeam?: number;
        useFairPlayTiebreaker?: boolean;
      }
    | undefined;
  const hideSeeds = settings?.hideSeedNumbers === true;
  const showFairPlay = settings?.useFairPlayTiebreaker === true;

  if (!teams.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        No participants yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface)]/60">
          <tr>
            {!hideSeeds && (
              <th className="px-4 py-3 font-semibold text-[var(--color-muted)]">
                Seed
              </th>
            )}
            <th className="px-4 py-3 font-semibold text-[var(--color-muted)]">
              Participant
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-muted)]">
              Players
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-muted)]">
              Check-in
            </th>
            {showFairPlay && (
              <th className="px-4 py-3 font-semibold text-[var(--color-muted)]">
                Fair play
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <ParticipantRow
              key={team.id}
              team={team}
              hideSeeds={hideSeeds}
              showFairPlay={showFairPlay}
              canManage={canManage}
              tournamentId={tournament.id}
              token={token}
              slug={slug}
            />
          ))}
        </tbody>
      </table>
      {userId &&
        teams.some((t) => t.registeredByUserId === userId && !t.checkedIn) && (
          <div className="border-t border-[var(--color-line)] p-3">
            <Button type="button" onClick={onCheckInSelf}>
              Check in my team
            </Button>
          </div>
        )}
    </div>
  );
}

function ParticipantRow({
  team,
  hideSeeds,
  showFairPlay,
  canManage,
  tournamentId,
  token,
  slug,
}: {
  team: Team;
  hideSeeds: boolean;
  showFairPlay?: boolean;
  canManage?: boolean;
  tournamentId?: string;
  token?: string;
  slug?: string;
}) {
  const qc = useQueryClient();
  const checkInMutation = useMutation({
    mutationFn: async (checkedIn: boolean) => {
      if (!token || !tournamentId) return;
      return api(`/tournaments/${tournamentId}/teams/${team.id}/check-in`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ checkedIn }),
      });
    },
    onSuccess: () => {
      if (slug) qc.invalidateQueries({ queryKey: ['tournament', slug] });
    },
  });

  const fairPlayMutation = useMutation({
    mutationFn: async (fairPlayPoints: number) => {
      if (!token || !tournamentId) return;
      return api(`/tournaments/${tournamentId}/teams/${team.id}/media`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ fairPlayPoints }),
      });
    },
    onSuccess: () => {
      if (slug) qc.invalidateQueries({ queryKey: ['tournament', slug] });
    },
  });

  const players = team.players ?? [];
  return (
    <tr className="border-b border-[var(--color-line)] last:border-0">
      {!hideSeeds && (
        <td className="px-4 py-3 font-mono text-[var(--color-muted)]">
          {team.seed ?? '—'}
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logoUrl}
              alt=""
              className="size-8 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{
                backgroundColor: team.poolColor ?? 'var(--color-accent)',
              }}
            >
              {team.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="font-semibold">{team.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-[var(--color-muted)]">
        {players.length
          ? players
              .map((p) => (p.isCaptain ? `${p.name} (C)` : p.name))
              .join(', ')
          : '—'}
      </td>
      <td className="px-4 py-3">
        {team.checkedIn ? (
          <span className="text-xs font-semibold text-[var(--color-ok)]">
            Checked in
          </span>
        ) : canManage && token ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => checkInMutation.mutate(true)}
            disabled={checkInMutation.isPending}
          >
            Check in
          </Button>
        ) : (
          <span className="text-xs text-[var(--color-muted)]">—</span>
        )}
      </td>
      {showFairPlay && canManage && token ? (
        <td className="px-4 py-3">
          <input
            type="number"
            min={0}
            max={999}
            className="w-16 rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"
            defaultValue={team.fairPlayPoints ?? 0}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v !== (team.fairPlayPoints ?? 0)) {
                fairPlayMutation.mutate(v);
              }
            }}
            title="Disciplinary points (lower ranks higher)"
          />
        </td>
      ) : showFairPlay ? (
        <td className="px-4 py-3 font-mono text-[var(--color-muted)]">
          {team.fairPlayPoints ?? 0}
        </td>
      ) : null}
    </tr>
  );
}
