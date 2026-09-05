'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ScanLine, Trophy, Undo2, UserCheck } from 'lucide-react';
import { normalizeOrderCode } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { CheckInResult, CheckInStats } from './event-types';
import { fmtInTz } from './event-utils';
import { OrderStatusBadge } from './status-badge';

export function CheckinPanel({
  eventId,
  timezone,
}: {
  eventId: string;
  timezone: string;
}) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: stats } = useQuery({
    queryKey: ['event-checkin-stats', eventId],
    enabled: !!token,
    refetchInterval: 15000,
    queryFn: () => api<CheckInStats>(`/events/${eventId}/check-in/stats`, { token }),
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['event-checkin-stats', eventId] });
    void qc.invalidateQueries({ queryKey: ['event-orders', eventId] });
    void qc.invalidateQueries({ queryKey: ['event-dashboard', eventId] });
  }

  const checkIn = useMutation({
    mutationFn: (c: string) =>
      api<CheckInResult>(`/events/${eventId}/check-in`, {
        method: 'POST',
        token,
        body: JSON.stringify({ code: c }),
      }),
    onSuccess: (res) => {
      setResult(res);
      setError('');
      setCode('');
      if (res.alreadyCheckedIn) toast.message(`${res.order.buyerName} was already checked in`);
      else toast.success(`Checked in ${res.order.buyerName}`);
      invalidate();
      inputRef.current?.focus();
    },
    onError: (e: Error) => {
      setResult(null);
      setError(e.message);
      inputRef.current?.focus();
    },
  });

  const undo = useMutation({
    mutationFn: (orderId: string) =>
      api(`/events/${eventId}/check-in/${orderId}/undo`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success('Check-in undone');
      setResult(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pct =
    stats && stats.paidOrders > 0
      ? Math.round((stats.checkedIn / stats.paidOrders) * 100)
      : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <form
          className="panel-card rounded-2xl p-6"
          onSubmit={(e) => {
            e.preventDefault();
            const normalized = normalizeOrderCode(code);
            if (normalized.length < 4) {
              setError('Enter the ticket code');
              return;
            }
            checkIn.mutate(normalized);
          }}
        >
          <label htmlFor="checkin-code" className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--color-muted)]">
            <ScanLine className="size-4" /> Ticket code
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={inputRef}
              id="checkin-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD2345"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-4 font-mono text-2xl font-bold uppercase tracking-[0.3em] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]/50 focus:border-[var(--color-accent)]/60 focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
            <Button type="submit" className="px-6 py-4 text-base" disabled={checkIn.isPending}>
              {checkIn.isPending ? 'Checking…' : 'Check in'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Scan the QR code with a barcode scanner (it types the code) or enter it manually. Paid tickets only.
          </p>
          {error && (
            <p className="mt-3 rounded-lg border border-[var(--color-danger)]/40 bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">
              {error}
            </p>
          )}
        </form>

        {result && (
          <div
            className={cn(
              'rounded-2xl border p-6',
              result.alreadyCheckedIn
                ? 'border-[#fbbf24]/40 bg-[color-mix(in_srgb,#fbbf24_10%,var(--color-card))]'
                : 'border-[var(--color-ok)]/40 bg-[color-mix(in_srgb,var(--color-ok)_10%,var(--color-card))]',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-full',
                    result.alreadyCheckedIn ? 'bg-[#fbbf24]/20 text-[#fbbf24]' : 'bg-[var(--color-ok)]/20 text-[var(--color-ok)]',
                  )}
                >
                  <UserCheck className="size-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    {result.alreadyCheckedIn ? 'Already checked in' : 'Checked in'}
                  </p>
                  <p className="text-xl font-bold text-[var(--color-ink)]">{result.order.buyerName}</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {result.order.ticket?.name} × {result.order.quantity} ·{' '}
                    <span className="font-mono tracking-wider">{result.order.code}</span>
                  </p>
                  {result.order.checkedInAt && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {fmtInTz(result.order.checkedInAt, timezone, 'MMM d, h:mm:ss a')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <OrderStatusBadge status={result.order.status} />
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-1 px-2 py-1 text-xs"
                  disabled={undo.isPending}
                  onClick={() => undo.mutate(result.order.id)}
                >
                  <Undo2 className="size-3.5" /> Undo
                </Button>
              </div>
            </div>

            <div className="mt-4 border-t border-[var(--color-line)]/60 pt-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                <Trophy className="size-3.5" /> Tournament check-ins
              </p>
              {result.checkedInTeams.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">
                  No registered teams matched this attendee in the event&apos;s tournaments.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {result.checkedInTeams.map((t) => (
                    <li key={t.teamId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="inline-flex items-center gap-2 text-[var(--color-ink)]">
                        <CheckCircle2 className="size-4 text-[var(--color-ok)]" />
                        {t.teamName}
                      </span>
                      <Link
                        href={`/t/${t.tournamentSlug}`}
                        className="truncate text-xs text-[var(--color-accent)] hover:underline"
                      >
                        {t.tournamentName}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="panel-card rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Attendance</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-bold text-[var(--color-ink)]">{stats?.checkedIn ?? '—'}</span>
            <span className="pb-1 text-sm text-[var(--color-muted)]">/ {stats?.paidOrders ?? '—'} paid</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-progress)]">
            <div
              className="h-full rounded-full bg-[var(--color-ok)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-[var(--color-muted)]">
            <span>{pct}% checked in</span>
            <span>{stats?.remaining ?? '—'} remaining</span>
          </div>
        </div>

        <div className="panel-card rounded-2xl p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Recent check-ins</p>
          {!stats || stats.recent.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Nobody checked in yet.</p>
          ) : (
            <ul className="space-y-2">
              {stats.recent.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--color-ink)]">{o.buyerName}</p>
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      {o.ticket?.name} · <span className="font-mono">{o.code}</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--color-muted)]">
                    {fmtInTz(o.checkedInAt, timezone, 'h:mm a')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
