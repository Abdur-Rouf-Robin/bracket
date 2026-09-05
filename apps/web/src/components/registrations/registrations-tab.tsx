'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowUpCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  GripVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { COUNTRY_OPTIONS, SKILL_LEVELS, formatMoney } from '@bracket/shared';
import type { RegistrationFieldDef, RegistrationStatusValue } from '@bracket/shared';
import type { TournamentSettings } from '@bracket/shared';
import { API_URL, api } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import type { Registration } from '@/lib/types-platform';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RegistrationSettingsPanel } from '@/components/registrations/registration-settings-panel';
import {
  PaymentBadge,
  Pill,
  StatusPill,
  formatDateTime,
} from '@/components/registrations/registration-ui';

type Counts = {
  approved: number;
  pending: number;
  waitlisted: number;
  rejected: number;
  withdrawn: number;
};

type ListResponse = { items: Registration[]; counts: Counts };

const SUB_TO_STATUS: Record<string, RegistrationStatusValue | 'ALL'> = {
  pending: 'PENDING',
  approved: 'APPROVED',
  waitlist: 'WAITLISTED',
  rejected: 'REJECTED',
  withdrawn: 'WITHDRAWN',
  all: 'ALL',
};

function countryName(code?: string | null) {
  if (!code) return '—';
  return COUNTRY_OPTIONS.find((c) => c.code === code)?.name ?? code;
}

function skillLabel(v?: string | null) {
  if (!v) return '—';
  return SKILL_LEVELS.find((s) => s.value === v)?.label ?? v;
}

function playersOf(reg: Registration): { name: string; isCaptain?: boolean }[] {
  if (!Array.isArray(reg.players)) return [];
  return reg.players.map((p) =>
    typeof p === 'string' ? { name: p } : { name: p.name, isCaptain: p.isCaptain },
  );
}

/**
 * Registrations tab (pending / approved / waitlist / rejected / sign-up form builder)
 */
export function RegistrationsTab({
  tournament,
  token,
  mode,
  sub,
}: {
  tournament: Tournament;
  token?: string;
  mode: 'public' | 'manage';
  sub: string;
}) {
  if (sub === 'form') {
    return (
      <RegistrationSettingsPanel
        tournament={tournament}
        token={token}
        mode={mode}
        sub={sub}
      />
    );
  }
  if (!token) return null;
  return <RegistrationsList tournament={tournament} token={token} sub={sub} />;
}

