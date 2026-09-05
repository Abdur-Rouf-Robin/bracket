'use client';

import type { Team, Tournament } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CheckInStatus } from '@bracket/shared';

function formatWhen(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

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
  const qc = useQueryClient();
  const teams = [...tournament.teams].sort(
    (a, b) => (a.seed ?? 999) - (b.seed ?? 999),
  );
  const settings = tournament.settings as
    | {
        hideSeedNumbers?: boolean;
        playersPerTeam?: number;
        useFairPlayTiebreaker?: boolean;
        requireCheckIn?: boolean;
      }
    | undefined;
  const hideSeeds = settings?.hideSeedNumbers === true;
  const showFairPlay = settings?.useFairPlayTiebreaker === true;
  const requireCheckIn = settings?.requireCheckIn === true;

  const checkInQuery = useQuery({
    queryKey: ['check-in-status', slug],
    enabled: !!slug && requireCheckIn,
    refetchInterval: 60_000,
    queryFn: () => api<CheckInStatus>(`/t/${slug}/check-in/status`),
  });
  const checkIn = checkInQuery.data;

  const processEarly = useMutation({
    mutationFn: () =>
      api<{ checkedIn: number }>(`/tournaments/${tournament.id}/check-in/process-early`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      if (slug) {
        qc.invalidateQueries({ queryKey: ['tournament', slug] });
        qc.invalidateQueries({ queryKey: ['check-in-status', slug] });
      }
    },
  });

  if (!teams.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        No participants yet.
      </p>
    );
  }

  const myTeam = userId ? teams.find((t) => t.registeredByUserId === userId) : undefined;
  const canSelfCheckIn =
    !!myTeam && !myTeam.checkedIn && !myTeam.withdrawn && (!checkIn || checkIn.isOpenNow);

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
      {requireCheckIn && (
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)]/40 px-4 py-2.5 text-xs">
          <span className="font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Check-in
          </span>
          {checkIn ? (
            <>
              <span
                className={
                  checkIn.isOpenNow
                    ? 'font-semibold text-[var(--color-ok)]'
                    : 'text-[var(--color-muted)]'
                }
              >
                {checkIn.isOpenNow
                  ? 'Open now'
                  : checkIn.opensAt
                    ? `Opens ${formatWhen(checkIn.opensAt)}`
                    : 'Not open yet'}
                {checkIn.closesAt ? ` · closes ${formatWhen(checkIn.closesAt)}` : ''}
              </span>
              <span className="text-[var(--color-muted)]">
                {checkIn.checkedInCount}/{checkIn.total} checked in
              </span>
            </>
          ) : (
            <span className="text-[var(--color-muted)]">Loading window…</span>
          )}
          {canManage && token && checkIn && checkIn.checkedInCount < checkIn.total && (
            <Button
              type="button"
              variant="secondary"
              className="ml-auto h-7 text-xs"
              disabled={processEarly.isPending}
              onClick={() => {
                if (confirm('Mark every active participant as checked in?')) {
                  processEarly.mutate();
                }
              }}
            >
              Process check-in early
            </Button>
          )}
        </div>
      )}
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
            {canManage && token && (
              <th className="px-4 py-3 text-right font-semibold text-[var(--color-muted)]">
                Actions
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
              hasMatches={(tournament.matches?.length ?? 0) > 0}
              token={token}
              slug={slug}
            />
          ))}
        </tbody>
      </table>
      {userId && canSelfCheckIn && (
        <div className="border-t border-[var(--color-line)] p-3">
          <Button type="button" onClick={onCheckInSelf}>
            Check in my team
          </Button>
        </div>
      )}
      {userId && myTeam && !myTeam.checkedIn && !myTeam.withdrawn && checkIn && !checkIn.isOpenNow && (
        <p className="border-t border-[var(--color-line)] p-3 text-xs text-[var(--color-muted)]">
          Check-in for your team opens {checkIn.opensAt ? formatWhen(checkIn.opensAt) : 'later'}.
        </p>
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
  hasMatches,
  token,
  slug,
}: {
  team: Team;
  hideSeeds: boolean;
  showFairPlay?: boolean;
  canManage?: boolean;
  tournamentId?: string;
  hasMatches?: boolean;
  token?: string;
  slug?: string;
}) {
  const qc = useQueryClient();
  const invalidate = () => {
    if (slug) {
      qc.invalidateQueries({ queryKey: ['tournament', slug] });
      qc.invalidateQueries({ queryKey: ['check-in-status', slug] });
      qc.invalidateQueries({ queryKey: ['registrations', tournamentId] });
    }
  };

  const checkInMutation = useMutation({
    mutationFn: async (checkedIn: boolean) => {
      if (!token || !tournamentId) return;
      return api(`/tournaments/${tournamentId}/teams/${team.id}/check-in`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ checkedIn }),
      });
    },
    onSuccess: invalidate,
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
    onSuccess: invalidate,
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!token || !tournamentId) return;
      return api<{ forfeitsRecorded: number }>(
        `/tournaments/${tournamentId}/teams/${team.id}/withdraw`,
        { method: 'POST', token },
      );
    },
    onSuccess: invalidate,
    onError: (err: Error) => alert(err.message),
  });

  const reinstateMutation = useMutation({
    mutationFn: async () => {
      if (!token || !tournamentId) return;
      return api(`/tournaments/${tournamentId}/teams/${team.id}/reinstate`, {
        method: 'POST',
        token,
      });
    },
    onSuccess: invalidate,
    onError: (err: Error) => alert(err.message),
  });

  const players = team.players ?? [];
  const withdrawn = team.withdrawn === true;
  return (
    <tr
      className={`border-b border-[var(--color-line)] last:border-0 ${withdrawn ? 'opacity-60' : ''}`}
    >
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
          <span className={`font-semibold ${withdrawn ? 'line-through' : ''}`}>{team.name}</span>
          {withdrawn && (
            <span
              className="rounded-full border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-danger)]"
              title={team.withdrawnAt ? `Withdrawn ${formatWhen(team.withdrawnAt)}` : 'Withdrawn'}
            >
              Withdrawn
            </span>
          )}
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
        {withdrawn ? (
          <span className="text-xs text-[var(--color-muted)]">—</span>
        ) : team.checkedIn ? (
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
      {canManage && token && (
        <td className="px-4 py-3 text-right">
          {withdrawn ? (
            <Button
              type="button"
              variant="secondary"
              className="h-8 text-xs"
              disabled={reinstateMutation.isPending}
              onClick={() => reinstateMutation.mutate()}
            >
              Reinstate
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="h-8 text-xs text-[var(--color-danger)]"
              disabled={withdrawMutation.isPending}
              onClick={() => {
                const msg = hasMatches
                  ? `Withdraw ${team.name}? Their remaining matches will be recorded as forfeit wins for the opponents.`
                  : `Withdraw ${team.name} from the tournament?`;
                if (confirm(msg)) withdrawMutation.mutate();
              }}
            >
              Withdraw
            </Button>
          )}
        </td>
      )}
    </tr>
  );
}
