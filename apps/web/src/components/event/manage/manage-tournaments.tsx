'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, Link2, Plus, Settings2, Unlink, Users } from 'lucide-react';
import { FORMAT_META, SINGLE_STAGE_OPTIONS, type TournamentFormat } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';
import type { EventDetail, EventTournamentSummary } from '../event-types';
import { fmtInTz, isoToLocalInput, localInputToIso } from '../event-utils';
import { TournamentStatusChip } from '../status-badge';

type Game = { id: string; name: string; category: string };

export function ManageTournaments({ event }: { event: EventDetail }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [attachId, setAttachId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [gameId, setGameId] = useState('');
  const [format, setFormat] = useState('SINGLE_ELIMINATION');
  const [startLocal, setStartLocal] = useState(() => isoToLocalInput(event.startAt, event.timezone));

  const { data: attached = [], isLoading } = useQuery({
    queryKey: ['event-tournaments', event.id],
    enabled: !!token,
    queryFn: () => api<EventTournamentSummary[]>(`/events/${event.id}/tournaments`, { token }),
  });

  const { data: mine = [] } = useQuery({
    queryKey: ['tournaments-mine'],
    enabled: !!token,
    queryFn: () => api<Tournament[]>('/tournaments/mine', { token }),
  });

  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => api<Game[]>('/games'),
  });

  const attachable = useMemo(() => {
    const attachedIds = new Set(attached.map((t) => t.id));
    return mine.filter((t) => !attachedIds.has(t.id) && (!t.eventId || t.eventId === event.id));
  }, [mine, attached, event.id]);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['event-tournaments', event.id] });
    void qc.invalidateQueries({ queryKey: ['event', event.slug] });
    void qc.invalidateQueries({ queryKey: ['event-dashboard', event.id] });
    void qc.invalidateQueries({ queryKey: ['tournaments-mine'] });
  }

  const attach = useMutation({
    mutationFn: (tournamentId: string) =>
      api(`/events/${event.id}/tournaments/${tournamentId}`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success('Tournament attached');
      setAttachId('');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const detach = useMutation({
    mutationFn: (tournamentId: string) =>
      api(`/events/${event.id}/tournaments/${tournamentId}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Tournament detached');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: () =>
      api<EventTournamentSummary>(`/events/${event.id}/tournaments`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: name.trim(),
          gameId: gameId || null,
          format,
          startAt: localInputToIso(startLocal, event.timezone),
        }),
      }),
    onSuccess: (t) => {
      toast.success(`"${t.name}" created — configure it in its manage page`);
      setName('');
      setShowCreate(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold text-[var(--color-ink)]">
            <Link2 className="size-4 text-[var(--color-accent)]" /> Attach an existing tournament
          </h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Tournaments you manage that aren&apos;t part of another event.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Select
              value={attachId}
              onChange={setAttachId}
              placeholder={attachable.length ? 'Choose a tournament…' : 'No tournaments available'}
              className="flex-1"
              options={attachable.map((t) => ({
                value: t.id,
                label: `${t.name}${t.format ? ` · ${FORMAT_META[t.format as TournamentFormat]?.label ?? t.format}` : ''}`,
              }))}
            />
            <Button
              type="button"
              disabled={!attachId || attach.isPending}
              onClick={() => attach.mutate(attachId)}
            >
              Attach
            </Button>
          </div>
        </section>

        <section className="panel-card rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-[var(--color-ink)]">
                <Plus className="size-4 text-[var(--color-accent)]" /> Organize a tournament
              </h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Quick-create inside this event. It inherits venue, timezone and community.
              </p>
            </div>
            {!showCreate && (
              <Button type="button" variant="secondary" onClick={() => setShowCreate(true)}>
                New
              </Button>
            )}
          </div>
          {showCreate && (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim().length < 2) {
                  toast.error('Name is too short');
                  return;
                }
                create.mutate();
              }}
            >
              <div>
                <Label htmlFor="qt-name">Name</Label>
                <Input id="qt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Street Fighter 6 Open" autoFocus />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Format</Label>
                  <Select
                    value={format}
                    onChange={setFormat}
                    options={SINGLE_STAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  />
                </div>
                <div>
                  <Label>Game</Label>
                  <Select
                    value={gameId}
                    onChange={setGameId}
                    options={[
                      { value: '', label: 'Any / not listed' },
                      ...games.map((g) => ({ value: g.id, label: g.name })),
                    ]}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="qt-start">Starts ({event.timezone})</Label>
                <Input id="qt-start" type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Creating…' : 'Create tournament'}
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-[var(--color-ink)]">Attached tournaments</h3>
          <span className="text-xs text-[var(--color-muted)]">{attached.length}</span>
        </div>
        {isLoading ? (
          <div className="panel-card h-24 animate-pulse rounded-2xl" />
        ) : attached.length === 0 ? (
          <div className="panel-card rounded-2xl px-6 py-10 text-center text-sm text-[var(--color-muted)]">
            Nothing attached yet. Attach an existing tournament or create one above.
          </div>
        ) : (
          <ul className="panel-card divide-y divide-[var(--color-line)]/60 rounded-2xl">
            {attached.map((t) => (
              <li key={t.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/t/${t.slug}`} className="truncate font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]">
                      {t.name}
                    </Link>
                    <TournamentStatusChip status={t.status} />
                    {!t.isPublic && (
                      <span className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[10px] uppercase text-[var(--color-muted)]">
                        Private
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-[var(--color-muted)]">
                    <span>{t.format ? FORMAT_META[t.format as TournamentFormat]?.label ?? t.format : 'Format TBA'}</span>
                    {t.game && <span>{t.game.name}</span>}
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" /> {t._count.teams}
                    </span>
                    {t.startAt && <span>{fmtInTz(t.startAt, event.timezone, 'MMM d, h:mm a')}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link href={`/t/${t.slug}/manage`}>
                    <Button type="button" variant="secondary" className="gap-1 px-3 py-1.5 text-xs">
                      <Settings2 className="size-3.5" /> Manage
                    </Button>
                  </Link>
                  <Link href={`/t/${t.slug}`} target="_blank">
                    <Button type="button" variant="ghost" className="px-2 py-1.5 text-xs" aria-label="Open">
                      <ExternalLink className="size-3.5" />
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-1 px-2 py-1.5 text-xs text-[var(--color-danger)]"
                    disabled={detach.isPending}
                    onClick={() => {
                      if (confirm(`Detach "${t.name}" from this event? The tournament itself is kept.`)) {
                        detach.mutate(t.id);
                      }
                    }}
                  >
                    <Unlink className="size-3.5" /> Detach
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
