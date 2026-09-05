'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { QRCodeSVG } from 'qrcode.react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RefereeAvailabilityWindow, RefereeDto } from '@bracket/shared';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp, Copy, Link2, Plus, Trash2, X } from './icons';
import { fmtDayKey, scheduleKeys } from './schedule-shared';

export function RefereesPanel({ tournament, token }: { tournament: Tournament; token: string }) {
  const qc = useQueryClient();
  const { data: referees = [], isLoading } = useQuery({
    queryKey: scheduleKeys.referees(tournament.slug),
    queryFn: () => api<RefereeDto[]>(`/tournaments/${tournament.id}/referees`, { token }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: scheduleKeys.referees(tournament.slug) });

  const create = useMutation({
    mutationFn: (body: { name: string; email?: string | null }) =>
      api(`/tournaments/${tournament.id}/referees`, { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Referee added');
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; email?: string | null; availability?: RefereeAvailabilityWindow[] }) =>
      api(`/tournaments/${tournament.id}/referees/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Saved');
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/tournaments/${tournament.id}/referees/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Referee removed');
      void qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const link = useMutation({
    mutationFn: (id: string) =>
      api<{ url: string; token: string }>(`/tournaments/${tournament.id}/referees/${id}/access-link`, { method: 'POST', token }),
    onSuccess: (res, id) => {
      setLinkFor({ id, url: res.url });
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [linkFor, setLinkFor] = useState<{ id: string; url: string } | null>(null);

  if (isLoading) {
    return <div className="gaming-card rounded-xl p-6 text-sm text-[var(--color-muted)]">Loading referees…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="gaming-card rounded-xl p-4">
        <h3 className="font-display text-lg font-bold">Referees</h3>
        <p className="text-xs text-[var(--color-muted)]">
          Referees are assigned to matches by the scheduler (round-robin within their availability) or manually per match.
          Generate a courtside link so they can enter results from their phone without an account.
        </p>

        {referees.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-muted)]">No referees yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {referees.map((r) => (
              <RefereeRow
                key={r.id}
                referee={r}
                onSave={(body) => update.mutate({ id: r.id, ...body })}
                onDelete={() => {
                  if (confirm(`Remove ${r.name}? Their match assignments will be cleared.`)) remove.mutate(r.id);
                }}
                onLink={() => link.mutate(r.id)}
                linking={link.isPending && link.variables === r.id}
              />
            ))}
          </div>
        )}
      </div>

      <form
        className="panel-card flex flex-wrap items-end gap-3 rounded-xl p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate(
            { name: name.trim(), email: email.trim() || null },
            { onSuccess: () => { setName(''); setEmail(''); } },
          );
        }}
      >
        <div className="min-w-48 flex-1">
          <Label htmlFor="ref-name">Name</Label>
          <Input id="ref-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Referee name" />
        </div>
        <div className="min-w-48 flex-1">
          <Label htmlFor="ref-email">Email (optional)</Label>
          <Input id="ref-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          <Plus className="mr-1 size-4" /> Add referee
        </Button>
      </form>

      <Dialog.Root open={!!linkFor} onOpenChange={(o) => !o && setLinkFor(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="panel-card fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between">
              <div>
                <Dialog.Title className="font-display text-lg font-bold">Courtside access link</Dialog.Title>
                <Dialog.Description className="text-xs text-[var(--color-muted)]">
                  {referees.find((r) => r.id === linkFor?.id)?.name} — anyone with this link can enter results for
                  their assigned matches. Generating a new link revokes the old one.
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded-md p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)]">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            {linkFor && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG value={linkFor.url} size={180} />
                </div>
                <code className="w-full break-all rounded-md bg-[var(--color-surface)] p-2 text-xs">{linkFor.url}</code>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(linkFor.url);
                      toast.success('Link copied');
                    }}
                  >
                    <Copy className="mr-1 size-4" /> Copy link
                  </Button>
                  <a href={linkFor.url} target="_blank" rel="noreferrer">
                    <Button variant="secondary" type="button">Open</Button>
                  </a>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function RefereeRow({
  referee,
  onSave,
  onDelete,
  onLink,
  linking,
}: {
  referee: RefereeDto;
  onSave: (body: { name?: string; email?: string | null; availability?: RefereeAvailabilityWindow[] }) => void;
  onDelete: () => void;
  onLink: () => void;
  linking: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(referee.name);
  const [email, setEmail] = useState(referee.email ?? '');
  const [windows, setWindows] = useState<RefereeAvailabilityWindow[]>(referee.availability);
  const dirty =
    name.trim() !== referee.name ||
    (email.trim() || null) !== (referee.email ?? null) ||
    JSON.stringify(windows) !== JSON.stringify(referee.availability);

  function setWindow(i: number, patch: Partial<RefereeAvailabilityWindow>) {
    setWindows((w) => w.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="w-44 py-1" />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" className="w-56 py-1" />
        <span className="badge badge-neutral">{referee.assignedCount} assigned</span>
        <span className="text-xs text-[var(--color-muted)]">
          {referee.availability.length ? `${referee.availability.length} availability window${referee.availability.length > 1 ? 's' : ''}` : 'Always available'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {dirty && (
            <Button type="button" className="px-2 py-1 text-xs" onClick={() => onSave({ name: name.trim(), email: email.trim() || null, availability: windows })}>
              Save
            </Button>
          )}
          <Button variant="secondary" type="button" className="px-2 py-1 text-xs" onClick={onLink} disabled={linking}>
            <Link2 className="mr-1 size-3.5" /> {referee.hasAccessLink ? 'New access link' : 'Generate access link'}
          </Button>
          <button type="button" onClick={() => setOpen((v) => !v)} className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)]" title="Availability">
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          <button type="button" onClick={onDelete} className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-danger)]" title="Remove">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-[var(--color-line)] pt-3">
          <p className="text-xs text-[var(--color-muted)]">
            Availability windows (tournament timezone). Leave empty if available for the whole event.
          </p>
          {windows.map((w, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <Input type="date" value={w.date} onChange={(e) => setWindow(i, { date: e.target.value })} className="w-40 py-1" />
              <Input type="time" value={w.startTime} onChange={(e) => setWindow(i, { startTime: e.target.value })} className="w-28 py-1" />
              <span className="text-[var(--color-muted)]">→</span>
              <Input type="time" value={w.endTime} onChange={(e) => setWindow(i, { endTime: e.target.value })} className="w-28 py-1" />
              <span className="text-xs text-[var(--color-muted)]">{w.date && fmtDayKey(w.date)}</span>
              <button type="button" onClick={() => setWindows((x) => x.filter((_, idx) => idx !== i))} className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-danger)]">
                <X className="size-4" />
              </button>
            </div>
          ))}
          <Button
            variant="secondary"
            type="button"
            className="px-2 py-1 text-xs"
            onClick={() =>
              setWindows((x) => [
                ...x,
                { date: x[x.length - 1]?.date ?? new Date().toISOString().slice(0, 10), startTime: '09:00', endTime: '18:00' },
              ])
            }
          >
            <Plus className="mr-1 size-3.5" /> Add window
          </Button>
        </div>
      )}
    </div>
  );
}
