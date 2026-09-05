'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as Switch from '@radix-ui/react-switch';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AutoScheduleResponse,
  ScheduleConfigInput,
  ScheduleConfigResponse,
  ScheduleDay,
} from '@bracket/shared';
import { SCHEDULE_TIMEZONES } from '@bracket/shared';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertTriangle, Plus, Trash2 } from './icons';
import {
  conflictLabel,
  dayKeyOf,
  fmtDateTime,
  fmtDayKey,
  safeTz,
  scheduleKeys,
  teamName,
} from './schedule-shared';
import { TimelineGrid } from './timeline-grid';

type FormState = {
  days: ScheduleDay[];
  slotMinutes: string;
  breakMinutes: string;
  restMinutes: string;
  maxMatchesPerTeamPerDay: string;
  timezone: string;
  respectRounds: boolean;
  useReferees: boolean;
  stationIds: string[];
};

function fromConfig(cfg: ScheduleConfigInput, fallbackTz: string): FormState {
  return {
    days: cfg.days,
    slotMinutes: String(cfg.slotMinutes),
    breakMinutes: String(cfg.breakMinutes ?? 0),
    restMinutes: cfg.restMinutes != null ? String(cfg.restMinutes) : '',
    maxMatchesPerTeamPerDay: cfg.maxMatchesPerTeamPerDay != null ? String(cfg.maxMatchesPerTeamPerDay) : '',
    timezone: cfg.timezone || fallbackTz,
    respectRounds: cfg.respectRounds ?? true,
    useReferees: cfg.useReferees ?? true,
    stationIds: cfg.stationIds ?? [],
  };
}

function toConfig(f: FormState): ScheduleConfigInput {
  return {
    days: f.days,
    slotMinutes: Math.max(5, Number(f.slotMinutes) || 30),
    breakMinutes: Math.max(0, Number(f.breakMinutes) || 0),
    restMinutes: f.restMinutes === '' ? null : Math.max(0, Number(f.restMinutes) || 0),
    maxMatchesPerTeamPerDay:
      f.maxMatchesPerTeamPerDay === '' ? null : Math.max(1, Number(f.maxMatchesPerTeamPerDay) || 1),
    timezone: f.timezone,
    respectRounds: f.respectRounds,
    stageOrder: 'groups-first',
    useReferees: f.useReferees,
    stationIds: f.stationIds,
  };
}

