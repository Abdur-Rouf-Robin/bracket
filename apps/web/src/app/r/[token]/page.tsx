'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RefereePortalResponse, ScheduleMatchDto } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  dayKeyOf,
  fmtDayKey,
  fmtTime,
  roundLabel,
  safeTz,
  teamName,
} from '@/components/schedule/schedule-shared';

/**
 * Referee console — token-authenticated (no login), used courtside on phones.
 * Lists the referee's assigned matches grouped by day/station with inline
 * score entry; completed matches are read-only.
 */
export default function RefereeConsolePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const qc = useQueryClient();
  const key = ['referee-portal', token];

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: key,
    queryFn: () => api<RefereePortalResponse>(`/referee/${token}`),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const tz = safeTz(data?.tournament.timezone);

  const grouped = useMemo(() => {
    if (!data) return [];
    const byDay = new Map<string, Map<string, ScheduleMatchDto[]>>();
    for (const m of data.matches) {
      const day = m.scheduledAt ? dayKeyOf(m.scheduledAt, tz) : 'unscheduled';
      const station = m.station?.name ?? m.stationLabel ?? 'No station';
      if (!byDay.has(day)) byDay.set(day, new Map());
      const stations = byDay.get(day)!;
      if (!stations.has(station)) stations.set(station, []);
      stations.get(station)!.push(m);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => (a === 'unscheduled' ? 1 : b === 'unscheduled' ? -1 : a.localeCompare(b)))
      .map(([day, stations]) => ({
        day,
        stations: [...stations.entries()].map(([station, matches]) => ({ station, matches })),
      }));
  }, [data, tz]);

  const pending = data?.matches.filter((m) => m.status !== 'COMPLETED').length ?? 0;

  return (
    <div className="min-h-screen bg-[var(--color-paper)] pb-16">
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-card)]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Referee console</p>
            <h1 className="truncate font-display text-lg font-bold">{data?.tournament.name ?? 'Loading…'}</h1>
          </div>
          {data && (
            <div className="text-right">
              <p className="text-sm font-semibold">{data.referee.name}</p>
              <p className="text-[10px] text-[var(--color-muted)]">{pending} to score</p>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 py-4">
        {isLoading && <p className="text-sm text-[var(--color-muted)]">Loading your matches…</p>}
        {error && (
          <div className="gaming-card rounded-xl p-6 text-center">
            <p className="font-semibold text-[var(--color-danger)]">This link is invalid or has been revoked.</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Ask the organiser for a new referee link.</p>
          </div>
        )}
        {data && data.matches.length === 0 && (
          <div className="gaming-card rounded-xl p-6 text-center text-sm text-[var(--color-muted)]">
            No matches assigned to you yet. This page refreshes automatically.
          </div>
        )}

        {grouped.map(({ day, stations }) => (
          <section key={day} className="mb-6">
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
              {day === 'unscheduled' ? 'No time set' : fmtDayKey(day, 'EEEE d MMMM')}
            </h2>
            {stations.map(({ station, matches }) => (
              <div key={station} className="mb-3">
                <p className="mb-1 px-1 text-[11px] font-semibold text-[var(--color-accent)]">{station}</p>
                <div className="space-y-2">
                  {matches.map((m) => (
                    <RefereeMatchCard
                      key={m.id}
                      match={m}
                      tz={tz}
                      token={token}
                      onSaved={() => qc.invalidateQueries({ queryKey: key })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}

        {data && (
          <p className="mt-6 text-center text-[11px] text-[var(--color-muted)]">
            Times in {tz} · updated {fmtTime(new Date(dataUpdatedAt).toISOString(), tz, 'HH:mm:ss')} ·{' '}
            <Link href={`/t/${data.tournament.slug}`} className="underline">
              tournament page
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}

function RefereeMatchCard({
  match,
  tz,
  token,
  onSaved,
}: {
  match: ScheduleMatchDto;
  tz: string;
  token: string;
  onSaved: () => void;
}) {
  const completed = match.status === 'COMPLETED';
  const canScore = !completed && !!match.homeTeamId && !!match.awayTeamId;
  const [home, setHome] = useState<string>(match.homeScore != null ? String(match.homeScore) : '');
  const [away, setAway] = useState<string>(match.awayScore != null ? String(match.awayScore) : '');
  const [open, setOpen] = useState(false);

  const h = Number(home);
  const a = Number(away);
  const valid = home !== '' && away !== '' && !Number.isNaN(h) && !Number.isNaN(a) && h >= 0 && a >= 0;
  const winner = !valid ? null : h > a ? match.homeTeam : a > h ? match.awayTeam : null;
  const knockout = match.bracketSide !== 'GROUP' && match.bracketSide !== 'SWISS';

  const save = useMutation({
    mutationFn: () =>
      api(`/referee/${token}/matches/${match.id}/result`, {
        method: 'PATCH',
        body: JSON.stringify({
          homeScore: h,
          awayScore: a,
          isDraw: h === a,
          winnerTeamId: winner?.id ?? null,
        }),
      }),
    onSuccess: () => {
      toast.success('Result saved');
      setOpen(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        completed
          ? 'border-[var(--color-line)] bg-[var(--color-surface)]/60'
          : match.status === 'READY'
            ? 'border-[var(--color-accent)]/50 bg-[var(--color-card)]'
            : 'border-[var(--color-line)] bg-[var(--color-card)]',
      )}
    >
      <div className="flex items-center justify-between text-[11px] text-[var(--color-muted)]">
        <span>{roundLabel(match)}</span>
        <span className="flex items-center gap-2">
          {match.scheduledAt && <span className="font-mono text-[var(--color-ink)]">{fmtTime(match.scheduledAt, tz)}</span>}
          <span className={cn('badge', completed ? 'badge-neutral' : match.status === 'READY' ? 'badge-accent' : 'badge-neutral')}>
            {completed ? 'Final' : match.status === 'READY' ? 'Ready' : 'Pending'}
          </span>
        </span>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
        <span className={cn('truncate text-base font-semibold', !match.homeTeam && 'italic text-[var(--color-muted)]', completed && match.winnerTeamId === match.homeTeamId && 'text-[var(--color-ok)]')}>
          {teamName(match.homeTeam)}
        </span>
        {completed ? (
          <span className="font-mono text-xl font-bold">{match.homeScore ?? '-'}</span>
        ) : open ? (
          <ScoreInput value={home} onChange={setHome} />
        ) : (
          <span />
        )}
        <span className={cn('truncate text-base font-semibold', !match.awayTeam && 'italic text-[var(--color-muted)]', completed && match.winnerTeamId === match.awayTeamId && 'text-[var(--color-ok)]')}>
          {teamName(match.awayTeam)}
        </span>
        {completed ? (
          <span className="font-mono text-xl font-bold">{match.awayScore ?? '-'}</span>
        ) : open ? (
          <ScoreInput value={away} onChange={setAway} />
        ) : (
          <span />
        )}
      </div>

      {completed && (
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">{match.isDraw ? 'Draw' : 'Result recorded'}</p>
      )}

      {!completed && !open && (
        <Button
          type="button"
          className="mt-3 w-full"
          disabled={!canScore}
          onClick={() => setOpen(true)}
        >
          {canScore ? 'Enter result' : 'Waiting for teams'}
        </Button>
      )}

      {!completed && open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-[var(--color-muted)]">
            {valid
              ? winner
                ? <>Winner: <b className="text-[var(--color-ink)]">{winner.name}</b></>
                : knockout
                  ? 'Draw — knockout matches need a winner (organiser may allow extra time / penalties).'
                  : 'Draw'
              : 'Enter both scores'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : 'Save result'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = Number(value) || 0;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(String(Math.max(0, n - 1)))}
        className="size-9 rounded-md border border-[var(--color-line)] text-lg leading-none hover:border-[var(--color-accent)]/50"
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-14 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] text-center font-mono text-lg outline-none focus:border-[var(--color-accent)]"
      />
      <button
        type="button"
        onClick={() => onChange(String(n + 1))}
        className="size-9 rounded-md border border-[var(--color-line)] text-lg leading-none hover:border-[var(--color-accent)]/50"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
