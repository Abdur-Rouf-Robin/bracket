'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ScheduleMatchDto, ScheduleStationDto, StationStatusValue } from '@bracket/shared';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Plus, Trash2 } from './icons';
import { safeTz, scheduleKeys, teamName, fmtTime } from './schedule-shared';

type StationRow = ScheduleStationDto & {
  currentMatchId?: string | null;
  currentMatch?: ScheduleMatchDto | null;
};

const STATUS_BADGE: Record<StationStatusValue, string> = {
  OPEN: 'badge badge-ok',
  IN_USE: 'badge badge-accent',
  CLOSED: 'badge badge-neutral',
};

export function StationsPanel({
  tournament,
  token,
  mode,
}: {
  tournament: Tournament;
  token?: string;
  mode: 'public' | 'manage';
}) {
  const qc = useQueryClient();
  const manage = mode === 'manage' && !!token;
  const tz = safeTz(tournament.timezone);
  const path = manage ? `/tournaments/${tournament.id}/stations` : `/t/${tournament.slug}/stations`;
  const { data: stations = [], isLoading } = useQuery({
    queryKey: scheduleKeys.stations(tournament.slug, manage ? 'manage' : 'public'),
    queryFn: () => api<StationRow[]>(path, { token }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });

  const create = useMutation({
    mutationFn: (body: { name: string; privateDetails?: string | null }) =>
      api(`/tournaments/${tournament.id}/stations`, { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; privateDetails?: string | null; status?: StationStatusValue }) =>
      api(`/tournaments/${tournament.id}/stations/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/tournaments/${tournament.id}/stations/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Station removed');
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) =>
      api(`/tournaments/${tournament.id}/stations/reorder`, { method: 'PUT', token, body: JSON.stringify({ ids }) }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [quickPrefix, setQuickPrefix] = useState('Court');
  const [quickCount, setQuickCount] = useState(4);

  async function quickAdd() {
    const existing = new Set(stations.map((s) => s.name.toLowerCase()));
    let added = 0;
    for (let i = 1; i <= quickCount; i++) {
      const n = `${quickPrefix.trim() || 'Station'} ${i}`;
      if (existing.has(n.toLowerCase())) continue;
      await create.mutateAsync({ name: n });
      added++;
    }
    toast.success(added ? `Added ${added} station${added > 1 ? 's' : ''}` : 'Nothing to add');
  }

  function move(idx: number, dir: -1 | 1) {
    const ids = stations.map((s) => s.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorder.mutate(ids);
  }

  if (isLoading) {
    return <div className="gaming-card rounded-xl p-6 text-sm text-[var(--color-muted)]">Loading stations…</div>;
  }

  if (!manage) {
    return (
      <div className="space-y-3">
        {stations.length === 0 && (
          <div className="gaming-card rounded-xl p-6 text-sm text-[var(--color-muted)]">No stations published.</div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stations.map((s) => (
            <div key={s.id} className="gaming-card rounded-xl p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold">{s.name}</h3>
                <span className={STATUS_BADGE[s.status]}>{s.status.replace('_', ' ')}</span>
              </div>
              {s.currentMatch ? (
                <p className="mt-2 text-sm">
                  <span className="text-[var(--color-muted)]">Now: </span>
                  {teamName(s.currentMatch.homeTeam)} vs {teamName(s.currentMatch.awayTeam)}
                  {s.currentMatch.scheduledAt && (
                    <span className="ml-1 font-mono text-xs text-[var(--color-muted)]">{fmtTime(s.currentMatch.scheduledAt, tz)}</span>
                  )}
                </p>
              ) : (
                <p className="mt-2 text-sm text-[var(--color-muted)]">No match in progress</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="gaming-card rounded-xl p-4">
        <h3 className="font-display text-lg font-bold">Stations</h3>
        <p className="text-xs text-[var(--color-muted)]">
          Courts, tables, fields or PCs where matches are played. Private details (e.g. lobby passwords, setup notes)
          are only visible to managers.
        </p>

        {stations.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-muted)]">No stations yet — add one below.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                <tr className="border-b border-[var(--color-line)]">
                  <th className="w-16 px-2 py-2">Order</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Private details</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Now playing</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {stations.map((s, idx) => (
                  <StationEditRow
                    key={s.id}
                    station={s}
                    tz={tz}
                    onMove={(dir) => move(idx, dir)}
                    canUp={idx > 0}
                    canDown={idx < stations.length - 1}
                    onSave={(body) => update.mutate({ id: s.id, ...body })}
                    onDelete={() => {
                      if (confirm(`Delete "${s.name}"? Matches assigned to it will be unassigned.`)) remove.mutate(s.id);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form
          className="panel-card space-y-3 rounded-xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            create.mutate(
              { name: name.trim(), privateDetails: details.trim() || null },
              {
                onSuccess: () => {
                  setName('');
                  setDetails('');
                  toast.success('Station added');
                },
              },
            );
          }}
        >
          <h4 className="font-semibold">Add station</h4>
          <Input placeholder="Name (e.g. Court 1, Table A, PC 3)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Private details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            <Plus className="mr-1 size-4" /> Add
          </Button>
        </form>

        <div className="panel-card space-y-3 rounded-xl p-4">
          <h4 className="font-semibold">Quick add</h4>
          <p className="text-xs text-[var(--color-muted)]">Create a numbered set in one go.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-32" value={quickPrefix} onChange={(e) => setQuickPrefix(e.target.value)} />
            <span className="text-sm text-[var(--color-muted)]">1 …</span>
            <Input
              className="w-20"
              type="number"
              min={1}
              max={64}
              value={quickCount}
              onChange={(e) => setQuickCount(Math.max(1, Math.min(64, Number(e.target.value) || 1)))}
            />
            <Button variant="secondary" type="button" onClick={quickAdd} disabled={create.isPending}>
              Add {quickCount} station{quickCount > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StationEditRow({
  station,
  tz,
  onSave,
  onDelete,
  onMove,
  canUp,
  canDown,
}: {
  station: StationRow;
  tz: string;
  onSave: (body: { name?: string; privateDetails?: string | null; status?: StationStatusValue }) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  canUp: boolean;
  canDown: boolean;
}) {
  const [name, setName] = useState(station.name);
  const [details, setDetails] = useState(station.privateDetails ?? '');
  const dirty = name.trim() !== station.name || (details.trim() || null) !== (station.privateDetails ?? null);

  return (
    <tr className="border-b border-[var(--color-line)]/60 last:border-0">
      <td className="px-2 py-2">
        <div className="flex items-center gap-0.5">
          <button type="button" disabled={!canUp} onClick={() => onMove(-1)} className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)] disabled:opacity-30">
            <ArrowUp className="size-3.5" />
          </button>
          <button type="button" disabled={!canDown} onClick={() => onMove(1)} className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)] disabled:opacity-30">
            <ArrowDown className="size-3.5" />
          </button>
        </div>
      </td>
      <td className="px-2 py-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="min-w-32 py-1" />
      </td>
      <td className="px-2 py-2">
        <Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="—" className="min-w-40 py-1" />
      </td>
      <td className="px-2 py-2">
        <select
          className={cn('field-select', station.status === 'CLOSED' && 'opacity-70')}
          style={{ width: 'auto' }}
          value={station.status}
          onChange={(e) => onSave({ status: e.target.value as StationStatusValue })}
        >
          <option value="OPEN">Open</option>
          <option value="IN_USE">In use</option>
          <option value="CLOSED">Closed</option>
        </select>
      </td>
      <td className="px-2 py-2 text-xs">
        {station.currentMatch ? (
          <>
            {teamName(station.currentMatch.homeTeam)} vs {teamName(station.currentMatch.awayTeam)}
            {station.currentMatch.scheduledAt && (
              <span className="ml-1 font-mono text-[var(--color-muted)]">{fmtTime(station.currentMatch.scheduledAt, tz)}</span>
            )}
          </>
        ) : (
          <span className="text-[var(--color-muted)]">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {dirty && (
            <Button type="button" className="px-2 py-1 text-xs" onClick={() => onSave({ name: name.trim(), privateDetails: details.trim() || null })}>
              Save
            </Button>
          )}
          <button type="button" onClick={onDelete} className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-danger)]" title="Delete">
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