function RegistrationsList({
  tournament,
  token,
  sub,
}: {
  tournament: Tournament;
  token: string;
  sub: string;
}) {
  const qc = useQueryClient();
  const status = SUB_TO_STATUS[sub] ?? 'PENDING';
  const settings = (tournament.settings ?? {}) as Partial<TournamentSettings>;
  const fields = (settings.registrationFields ?? []) as RegistrationFieldDef[];
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);

  const listKey = ['registrations', tournament.id];
  const query = useQuery({
    queryKey: listKey,
    queryFn: () => api<ListResponse>(`/tournaments/${tournament.id}/registrations`, { token }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: listKey });
    qc.invalidateQueries({ queryKey: ['tournament', tournament.slug] });
  };

  const review = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { status?: RegistrationStatusValue; notes?: string | null; paymentStatus?: string };
    }) =>
      api(`/tournaments/${tournament.id}/registrations/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/tournaments/${tournament.id}/registrations/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Registration deleted');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const promote = useMutation({
    mutationFn: () =>
      api(`/tournaments/${tournament.id}/registrations/promote-next`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success('Promoted next waitlisted participant');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approveAll = useMutation({
    mutationFn: () =>
      api<{ approved: number; waitlisted: number; remaining: number }>(
        `/tournaments/${tournament.id}/registrations/approve-all-pending`,
        { method: 'POST', token },
      ),
    onSuccess: (res) => {
      toast.success(
        `Approved ${res.approved}${res.waitlisted ? `, waitlisted ${res.waitlisted}` : ''}${
          res.remaining ? ` — ${res.remaining} left (full)` : ''
        }`,
      );
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const verifyPayment = useMutation({
    mutationFn: (id: string) =>
      api<{ verified: boolean; paymentStatus: string }>(
        `/tournaments/${tournament.id}/registrations/${id}/verify-payment`,
        { method: 'POST', token },
      ),
    onSuccess: (res) => {
      toast[res.verified ? 'success' : 'info'](
        res.verified ? 'Payment verified' : `Stripe reports: ${res.paymentStatus.toLowerCase()}`,
      );
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) =>
      api(`/tournaments/${tournament.id}/registrations/waitlist/reorder`, {
        method: 'POST',
        token,
        body: JSON.stringify({ orderedIds }),
      }),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  const all = query.data?.items ?? [];
  const counts = query.data?.counts;
  const rows = useMemo(() => {
    const filtered = status === 'ALL' ? all : all.filter((r) => r.status === status);
    const q = search.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((r) => {
      const hay = [
        r.teamName,
        r.email ?? '',
        r.user?.name ?? '',
        r.countryCode ?? '',
        ...playersOf(r).map((p) => p.name),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [all, status, search]);

  async function bulk(action: 'APPROVED' | 'REJECTED' | 'WAITLISTED') {
    const ids = [...selected];
    if (!ids.length) return;
    let ok = 0;
    for (const id of ids) {
      try {
        await review.mutateAsync({ id, patch: { status: action } });
        ok += 1;
      } catch {
        /* toast already shown */
      }
    }
    toast.success(`${ok}/${ids.length} updated`);
    setSelected(new Set());
  }

  const exportHref = `${API_URL}/tournaments/${tournament.id}/export/registrations.csv?access_token=${encodeURIComponent(token)}`;
  const isWaitlist = status === 'WAITLISTED';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <CountBadge label="Pending" value={counts?.pending} tone="warn" />
          <CountBadge label="Approved" value={counts?.approved} tone="ok" />
          <CountBadge label="Waitlist" value={counts?.waitlisted} tone="info" />
          <CountBadge label="Rejected" value={counts?.rejected} tone="danger" />
          <CountBadge
            label="Capacity"
            value={`${counts?.approved ?? tournament.teams.length}/${settings.maxParticipants ?? '∞'}`}
            tone="muted"
          />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="h-8 text-xs"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={`mr-1 size-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <a href={exportHref} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="h-8 text-xs">
              <Download className="mr-1 size-3.5" /> Export CSV
            </Button>
          </a>
          <Button className="h-8 text-xs" onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-1 size-3.5" /> Add participant manually
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-[var(--color-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, player…"
            className="pl-8"
          />
        </div>
        {status === 'PENDING' && (
          <Button
            variant="secondary"
            className="h-9 text-xs"
            disabled={approveAll.isPending || !counts?.pending}
            onClick={() => approveAll.mutate()}
          >
            <Check className="mr-1 size-3.5" /> Approve all pending
          </Button>
        )}
        {isWaitlist && (
          <Button
            variant="secondary"
            className="h-9 text-xs"
            disabled={promote.isPending || !counts?.waitlisted}
            onClick={() => promote.mutate()}
          >
            <ArrowUpCircle className="mr-1 size-3.5" /> Promote next
          </Button>
        )}
        {selected.size > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-2 py-1 text-xs">
            <span className="font-semibold">{selected.size} selected</span>
            {status !== 'APPROVED' && (
              <Button className="h-7 px-2 text-xs" onClick={() => bulk('APPROVED')}>
                Approve
              </Button>
            )}
            {status !== 'WAITLISTED' && (
              <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => bulk('WAITLISTED')}>
                Waitlist
              </Button>
            )}
            {status !== 'REJECTED' && (
              <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => bulk('REJECTED')}>
                Reject
              </Button>
            )}
            <button
              type="button"
              className="ml-1 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              onClick={() => setSelected(new Set())}
              title="Clear selection"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading registrations…</p>
      ) : query.error ? (
        <p className="text-sm text-[var(--color-danger)]">
          {query.error instanceof Error ? query.error.message : 'Failed to load'}
        </p>
      ) : rows.length === 0 ? (
        <div className="gaming-card rounded-xl border-dashed p-8 text-center text-sm text-[var(--color-muted)]">
          {search
            ? 'No registrations match your search.'
            : status === 'PENDING'
              ? 'No pending registrations — you\u2019re all caught up.'
              : status === 'WAITLISTED'
                ? 'The waitlist is empty.'
                : status === 'REJECTED'
                  ? 'No rejected registrations.'
                  : 'No registrations yet. Share the sign-up page to get participants.'}
          {settings.registrationMode !== 'OPEN_SIGNUP' && (
            <p className="mt-2">
              Open sign-ups are off.{' '}
              <Link
                href={`/t/${tournament.slug}/manage?tab=registrations&sub=form`}
                className="text-[var(--color-accent)] hover:underline"
              >
                Enable the sign-up page
              </Link>
              .
            </p>
          )}
        </div>
      ) : isWaitlist && !search ? (
        <WaitlistTable
          rows={rows}
          fields={fields}
          selected={selected}
          setSelected={setSelected}
          onAction={(id, patch) => review.mutate({ id, patch })}
          onDelete={(id) => remove.mutate(id)}
          onVerify={(id) => verifyPayment.mutate(id)}
          onReorder={(ids) => reorder.mutate(ids)}
          busy={review.isPending || remove.isPending}
        />
      ) : (
        <RegistrationsTable
          rows={rows}
          fields={fields}
          status={status}
          selected={selected}
          setSelected={setSelected}
          onAction={(id, patch) => review.mutate({ id, patch })}
          onDelete={(id) => remove.mutate(id)}
          onVerify={(id) => verifyPayment.mutate(id)}
          busy={review.isPending || remove.isPending}
        />
      )}

      <AddParticipantDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tournament={tournament}
        token={token}
        onCreated={invalidate}
      />
    </div>
  );
}

function CountBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string | undefined;
  tone: 'ok' | 'warn' | 'info' | 'danger' | 'muted';
}) {
  return (
    <Pill tone={tone} className="normal-case tracking-normal">
      {label}
      <span className="ml-1 font-mono">{value ?? '…'}</span>
    </Pill>
  );
}

type RowActions = {
  onAction: (
    id: string,
    patch: { status?: RegistrationStatusValue; notes?: string | null; paymentStatus?: string },
  ) => void;
  onDelete: (id: string) => void;
  onVerify: (id: string) => void;
  busy: boolean;
};

function RegistrationsTable({
  rows,
  fields,
  status,
  selected,
  setSelected,
  ...actions
}: {
  rows: Registration[];
  fields: RegistrationFieldDef[];
  status: RegistrationStatusValue | 'ALL';
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
} & RowActions) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface)]/60 text-xs uppercase tracking-wide text-[var(--color-muted)]">
          <tr>
            <th className="w-8 px-3 py-2.5">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-accent)]"
                checked={allSelected}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
                }
              />
            </th>
            <th className="px-3 py-2.5">Participant</th>
            <th className="px-3 py-2.5">Contact</th>
            <th className="px-3 py-2.5">Country</th>
            <th className="px-3 py-2.5">Skill</th>
            <th className="px-3 py-2.5">Payment</th>
            <th className="px-3 py-2.5">Submitted</th>
            <th className="px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((reg) => (
            <RegistrationRow
              key={reg.id}
              reg={reg}
              fields={fields}
              status={status}
              selected={selected.has(reg.id)}
              onSelect={(v) => {
                const next = new Set(selected);
                if (v) next.add(reg.id);
                else next.delete(reg.id);
                setSelected(next);
              }}
              {...actions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegistrationRow({
  reg,
  fields,
  status,
  selected,
  onSelect,
  onAction,
  onDelete,
  onVerify,
  busy,
  dragHandle,
}: {
  reg: Registration;
  fields: RegistrationFieldDef[];
  status: RegistrationStatusValue | 'ALL';
  selected: boolean;
  onSelect: (v: boolean) => void;
  dragHandle?: React.ReactNode;
} & RowActions) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(reg.notes ?? '');
  const players = playersOf(reg);
  const customEntries = Object.entries(reg.customFields ?? {});
  const hasDetails = players.length > 0 || customEntries.length > 0 || !!reg.phone;

  return (
    <>
      <tr className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-surface)]/30">
        <td className="px-3 py-2.5 align-top">
          <div className="flex items-center gap-1">
            {dragHandle}
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={selected}
              onChange={(e) => onSelect(e.target.checked)}
            />
          </div>
        </td>
        <td className="px-3 py-2.5 align-top">
          <button
            type="button"
            className="flex items-start gap-1.5 text-left"
            onClick={() => setOpen((v) => !v)}
          >
            {hasDetails ? (
              open ? (
                <ChevronDown className="mt-0.5 size-4 shrink-0 text-[var(--color-muted)]" />
              ) : (
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-[var(--color-muted)]" />
              )
            ) : (
              <span className="size-4 shrink-0" />
            )}
            <span>
              <span className="font-semibold">{reg.teamName}</span>
              <span className="block text-xs text-[var(--color-muted)]">
                {players.length ? `${players.length} player${players.length === 1 ? '' : 's'}` : 'No roster'}
                {reg.status === 'WAITLISTED' && reg.waitlistPosition
                  ? ` · waitlist #${reg.waitlistPosition}`
                  : ''}
                {status === 'ALL' ? (
                  <>
                    {' · '}
                    <StatusPill status={reg.status} waitlistPosition={reg.waitlistPosition} />
                  </>
                ) : null}
              </span>
            </span>
          </button>
        </td>
        <td className="px-3 py-2.5 align-top text-[var(--color-muted)]">
          <span className="block text-[var(--color-ink)]">
            {reg.user?.name ?? (reg.email ? 'Guest' : '—')}
          </span>
          {reg.email && <span className="block text-xs">{reg.email}</span>}
        </td>
        <td className="px-3 py-2.5 align-top text-[var(--color-muted)]">{countryName(reg.countryCode)}</td>
        <td className="px-3 py-2.5 align-top text-[var(--color-muted)]">{skillLabel(reg.skillLevel)}</td>
        <td className="px-3 py-2.5 align-top">
          <div className="flex flex-col items-start gap-1">
            <PaymentBadge status={reg.paymentStatus} />
            {reg.amountCents > 0 && (
              <span className="text-xs text-[var(--color-muted)]">
                {formatMoney(reg.amountCents, reg.currency)}
              </span>
            )}
            {reg.paymentStatus === 'UNPAID' && (
              <div className="flex gap-1">
                <button
                  type="button"
                  className="text-[10px] text-[var(--color-accent)] hover:underline"
                  onClick={() => onVerify(reg.id)}
                >
                  Verify
                </button>
                <button
                  type="button"
                  className="text-[10px] text-[var(--color-muted)] hover:underline"
                  onClick={() => onAction(reg.id, { paymentStatus: 'PAID' })}
                >
                  Mark paid
                </button>
              </div>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5 align-top text-xs text-[var(--color-muted)]">
          {formatDateTime(reg.createdAt)}
        </td>
        <td className="px-3 py-2.5 align-top">
          <div className="flex flex-wrap justify-end gap-1">
            {reg.status !== 'APPROVED' && (
              <Button
                className="h-7 px-2 text-xs"
                disabled={busy}
                onClick={() => onAction(reg.id, { status: 'APPROVED' })}
              >
                {reg.status === 'WAITLISTED' ? 'Promote' : 'Approve'}
              </Button>
            )}
            {reg.status !== 'WAITLISTED' && reg.status !== 'WITHDRAWN' && (
              <Button
                variant="secondary"
                className="h-7 px-2 text-xs"
                disabled={busy}
                onClick={() => onAction(reg.id, { status: 'WAITLISTED' })}
              >
                Waitlist
              </Button>
            )}
            {reg.status !== 'REJECTED' && reg.status !== 'WITHDRAWN' && (
              <Button
                variant="secondary"
                className="h-7 px-2 text-xs"
                disabled={busy}
                onClick={() => onAction(reg.id, { status: 'REJECTED' })}
              >
                Reject
              </Button>
            )}
            {(reg.status === 'REJECTED' || reg.status === 'WITHDRAWN') && (
              <Button
                variant="secondary"
                className="h-7 px-2 text-xs"
                disabled={busy}
                onClick={() => onAction(reg.id, { status: 'PENDING' })}
              >
                Reopen
              </Button>
            )}
            <Button
              variant="ghost"
              className="h-7 px-2 text-xs text-[var(--color-danger)]"
              disabled={busy}
              title="Delete registration"
              onClick={() => {
                if (confirm(`Delete the registration of ${reg.teamName}?`)) onDelete(reg.id);
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)]/30 last:border-0">
          <td />
          <td colSpan={7} className="px-3 py-3">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Roster
                </p>
                {players.length ? (
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {players.map((p, i) => (
                      <li key={i}>
                        {p.name}
                        {p.isCaptain ? (
                          <span className="ml-1 text-xs text-[var(--color-accent)]">(C)</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-[var(--color-muted)]">—</p>
                )}
                {reg.phone && (
                  <p className="mt-2 text-xs text-[var(--color-muted)]">Phone: {reg.phone}</p>
                )}
                {reg.waiverAcceptedAt && (
                  <p className="mt-1 text-xs text-[var(--color-ok)]">
                    Waiver accepted {formatDateTime(reg.waiverAcceptedAt)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Custom fields
                </p>
                {customEntries.length ? (
                  <dl className="mt-1 space-y-1 text-sm">
                    {customEntries.map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-[var(--color-muted)]">
                          {fields.find((f) => f.id === k)?.label ?? k}
                        </dt>
                        <dd className="break-words">
                          {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-1 text-sm text-[var(--color-muted)]">—</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Host notes
                </p>
                <textarea
                  className="field-textarea mt-1 min-h-20 text-xs"
                  value={notes}
                  placeholder="Private notes (only visible to managers)"
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => {
                    if ((reg.notes ?? '') !== notes) onAction(reg.id, { notes });
                  }}
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function WaitlistTable({
  rows,
  fields,
  selected,
  setSelected,
  onReorder,
  ...actions
}: {
  rows: Registration[];
  fields: RegistrationFieldDef[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onReorder: (ids: string[]) => void;
} & RowActions) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = rows.map((r) => r.id);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
      <p className="border-b border-[var(--color-line)] px-3 py-2 text-xs text-[var(--color-muted)]">
        Drag rows to change waitlist order. The top entry is promoted first.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface)]/60 text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <tr>
                <th className="w-16 px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Participant</th>
                <th className="px-3 py-2.5">Contact</th>
                <th className="px-3 py-2.5">Country</th>
                <th className="px-3 py-2.5">Skill</th>
                <th className="px-3 py-2.5">Payment</th>
                <th className="px-3 py-2.5">Submitted</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            {rows.map((reg) => (
              <SortableRegistrationRow
                key={reg.id}
                reg={reg}
                fields={fields}
                selected={selected.has(reg.id)}
                onSelect={(v) => {
                  const next = new Set(selected);
                  if (v) next.add(reg.id);
                  else next.delete(reg.id);
                  setSelected(next);
                }}
                {...actions}
              />
            ))}
          </table>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableRegistrationRow(
  props: {
    reg: Registration;
    fields: RegistrationFieldDef[];
    selected: boolean;
    onSelect: (v: boolean) => void;
  } & RowActions,
) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.reg.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <tbody ref={setNodeRef} style={style}>
      <RegistrationRow
        {...props}
        status="WAITLISTED"
        dragHandle={
          <button
            type="button"
            className="cursor-grab touch-none text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            title={`Waitlist #${props.reg.waitlistPosition ?? '?'}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </tbody>
  );
}

function AddParticipantDialog({
  open,
  onOpenChange,
  tournament,
  token,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tournament: Tournament;
  token: string;
  onCreated: () => void;
}) {
  const settings = (tournament.settings ?? {}) as Partial<TournamentSettings>;
  const starters = settings.playersPerTeam ?? 1;
  const [teamName, setTeamName] = useState('');
  const [email, setEmail] = useState('');
  const [players, setPlayers] = useState<string[]>(() =>
    Array.from({ length: starters > 1 ? starters : 0 }, () => ''),
  );
  const [notes, setNotes] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api(`/tournaments/${tournament.id}/registrations/manual`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          teamName: teamName.trim(),
          email: email.trim() || null,
          players: players
            .map((p, i) => ({ name: p.trim(), isCaptain: i === 0 }))
            .filter((p) => p.name),
          notes: notes.trim() || null,
        }),
      }),
    onSuccess: () => {
      toast.success(`${teamName.trim()} added and approved`);
      setTeamName('');
      setEmail('');
      setNotes('');
      setPlayers(Array.from({ length: starters > 1 ? starters : 0 }, () => ''));
      onOpenChange(false);
      onCreated();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="gaming-card fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 focus:outline-none">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold">
                Add participant manually
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-[var(--color-muted)]">
                Creates an approved registration and a team immediately.
              </Dialog.Description>
            </div>
            <Dialog.Close className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (teamName.trim()) create.mutate();
            }}
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-muted)]">
                {starters > 1 ? 'Team name' : 'Participant name'}
              </label>
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} required maxLength={80} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-muted)]">
                Email (optional — links to an existing account)
              </label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {(starters > 1 || players.length > 0) && (
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-muted)]">Players</label>
                <div className="space-y-1.5">
                  {players.map((p, i) => (
                    <Input
                      key={i}
                      value={p}
                      placeholder={`Player ${i + 1}${i === 0 ? ' (captain)' : ''}`}
                      onChange={(e) => {
                        const next = [...players];
                        next[i] = e.target.value;
                        setPlayers(next);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setPlayers((prev) => [...prev, ''])}
            >
              <Plus className="mr-1 size-3.5" /> Add player
            </Button>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-muted)]">Notes</label>
              <textarea
                className="field-textarea min-h-16 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={create.isPending || !teamName.trim()}>
                {create.isPending ? 'Adding…' : 'Add & approve'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
