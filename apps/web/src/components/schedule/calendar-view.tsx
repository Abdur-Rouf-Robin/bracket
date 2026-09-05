'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fromZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';
import type {
  PublicScheduleResponse,
  RefereeDto,
  ScheduleConflictDto,
  ScheduleMatchDto,
} from '@bracket/shared';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { AlertTriangle, CalendarDays, LayoutGrid, List, Plus } from './icons';
import { MatchCard } from './match-card';
import { MatchSlotDialog } from './match-slot-dialog';
import {
  STAGE_OPTIONS,
  conflictLabel,
  fmtDayKey,
  fmtTime,
  icsUrl,
  roundLabel,
  safeTz,
  scheduleKeys,
  scoreLine,
  statusBadge,
  teamName,
} from './schedule-shared';
import { TimelineGrid, type DropTarget } from './timeline-grid';

const UNSCHEDULED = '__unscheduled__';

export function useScheduleQuery(slug: string, token?: string) {
  return useQuery({
    queryKey: scheduleKeys.schedule(slug, !!token),
    queryFn: () => api<PublicScheduleResponse>(`/t/${slug}/schedule`, { token }),
  });
}

export function CalendarView({
  tournament,
  token,
  mode,
  basePath,
}: {
  tournament: Tournament;
  token?: string;
  mode: 'public' | 'manage';
  basePath?: string;
}) {
  const qc = useQueryClient();
  const manage = mode === 'manage' && !!token;
  const tz = safeTz(tournament.timezone);
  const { data, isLoading, error } = useScheduleQuery(tournament.slug, token);
  const { data: referees = [] } = useQuery({
    queryKey: scheduleKeys.referees(tournament.slug),
    enabled: manage,
    queryFn: () => api<RefereeDto[]>(`/tournaments/${tournament.id}/referees`, { token }),
  });

  const [view, setView] = useState<'list' | 'timeline'>('timeline');
  const [day, setDay] = useState<string | null>(null);
  const [teamId, setTeamId] = useState('');
  const [stage, setStage] = useState('');
  const [stationId, setStationId] = useState('');
  const [editing, setEditing] = useState<ScheduleMatchDto | null>(null);
  const [showConflicts, setShowConflicts] = useState(false);
  const [extraTimes, setExtraTimes] = useState<Record<string, string[]>>({});
  const [newTime, setNewTime] = useState('');

  const days = data?.days ?? [];
  const activeDay = day && (day === UNSCHEDULED || days.some((d) => d.date === day))
    ? day
    : days[0]?.date ?? (data?.unscheduled.length ? UNSCHEDULED : null);

  const allMatches = useMemo(
    () => [...days.flatMap((d) => d.matches), ...(data?.unscheduled ?? [])],
    [days, data?.unscheduled],
  );
  const teamOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of allMatches) {
      if (m.homeTeam) map.set(m.homeTeam.id, m.homeTeam.name);
      if (m.awayTeam) map.set(m.awayTeam.id, m.awayTeam.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allMatches]);

  const applyFilters = (list: ScheduleMatchDto[]) =>
    list.filter(
      (m) =>
        (!teamId || m.homeTeamId === teamId || m.awayTeamId === teamId) &&
        (!stage || m.bracketSide === stage) &&
        (!stationId || m.stationId === stationId),
    );

  const dayMatches = useMemo(() => {
    if (!activeDay || activeDay === UNSCHEDULED) return [];
    return applyFilters(days.find((d) => d.date === activeDay)?.matches ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDay, days, teamId, stage, stationId]);
  const unscheduled = useMemo(
    () => applyFilters(data?.unscheduled ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.unscheduled, teamId, stage, stationId],
  );

  const conflicts: ScheduleConflictDto[] = data?.conflicts ?? [];

  const moveMatch = useMutation({
    mutationFn: ({ matchId, target }: { matchId: string; target: DropTarget }) =>
      api<{ match: ScheduleMatchDto; conflicts: ScheduleConflictDto[] }>(
        `/tournaments/${tournament.id}/matches/${matchId}/slot`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            scheduledAt: target.startAt,
            stationId: target.stationId,
          }),
        },
      ),
    onSuccess: async (res, vars) => {
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
      const mine = res.conflicts.filter((c) => c.matchIds.includes(vars.matchId));
      if (mine.length) {
        toast.warning(`Moved — ${mine.length} conflict${mine.length > 1 ? 's' : ''}: ${mine.map((c) => conflictLabel(c.kind)).join(', ')}`);
      } else {
        toast.success(vars.target.startAt ? 'Match moved' : 'Match unscheduled');
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addTimeRow() {
    if (!activeDay || activeDay === UNSCHEDULED || !newTime) return;
    const iso = fromZonedTime(`${activeDay}T${newTime}`, tz).toISOString();
    setExtraTimes((prev) => ({
      ...prev,
      [activeDay]: [...new Set([...(prev[activeDay] ?? []), iso])],
    }));
    setNewTime('');
  }

  if (isLoading) {
    return <div className="gaming-card rounded-xl p-6 text-sm text-[var(--color-muted)]">Loading schedule…</div>;
  }
  if (error || !data) {
    return (
      <div className="gaming-card rounded-xl p-6 text-sm text-[var(--color-danger)]">
        {error instanceof Error ? error.message : 'Could not load schedule'}
      </div>
    );
  }

  const nothingScheduled = days.length === 0;
  const generateHref = `${basePath ?? `/t/${tournament.slug}`}?tab=schedule&sub=generate`;

  if (nothingScheduled && allMatches.length === 0) {
    return (
      <EmptyState manage={manage} generateHref={generateHref} text="No matches yet — generate the bracket first." />
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="gaming-card flex flex-wrap items-center gap-2 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-1">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => setDay(d.date)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm',
                activeDay === d.date ? 'choice-btn-active' : 'choice-btn',
              )}
            >
              {fmtDayKey(d.date)}
              <span className="ml-1 text-[10px] text-[var(--color-muted)]">{d.matches.length}</span>
            </button>
          ))}
          {(data.unscheduled.length > 0 || manage) && (
            <button
              type="button"
              onClick={() => setDay(UNSCHEDULED)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm',
                activeDay === UNSCHEDULED ? 'choice-btn-active' : 'choice-btn',
              )}
            >
              Unscheduled
              <span className="ml-1 text-[10px] text-[var(--color-muted)]">{data.unscheduled.length}</span>
            </button>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--color-line)] p-0.5">
            <button
              type="button"
              onClick={() => setView('list')}
              className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs', view === 'list' ? 'bg-[var(--color-surface-hover)] text-[var(--color-ink)]' : 'text-[var(--color-muted)]')}
            >
              <List className="size-3.5" /> List
            </button>
            <button
              type="button"
              onClick={() => setView('timeline')}
              className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs', view === 'timeline' ? 'bg-[var(--color-surface-hover)] text-[var(--color-ink)]' : 'text-[var(--color-muted)]')}
            >
              <LayoutGrid className="size-3.5" /> Timeline
            </button>
          </div>
          <select className="field-select" style={{ width: "auto" }} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">All teams</option>
            {teamOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select className="field-select" style={{ width: "auto" }} value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {data.stations.length > 0 && (
            <select className="field-select" style={{ width: "auto" }} value={stationId} onChange={(e) => setStationId(e.target.value)}>
              <option value="">All stations</option>
              {data.stations.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <a
            href={icsUrl(tournament.slug)}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--color-accent)]/50"
          >
            <CalendarDays className="size-3.5" /> Export .ics
          </a>
          <span className="text-xs text-[var(--color-muted)]">Times in {tz}</span>
        </div>
      </div>

      {/* Conflict banner */}
      {manage && conflicts.length > 0 && (
        <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 font-semibold text-[var(--color-danger)]">
              <AlertTriangle className="size-4" />
              {conflicts.length} scheduling conflict{conflicts.length > 1 ? 's' : ''}
            </span>
            <button type="button" className="text-xs underline" onClick={() => setShowConflicts((v) => !v)}>
              {showConflicts ? 'Hide list' : 'Show list'}
            </button>
          </div>
          {showConflicts && (
            <ul className="mt-2 space-y-1 text-xs">
              {conflicts.map((c, i) => {
                const names = c.matchIds
                  .map((id) => allMatches.find((m) => m.id === id))
                  .filter((m): m is ScheduleMatchDto => !!m)
                  .map((m) => `${teamName(m.homeTeam)} vs ${teamName(m.awayTeam)} (${fmtTime(m.scheduledAt, tz, 'EEE HH:mm')})`);
                return (
                  <li key={i} className="flex flex-wrap items-center gap-1">
                    <span className="badge badge-danger">{conflictLabel(c.kind)}</span>
                    <span>{names.join(' ↔ ')}</span>
                    <span className="text-[var(--color-muted)]">— {c.message}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Body */}
      {nothingScheduled && activeDay !== UNSCHEDULED ? (
        <EmptyState manage={manage} generateHref={generateHref} />
      ) : activeDay === UNSCHEDULED ? (
        <div className="gaming-card rounded-xl p-4">
          <p className="mb-3 text-sm text-[var(--color-muted)]">
            {unscheduled.length} match{unscheduled.length === 1 ? '' : 'es'} without a time.
            {manage && ' Click one to set a time, or open a day tab and drag it into a slot.'}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {unscheduled.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                tz={tz}
                showTime={false}
                showReferee={manage}
                conflicts={conflicts}
                onClick={manage ? () => setEditing(m) : undefined}
              />
            ))}
          </div>
        </div>
      ) : view === 'timeline' ? (
        <div className="gaming-card rounded-xl p-3">
          {manage && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
              <span>Drag cards between slots and stations. Click a card to edit details.</span>
              <div className="ml-auto flex items-center gap-1">
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-32 py-1"
                />
                <Button variant="secondary" type="button" onClick={addTimeRow} disabled={!newTime} className="py-1">
                  <Plus className="mr-1 size-3.5" /> Add slot row
                </Button>
              </div>
            </div>
          )}
          <TimelineGrid
            matches={dayMatches}
            stations={data.stations}
            tz={tz}
            editable={manage}
            conflicts={conflicts}
            showReferee={manage}
            extraTimes={activeDay ? extraTimes[activeDay] ?? [] : []}
            unscheduled={manage ? unscheduled : []}
            onCardClick={manage ? (m) => setEditing(m) : undefined}
            onDrop={manage ? (matchId, target) => moveMatch.mutate({ matchId, target }) : undefined}
          />
        </div>
      ) : (
        <ListTable
          matches={dayMatches}
          tz={tz}
          manage={manage}
          conflicts={conflicts}
          onEdit={manage ? (m) => setEditing(m) : undefined}
        />
      )}

      {manage && (
        <MatchSlotDialog
          match={editing}
          tournamentId={tournament.id}
          slug={tournament.slug}
          token={token!}
          tz={tz}
          stations={data.stations}
          referees={referees}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ manage, generateHref, text }: { manage: boolean; generateHref: string; text?: string }) {
  return (
    <div className="gaming-card flex flex-col items-center gap-3 rounded-xl p-10 text-center">
      <CalendarDays className="size-8 text-[var(--color-muted)]" />
      <p className="text-sm text-[var(--color-muted)]">
        {text ?? (manage ? 'No match times yet.' : 'Schedule not published yet.')}
      </p>
      {manage && !text && (
        <Link href={generateHref}>
          <Button>Generate schedule</Button>
        </Link>
      )}
    </div>
  );
}

export function ListTable({
  matches,
  tz,
  manage,
  conflicts,
  onEdit,
  showDate = false,
}: {
  matches: ScheduleMatchDto[];
  tz: string;
  manage: boolean;
  conflicts: ScheduleConflictDto[];
  onEdit?: (m: ScheduleMatchDto) => void;
  showDate?: boolean;
}) {
  if (!matches.length) {
    return <div className="gaming-card rounded-xl p-6 text-sm text-[var(--color-muted)]">No matches match the filters.</div>;
  }
  return (
    <div className="gaming-card overflow-x-auto rounded-xl">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
          <tr className="border-b border-[var(--color-line)]">
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Station</th>
            <th className="px-3 py-2">Round</th>
            <th className="px-3 py-2">Match</th>
            <th className="px-3 py-2">Status</th>
            {manage && <th className="px-3 py-2">Referee</th>}
            {onEdit && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => {
            const mine = conflicts.filter((c) => c.matchIds.includes(m.id));
            const score = scoreLine(m);
            return (
              <tr key={m.id} className="border-b border-[var(--color-line)]/60 last:border-0 hover:bg-[var(--color-surface)]/50">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                  {fmtTime(m.scheduledAt, tz, showDate ? 'EEE d MMM HH:mm' : 'HH:mm')}
                  {m.endAt && <span className="text-[var(--color-muted)]">–{fmtTime(m.endAt, tz)}</span>}
                </td>
                <td className="px-3 py-2">{m.station?.name ?? m.stationLabel ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                <td className="px-3 py-2 text-xs text-[var(--color-muted)]">{roundLabel(m)}</td>
                <td className="px-3 py-2">
                  <span className={cn(!m.homeTeam && 'italic text-[var(--color-muted)]')}>{teamName(m.homeTeam)}</span>
                  <span className="mx-1 text-[var(--color-muted)]">vs</span>
                  <span className={cn(!m.awayTeam && 'italic text-[var(--color-muted)]')}>{teamName(m.awayTeam)}</span>
                  {mine.length > 0 && (
                    <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-[var(--color-danger)]/15 px-1.5 text-[10px] font-bold text-[var(--color-danger)]" title={mine.map((c) => c.message).join('\n')}>
                      <AlertTriangle className="size-3" /> {mine.length}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={statusBadge(m.status)}>{score ?? m.status}</span>
                </td>
                {manage && <td className="px-3 py-2 text-xs">{m.referee?.name ?? <span className="text-[var(--color-muted)]">—</span>}</td>}
                {onEdit && (
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" type="button" className="px-2 py-1 text-xs" onClick={() => onEdit(m)}>
                      Edit
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