export function GeneratePanel({
  tournament,
  token,
  basePath,
}: {
  tournament: Tournament;
  token: string;
  basePath: string;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: scheduleKeys.config(tournament.slug),
    queryFn: () => api<ScheduleConfigResponse>(`/tournaments/${tournament.id}/schedule-config`, { token }),
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [keepLocked, setKeepLocked] = useState(true);
  const [preview, setPreview] = useState<AutoScheduleResponse | null>(null);
  const [previewDay, setPreviewDay] = useState<string | null>(null);

  useEffect(() => {
    if (data && !form) setForm(fromConfig(data.config, tournament.timezone ?? 'UTC'));
  }, [data, form, tournament.timezone]);

  const tzOptions = useMemo(() => {
    const set = new Set<string>(SCHEDULE_TIMEZONES);
    if (tournament.timezone) set.add(tournament.timezone);
    if (form?.timezone) set.add(form.timezone);
    return [...set];
  }, [tournament.timezone, form?.timezone]);

  const saveConfig = useMutation({
    mutationFn: (cfg: ScheduleConfigInput) =>
      api<ScheduleConfigResponse>(`/tournaments/${tournament.id}/schedule-config`, {
        method: 'PUT',
        token,
        body: JSON.stringify(cfg),
      }),
    onSuccess: (res) => qc.setQueryData(scheduleKeys.config(tournament.slug), res),
  });

  const generate = useMutation({
    mutationFn: async ({ dryRun }: { dryRun: boolean }) => {
      const cfg = toConfig(form!);
      await saveConfig.mutateAsync(cfg);
      return api<AutoScheduleResponse>(`/tournaments/${tournament.id}/schedule/generate`, {
        method: 'POST',
        token,
        body: JSON.stringify({ dryRun, clearExisting, keepLocked, config: cfg }),
      });
    },
    onSuccess: async (res, vars) => {
      setPreview(res);
      setPreviewDay(res.summary.days[0] ?? null);
      if (vars.dryRun) {
        toast.success(`Preview: ${res.summary.scheduled}/${res.summary.total} matches placed`);
      } else {
        toast.success(`Schedule applied — ${res.summary.scheduled}/${res.summary.total} matches`);
        await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearAll = useMutation({
    mutationFn: () => api<{ cleared: number }>(`/tournaments/${tournament.id}/schedule/clear`, { method: 'POST', token }),
    onSuccess: async (res) => {
      toast.success(`Cleared ${res.cleared} match times`);
      setPreview(null);
      await qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form || !data) {
    return <div className="gaming-card rounded-xl p-6 text-sm text-[var(--color-muted)]">Loading scheduler…</div>;
  }

  const openStations = data.stations.filter((s) => s.status !== 'CLOSED');
  const tz = safeTz(form.timezone);
  const canRun = form.days.length > 0 && openStations.length > 0;
  const upd = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const setDay = (i: number, patch: Partial<ScheduleDay>) =>
    upd({ days: form.days.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });

  const previewMatches = preview
    ? preview.matches.filter((m) => m.scheduledAt && previewDay && dayKeyOf(m.scheduledAt, tz) === previewDay)
    : [];
  const matchName = (id: string) => {
    const m = preview?.matches.find((x) => x.id === id);
    return m ? `${teamName(m.homeTeam)} vs ${teamName(m.awayTeam)}` : id;
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {/* Form */}
      <div className="space-y-4">
        <section className="gaming-card rounded-xl p-4">
          <h3 className="font-display text-lg font-bold">Automatic scheduling</h3>
          <p className="text-xs text-[var(--color-muted)]">
            Places every unplayed match into the earliest free slot and station, honoring rest time, daily limits,
            bracket dependencies and referee availability. Group matches are scheduled before knockout rounds.
          </p>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <Label className="mb-0">Days</Label>
              <Button
                variant="secondary"
                type="button"
                className="px-2 py-1 text-xs"
                onClick={() => {
                  const last = form.days[form.days.length - 1];
                  const next = last
                    ? new Date(Date.parse(`${last.date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
                    : (tournament.startAt ?? new Date().toISOString()).slice(0, 10);
                  upd({ days: [...form.days, { date: next, startTime: last?.startTime ?? '09:00', endTime: last?.endTime ?? '18:00' }] });
                }}
              >
                <Plus className="mr-1 size-3.5" /> Add day
              </Button>
            </div>
            {form.days.length === 0 && (
              <p className="mt-2 text-xs text-[var(--color-warning)]">Add at least one day.</p>
            )}
            <div className="mt-2 space-y-2">
              {form.days.map((d, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input type="date" value={d.date} onChange={(e) => setDay(i, { date: e.target.value })} className="w-40 py-1" />
                  <Input type="time" value={d.startTime} onChange={(e) => setDay(i, { startTime: e.target.value })} className="w-28 py-1" />
                  <span className="text-xs text-[var(--color-muted)]">→</span>
                  <Input type="time" value={d.endTime} onChange={(e) => setDay(i, { endTime: e.target.value })} className="w-28 py-1" />
                  <span className="text-xs text-[var(--color-muted)]">{d.date && fmtDayKey(d.date)}</span>
                  <button
                    type="button"
                    onClick={() => upd({ days: form.days.filter((_, idx) => idx !== i) })}
                    className="ml-auto rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="slotMinutes">Match slot (min)</Label>
              <Input id="slotMinutes" type="number" min={5} value={form.slotMinutes} onChange={(e) => upd({ slotMinutes: e.target.value })} />
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">Match duration incl. changeover.</p>
            </div>
            <div>
              <Label htmlFor="breakMinutes">Break between slots (min)</Label>
              <Input id="breakMinutes" type="number" min={0} value={form.breakMinutes} onChange={(e) => upd({ breakMinutes: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="restMinutes">Min rest per team (min)</Label>
              <Input id="restMinutes" type="number" min={0} placeholder={`= slot (${form.slotMinutes || 30})`} value={form.restMinutes} onChange={(e) => upd({ restMinutes: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="maxPerDay">Max matches per team per day</Label>
              <Input id="maxPerDay" type="number" min={1} placeholder="No limit" value={form.maxMatchesPerTeamPerDay} onChange={(e) => upd({ maxMatchesPerTeamPerDay: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="tz">Timezone</Label>
              <select id="tz" className="field-select" value={form.timezone} onChange={(e) => upd({ timezone: e.target.value })}>
                {tzOptions.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <ToggleRow
              label="Respect rounds"
              hint="Finish every match of a round before the next round of the same stage starts. Off = only wait for the two feeder matches."
              checked={form.respectRounds}
              onChange={(v) => upd({ respectRounds: v })}
            />
            <ToggleRow
              label="Assign referees"
              hint={`${data.referees.length} referee${data.referees.length === 1 ? '' : 's'} configured — assigned round-robin within availability.`}
              checked={form.useReferees}
              onChange={(v) => upd({ useReferees: v })}
            />
          </div>
        </section>

        <section className="gaming-card rounded-xl p-4">
          <div className="flex items-center justify-between">
            <Label className="mb-0">Stations to use</Label>
            <Link href={`${basePath}?tab=schedule&sub=stations`} className="text-xs text-[var(--color-accent)] hover:underline">
              Manage stations
            </Link>
          </div>
          {openStations.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--color-warning)]">No open stations — add at least one.</p>
          ) : (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {openStations.map((s) => {
                const all = form.stationIds.length === 0;
                const checked = all || form.stationIds.includes(s.id);
                return (
                  <label key={s.id} className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm', checked ? 'choice-btn-active' : 'choice-btn')}>
                    <input
                      type="checkbox"
                      className="accent-[var(--color-accent)]"
                      checked={checked}
                      onChange={(e) => {
                        const base = all ? openStations.map((x) => x.id) : form.stationIds;
                        const next = e.target.checked ? [...new Set([...base, s.id])] : base.filter((id) => id !== s.id);
                        upd({ stationIds: next.length === openStations.length ? [] : next });
                      }}
                    />
                    {s.name}
                  </label>
                );
              })}
            </div>
          )}
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">Closed stations are never used.</p>
        </section>

        <section className="gaming-card space-y-3 rounded-xl p-4">
          <ToggleRow
            label="Clear existing times first"
            hint="Wipe all current match times/stations before generating."
            checked={clearExisting}
            onChange={setClearExisting}
          />
          <ToggleRow
            label="Keep manually scheduled matches"
            hint="Matches that already have a time stay where they are; others are placed around them."
            checked={keepLocked && !clearExisting}
            disabled={clearExisting}
            onChange={setKeepLocked}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" type="button" disabled={!canRun || generate.isPending} onClick={() => generate.mutate({ dryRun: true })}>
              {generate.isPending && generate.variables?.dryRun ? 'Previewing…' : 'Preview'}
            </Button>
            <Button type="button" disabled={!canRun || generate.isPending} onClick={() => generate.mutate({ dryRun: false })}>
              {generate.isPending && generate.variables?.dryRun === false ? 'Applying…' : 'Apply schedule'}
            </Button>
            <Button
              variant="ghost"
              type="button"
              className="ml-auto text-[var(--color-danger)]"
              disabled={clearAll.isPending}
              onClick={() => {
                if (confirm('Clear all match times, stations and referees for unplayed matches?')) clearAll.mutate();
              }}
            >
              Clear schedule
            </Button>
          </div>
        </section>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        {!preview ? (
          <div className="gaming-card flex h-full min-h-48 items-center justify-center rounded-xl p-6 text-center text-sm text-[var(--color-muted)]">
            Run <b className="mx-1">Preview</b> to see the proposed timetable, conflicts and anything that could not be placed.
          </div>
        ) : (
          <>
            <section className="gaming-card rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold">{preview.dryRun ? 'Preview' : 'Applied'}</h3>
                <span className={cn('badge', preview.summary.scheduled === preview.summary.total ? 'badge-ok' : 'badge-warning')}>
                  {preview.summary.scheduled}/{preview.summary.total} placed
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Stat label="First match" value={fmtDateTime(preview.summary.firstStart, tz)} />
                <Stat label="Last match ends" value={fmtDateTime(preview.summary.lastEnd, tz)} />
                <Stat label="Days" value={String(preview.summary.days.length)} />
                <Stat label="Conflicts" value={String(preview.conflicts.length)} warn={preview.conflicts.length > 0} />
              </dl>

              {preview.unscheduled.length > 0 && (
                <div className="mt-3 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-3 text-xs">
                  <p className="mb-1 flex items-center gap-1 font-semibold text-[var(--color-warning)]">
                    <AlertTriangle className="size-3.5" /> {preview.unscheduled.length} match{preview.unscheduled.length > 1 ? 'es' : ''} could not be placed
                  </p>
                  <ul className="space-y-0.5">
                    {preview.unscheduled.slice(0, 12).map((u) => (
                      <li key={u.matchId}>
                        <span className="font-medium">{matchName(u.matchId)}</span>
                        <span className="text-[var(--color-muted)]"> — {u.reason}</span>
                      </li>
                    ))}
                    {preview.unscheduled.length > 12 && (
                      <li className="text-[var(--color-muted)]">…and {preview.unscheduled.length - 12} more. Add days, stations or relax limits.</li>
                    )}
                  </ul>
                </div>
              )}

              {preview.conflicts.length > 0 && (
                <div className="mt-3 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs">
                  <p className="mb-1 font-semibold text-[var(--color-danger)]">Conflicts (usually from kept manual times)</p>
                  <ul className="space-y-0.5">
                    {preview.conflicts.slice(0, 12).map((c, i) => (
                      <li key={i}>
                        <span className="badge badge-danger mr-1">{conflictLabel(c.kind)}</span>
                        {c.matchIds.map(matchName).join(' ↔ ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {preview.summary.days.length > 0 && (
              <section className="gaming-card rounded-xl p-3">
                <div className="mb-2 flex flex-wrap items-center gap-1">
                  {preview.summary.days.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPreviewDay(d)}
                      className={cn('rounded-lg px-3 py-1 text-xs', previewDay === d ? 'choice-btn-active' : 'choice-btn')}
                    >
                      {fmtDayKey(d)}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] text-[var(--color-muted)]">Times in {tz}</span>
                </div>
                <TimelineGrid
                  matches={previewMatches}
                  stations={data.stations.filter((s) => preview.assignments.some((a) => a.stationId === s.id))}
                  tz={tz}
                  editable={false}
                  conflicts={preview.conflicts}
                  showReferee
                  compact
                />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface)] px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
      <dd className={cn('text-sm font-semibold', warn && 'text-[var(--color-danger)]')}>{value}</dd>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex items-start justify-between gap-3', disabled && 'opacity-50')}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-[11px] text-[var(--color-muted)]">{hint}</span>}
      </span>
      <Switch.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] transition data-[state=checked]:border-[var(--color-accent)] data-[state=checked]:bg-[var(--color-accent)]"
      >
        <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[18px]" />
      </Switch.Root>
    </label>
  );
}
