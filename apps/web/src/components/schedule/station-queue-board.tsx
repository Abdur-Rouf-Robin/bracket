'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ScheduleMatchDto, StationQueueResponse } from '@bracket/shared';
import { api } from '@/lib/api';
import { useTournamentLive } from '@/lib/use-tournament-live';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Maximize2, MonitorPlay, RefreshCw } from './icons';
import { fmtTime, roundLabel, safeTz, scheduleKeys, teamName } from './schedule-shared';

export function StationQueueBoard({
  tournamentId,
  slug,
  timezone,
  token,
  fullWidth = false,
  hideChrome = false,
  live = false,
}: {
  tournamentId: string;
  slug: string;
  timezone?: string;
  token?: string;
  fullWidth?: boolean;
  hideChrome?: boolean;
  /**
   * Own the socket subscription. Leave false when a parent page already calls
   * useTournamentLive (leaving the room on unmount would also drop the parent).
   */
  live?: boolean;
}) {
  const tz = safeTz(timezone);
  const { connected } = useTournamentLive(live ? tournamentId : undefined, slug);
  const { data, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: scheduleKeys.queue(slug),
    queryFn: () => api<StationQueueResponse>(`/t/${slug}/station-queue`, { token }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* unsupported */
    }
  }, []);

  if (isLoading || !data) {
    return <div className="gaming-card rounded-xl p-6 text-sm text-[var(--color-muted)]">Loading station queue…</div>;
  }

  const cols = data.stations.length;
  const gridCols =
    cols <= 1 ? 'grid-cols-1' : cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4';

  return (
    <div className={cn('space-y-4', isFull && 'p-6')}>
      {!hideChrome && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <MonitorPlay className="size-4" />
            <span>Station queue</span>
            {live && (
              <span className={cn('inline-flex items-center gap-1 text-xs', connected ? 'text-[var(--color-ok)]' : '')}>
                <span className={cn('size-1.5 rounded-full', connected ? 'animate-pulse bg-[var(--color-ok)]' : 'bg-[var(--color-muted)]')} />
                {connected ? 'Live' : 'Polling'}
              </span>
            )}
            <span className="text-xs">· updated {fmtTime(new Date(dataUpdatedAt).toISOString(), tz, 'HH:mm:ss')}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => refetch()} disabled={isFetching} className="py-1">
              <RefreshCw className={cn('mr-1 size-3.5', isFetching && 'animate-spin')} /> Refresh
            </Button>
            <Button variant="secondary" type="button" onClick={toggleFullscreen} className="py-1">
              <Maximize2 className="mr-1 size-3.5" /> {isFull ? 'Exit fullscreen' : 'Fullscreen'}
            </Button>
          </div>
        </div>
      )}

      {data.stations.length === 0 ? (
        <div className="gaming-card rounded-xl p-8 text-center text-sm text-[var(--color-muted)]">
          No stations configured yet.
        </div>
      ) : (
        <div className={cn('grid gap-4', gridCols, fullWidth && 'xl:grid-cols-4')}>
          {data.stations.map(({ station, current, upNext, recentlyCompleted }) => (
            <div
              key={station.id}
              className={cn(
                'gaming-card flex flex-col rounded-2xl p-4',
                station.status === 'CLOSED' && 'opacity-60',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-2xl font-bold">{station.name}</h3>
                <span
                  className={cn(
                    'badge',
                    station.status === 'IN_USE' ? 'badge-accent' : station.status === 'CLOSED' ? 'badge-neutral' : 'badge-ok',
                  )}
                >
                  {station.status.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent)]">Now playing</p>
                {current ? (
                  <BigMatch match={current} tz={tz} />
                ) : (
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {station.status === 'CLOSED' ? 'Station closed' : 'Free — waiting for the next match'}
                  </p>
                )}
              </div>

              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">Up next</p>
                {upNext.length === 0 ? (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">Nothing queued</p>
                ) : (
                  <ol className="mt-1 space-y-1">
                    {upNext.map((m, i) => (
                      <li key={m.id} className="flex items-center gap-2 rounded-lg bg-[var(--color-surface)] px-2 py-1.5 text-sm">
                        <span className="w-4 text-center font-mono text-xs text-[var(--color-muted)]">{i + 1}</span>
                        <span className="flex-1 truncate">
                          <span className={cn(!m.homeTeam && 'italic text-[var(--color-muted)]')}>{teamName(m.homeTeam)}</span>
                          <span className="mx-1 text-[var(--color-muted)]">vs</span>
                          <span className={cn(!m.awayTeam && 'italic text-[var(--color-muted)]')}>{teamName(m.awayTeam)}</span>
                        </span>
                        <span className="font-mono text-xs text-[var(--color-muted)]">{m.scheduledAt ? fmtTime(m.scheduledAt, tz) : m.status === 'READY' ? 'ready' : 'tbd'}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {recentlyCompleted.length > 0 && (
                <div className="mt-3 border-t border-[var(--color-line)] pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">Recent results</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">
                    {recentlyCompleted.map((m) => (
                      <li key={m.id} className="flex justify-between gap-2">
                        <span className="truncate">
                          {teamName(m.homeTeam)} vs {teamName(m.awayTeam)}
                        </span>
                        <span className="font-mono">
                          {m.homeScore ?? '-'}–{m.awayScore ?? '-'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="gaming-card rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Ready — no station yet</h3>
          <span className="badge badge-neutral">{data.unassigned.length}</span>
        </div>
        {data.unassigned.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--color-muted)]">Every ready match has a station.</p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.unassigned.map((m) => (
              <div key={m.id} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{roundLabel(m)}</p>
                <p className="truncate">
                  {teamName(m.homeTeam)} <span className="text-[var(--color-muted)]">vs</span> {teamName(m.awayTeam)}
                </p>
                {m.scheduledAt && <p className="font-mono text-xs text-[var(--color-muted)]">{fmtTime(m.scheduledAt, tz, 'EEE HH:mm')}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BigMatch({ match, tz }: { match: ScheduleMatchDto; tz: string }) {
  const live = match.homeScore != null || match.awayScore != null;
  return (
    <div className="mt-1">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
        {roundLabel(match)}
        {match.scheduledAt && <span className="ml-2 font-mono">{fmtTime(match.scheduledAt, tz)}</span>}
      </p>
      <div className="mt-1 space-y-1">
        {[
          { team: match.homeTeam, score: match.homeScore },
          { team: match.awayTeam, score: match.awayScore },
        ].map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span className={cn('truncate font-display text-xl font-bold', !row.team && 'italic text-[var(--color-muted)]')}>
              {teamName(row.team)}
            </span>
            {live && <span className="font-mono text-2xl font-bold">{row.score ?? 0}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
