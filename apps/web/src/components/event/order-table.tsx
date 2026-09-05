'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, RefreshCw, Search } from 'lucide-react';
import { EVENT_ORDER_STATUSES, formatMoney } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { EventOrderRow } from './event-types';
import { fmtInTz } from './event-utils';
import { OrderStatusBadge } from './status-badge';

export function OrderTable({
  eventId,
  timezone,
}: {
  eventId: string;
  timezone: string;
}) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const query = new URLSearchParams();
  if (q.trim()) query.set('q', q.trim());
  if (status) query.set('status', status);
  const qs = query.toString();

  const { data: orders = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['event-orders', eventId, qs],
    enabled: !!token,
    queryFn: () => api<EventOrderRow[]>(`/events/${eventId}/orders${qs ? `?${qs}` : ''}`, { token }),
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['event-orders', eventId] });
    void qc.invalidateQueries({ queryKey: ['event-dashboard', eventId] });
    void qc.invalidateQueries({ queryKey: ['event-checkin-stats', eventId] });
  }

  const updateStatus = useMutation({
    mutationFn: ({ orderId, next }: { orderId: string; next: 'REFUNDED' | 'CANCELLED' | 'PAID' }) =>
      api<EventOrderRow>(`/events/${eventId}/orders/${orderId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status: next }),
      }),
    onSuccess: (_, vars) => {
      toast.success(`Order marked ${vars.next.toLowerCase()}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: (orderId: string) =>
      api<{ verified: boolean; changed: boolean }>(
        `/events/${eventId}/orders/${orderId}/verify-payment`,
        { method: 'POST', token, timeoutMs: 20000 },
      ),
    onSuccess: (res) => {
      if (res.changed) toast.success('Payment confirmed — order is now PAID');
      else if (res.verified) toast.message('Order was already paid');
      else toast.message('Stripe reports this session is not paid yet');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const undoCheckIn = useMutation({
    mutationFn: (orderId: string) =>
      api(`/events/${eventId}/check-in/${orderId}/undo`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success('Check-in undone');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, name or email"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onChange={setStatus}
          className="sm:w-44"
          options={[
            { value: '', label: 'All statuses' },
            ...EVENT_ORDER_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /> Refresh
        </Button>
      </div>

      <div className="panel-card overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
            <tr className="border-b border-[var(--color-line)]">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Checked in</th>
              <th className="px-4 py-3">Placed</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[var(--color-muted)]">
                  Loading orders…
                </td>
              </tr>
            )}
            {!isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[var(--color-muted)]">
                  No orders yet.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-[var(--color-line)]/60 last:border-0 hover:bg-[var(--color-surface)]/60">
                <td className="px-4 py-3 font-mono text-[13px] font-semibold tracking-wider text-[var(--color-ink)]">
                  {o.code}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-[var(--color-ink)]">{o.buyerName}</div>
                  <div className="text-xs text-[var(--color-muted)]">{o.buyerEmail}</div>
                </td>
                <td className="px-4 py-3 text-[var(--color-ink)]">{o.ticket?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right text-[var(--color-ink)]">{o.quantity}</td>
                <td className="px-4 py-3 text-right text-[var(--color-ink)]">
                  {formatMoney(o.amountCents, o.currency)}
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                  {o.checkedInAt ? (
                    <span className="inline-flex items-center gap-1 text-[var(--color-ok)]">
                      <CheckCircle2 className="size-3.5" />
                      {fmtInTz(o.checkedInAt, timezone, 'MMM d, h:mm a')}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                  {fmtInTz(o.createdAt, timezone, 'MMM d, h:mm a')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    {o.status === 'PENDING' && o.stripeSessionId && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        disabled={verify.isPending}
                        onClick={() => verify.mutate(o.id)}
                      >
                        Verify payment
                      </Button>
                    )}
                    {o.status === 'PENDING' && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ orderId: o.id, next: 'PAID' })}
                      >
                        Mark paid
                      </Button>
                    )}
                    {o.status === 'PAID' && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        disabled={updateStatus.isPending}
                        onClick={() => {
                          if (confirm(`Mark order ${o.code} as refunded?`)) {
                            updateStatus.mutate({ orderId: o.id, next: 'REFUNDED' });
                          }
                        }}
                      >
                        Refund
                      </Button>
                    )}
                    {(o.status === 'PAID' || o.status === 'PENDING') && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2 py-1 text-xs text-[var(--color-danger)]"
                        disabled={updateStatus.isPending}
                        onClick={() => {
                          if (confirm(`Cancel order ${o.code}?`)) {
                            updateStatus.mutate({ orderId: o.id, next: 'CANCELLED' });
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    {o.checkedInAt && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        disabled={undoCheckIn.isPending}
                        onClick={() => undoCheckIn.mutate(o.id)}
                      >
                        Undo check-in
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--color-muted)]">
        Showing {orders.length} order{orders.length === 1 ? '' : 's'}.
      </p>
    </div>
  );
}
