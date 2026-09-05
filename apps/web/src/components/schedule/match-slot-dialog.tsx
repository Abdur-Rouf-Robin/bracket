'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { fromZonedTime } from 'date-fns-tz';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  MatchSlotInput,
  RefereeDto,
  ScheduleConflictDto,
  ScheduleMatchDto,
  ScheduleStationDto,
} from '@bracket/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from './icons';
import { conflictLabel, roundLabel, safeTz, teamName, toDatetimeLocal } from './schedule-shared';

export function MatchSlotDialog({
  match,
  tournamentId,
  slug,
  token,
  tz,
  stations,
  referees,
  onClose,
}: {
  match: ScheduleMatchDto | null;
  tournamentId: string;
  slug: string;
  token: string;
  tz: string;
  stations: ScheduleStationDto[];
  referees: RefereeDto[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState('');
  const [stationId, setStationId] = useState('');
  const [refereeId, setRefereeId] = useState('');
  const [resultConflicts, setResultConflicts] = useState<ScheduleConflictDto[]>([]);

  useEffect(() => {
    if (!match) return;
    setWhen(toDatetimeLocal(match.scheduledAt, tz));
    setDuration(match.durationMinutes ? String(match.durationMinutes) : '');
    setStationId(match.stationId ?? '');
    setRefereeId(match.refereeId ?? '');
    setResultConflicts([]);
  }, [match, tz]);

  const save = useMutation({
    mutationFn: (body: MatchSlotInput) =>
      api<{ match: ScheduleMatchDto; conflicts: ScheduleConflictDto[] }>(
        `/tournaments/${tournamentId}/matches/${match!.id}/slot`,
        { method: 'PATCH', token, body: JSON.stringify(body) },
      ),
    onSuccess: async (res, body) => {
      await qc.invalidateQueries({ queryKey: ['tournament', slug] });
      const mine = res.conflicts.filter((c) => c.matchIds.includes(match!.id));
      if (body.scheduledAt === null) {
        toast.success('Match unscheduled');
        onClose();
        return;
      }
      if (mine.length) {
        setResultConflicts(mine);
        toast.warning(`Saved with ${mine.length} conflict${mine.length > 1 ? 's' : ''}`);
      } else {
        toast.success('Match time saved');
        onClose();
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    if (!match) return;
    let scheduledAt: string | null = null;
    if (when) {
      const d = fromZonedTime(when, safeTz(tz));
      if (Number.isNaN(d.getTime())) {
        toast.error('Invalid date/time');
        return;
      }
      scheduledAt = d.toISOString();
    }
    save.mutate({
      scheduledAt,
      durationMinutes: duration ? Number(duration) : null,
      stationId: stationId || null,
      refereeId: refereeId || null,
    });
  }

  return (
    <Dialog.Root open={!!match} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="panel-card fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 shadow-2xl focus:outline-none">
          {match && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Dialog.Title className="font-display text-lg font-bold">
                    {teamName(match.homeTeam)} vs {teamName(match.awayTeam)}
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-[var(--color-muted)]">
                    {roundLabel(match)} · {match.status} · times in {tz}
                  </Dialog.Description>
                </div>
                <Dialog.Close className="rounded-md p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)]">
                  <X className="size-4" />
                </Dialog.Close>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="slot-when">Date & time</Label>
                  <Input
                    id="slot-when"
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="slot-duration">Duration (min)</Label>
                    <Input
                      id="slot-duration"
                      type="number"
                      min={1}
                      value={duration}
                      placeholder="e.g. 30"
                      onChange={(e) => setDuration(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="slot-station">Station</Label>
                    <select
                      id="slot-station"
                      className="field-select"
                      value={stationId}
                      onChange={(e) => setStationId(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.status === 'CLOSED' ? ' (closed)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="slot-ref">Referee</Label>
                  <select
                    id="slot-ref"
                    className="field-select"
                    value={refereeId}
                    onChange={(e) => setRefereeId(e.target.value)}
                  >
                    <option value="">None</option>
                    {referees.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {resultConflicts.length > 0 && (
                  <ul className="space-y-1 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-2 text-xs">
                    {resultConflicts.map((c, i) => (
                      <li key={i}>
                        <span className="font-semibold">{conflictLabel(c.kind)}</span> — {c.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  disabled={save.isPending || (!match.scheduledAt && !match.stationId)}
                  onClick={() =>
                    save.mutate({ scheduledAt: null, stationId: null, refereeId: null, durationMinutes: null })
                  }
                >
                  Clear slot
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" type="button" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={submit} disabled={save.isPending}>
                    {save.isPending ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
