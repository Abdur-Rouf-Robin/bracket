'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { EVENT_CURRENCIES, ZERO_DECIMAL_CURRENCIES, formatMoney } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Dialog } from '../dialog';
import type { EventDetail, EventTicketWithSales } from '../event-types';
import { fmtInTz, isoToLocalInput, localInputToIso } from '../event-utils';

type Draft = {
  name: string;
  description: string;
  price: string;
  currency: string;
  quantity: string;
  salesStart: string;
  salesEnd: string;
  isActive: boolean;
};

const EMPTY: Draft = {
  name: '',
  description: '',
  price: '0',
  currency: 'USD',
  quantity: '',
  salesStart: '',
  salesEnd: '',
  isActive: true,
};

function toMinor(price: string, currency: string): number {
  const n = Number(price.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? Math.round(n) : Math.round(n * 100);
}

function fromMinor(cents: number, currency: string): string {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? String(cents) : (cents / 100).toFixed(2);
}

export function ManageTickets({ event }: { event: EventDetail }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EventTicketWithSales | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState('');

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['event-tickets', event.id],
    enabled: !!token,
    queryFn: () => api<EventTicketWithSales[]>(`/events/${event.id}/tickets`, { token }),
  });

  useEffect(() => {
    if (editing === 'new') setDraft(EMPTY);
    else if (editing) {
      setDraft({
        name: editing.name,
        description: editing.description ?? '',
        price: fromMinor(editing.priceCents, editing.currency),
        currency: editing.currency,
        quantity: editing.quantity == null ? '' : String(editing.quantity),
        salesStart: isoToLocalInput(editing.salesStartAt, event.timezone),
        salesEnd: isoToLocalInput(editing.salesEndAt, event.timezone),
        isActive: editing.isActive,
      });
    }
    setError('');
  }, [editing, event.timezone]);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['event-tickets', event.id] });
    void qc.invalidateQueries({ queryKey: ['event', event.slug] });
    void qc.invalidateQueries({ queryKey: ['event-dashboard', event.id] });
  }

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        priceCents: toMinor(draft.price, draft.currency),
        currency: draft.currency,
        quantity: draft.quantity.trim() ? Number(draft.quantity) : null,
        salesStartAt: localInputToIso(draft.salesStart, event.timezone),
        salesEndAt: localInputToIso(draft.salesEnd, event.timezone),
        isActive: draft.isActive,
      };
      return editing === 'new' || !editing
        ? api<EventTicketWithSales>(`/events/${event.id}/tickets`, {
            method: 'POST',
            token,
            body: JSON.stringify(body),
          })
        : api<EventTicketWithSales>(`/events/${event.id}/tickets/${editing.id}`, {
            method: 'PATCH',
            token,
            body: JSON.stringify(body),
          });
    },
    onSuccess: () => {
      toast.success(editing === 'new' ? 'Ticket created' : 'Ticket updated');
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: (ticketId: string) =>
      api<{ ok: boolean; deactivated: boolean }>(`/events/${event.id}/tickets/${ticketId}`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: (res) => {
      toast.success(res.deactivated ? 'Ticket has orders — deactivated instead of deleted' : 'Ticket deleted');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (t: EventTicketWithSales) =>
      api(`/events/${event.id}/tickets/${t.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isActive: !t.isActive }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-muted)]">
          Ticket types shown on the public page. Free tickets confirm instantly; paid tickets go
          through Stripe checkout when configured, otherwise they&apos;re recorded as pay-at-door.
        </p>
        <Button type="button" className="shrink-0 gap-2" onClick={() => setEditing('new')}>
          <Plus className="size-4" /> New ticket
        </Button>
      </div>

      <div className="panel-card overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
            <tr className="border-b border-[var(--color-line)]">
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Sold</th>
              <th className="px-4 py-3 text-right">Remaining</th>
              <th className="px-4 py-3">Sales window</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--color-muted)]">Loading…</td>
              </tr>
            )}
            {!isLoading && tickets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--color-muted)]">
                  No ticket types yet. Create one to start selling.
                </td>
              </tr>
            )}
            {tickets.map((t) => (
              <tr key={t.id} className="border-b border-[var(--color-line)]/60 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--color-ink)]">{t.name}</p>
                  {t.description && (
                    <p className="line-clamp-1 text-xs text-[var(--color-muted)]">{t.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-ink)]">
                  {formatMoney(t.priceCents, t.currency)}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-ink)]">{t.sold}</td>
                <td className="px-4 py-3 text-right text-[var(--color-ink)]">
                  {t.remaining == null ? '∞' : t.remaining}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                  {t.salesStartAt || t.salesEndAt ? (
                    <>
                      {t.salesStartAt ? fmtInTz(t.salesStartAt, event.timezone, 'MMM d, h:mm a') : 'Now'}
                      {' → '}
                      {t.salesEndAt ? fmtInTz(t.salesEndAt, event.timezone, 'MMM d, h:mm a') : 'Event end'}
                    </>
                  ) : (
                    'Always'
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={t.isActive}
                    onClick={() => toggleActive.mutate(t)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                      t.isActive ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-progress)]'
                    }`}
                  >
                    <span
                      className={`inline-block size-4 rounded-full bg-white transition ${
                        t.isActive ? 'translate-x-[18px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(t)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-2 py-1 text-xs text-[var(--color-danger)]"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(`Delete ticket "${t.name}"?`)) remove.mutate(t.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        title={editing === 'new' ? 'New ticket type' : 'Edit ticket'}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            if (!draft.name.trim()) {
              setError('Name is required');
              return;
            }
            save.mutate();
          }}
        >
          <div>
            <Label htmlFor="tk-name">Name</Label>
            <Input id="tk-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="General admission" autoFocus />
          </div>
          <div>
            <Label htmlFor="tk-desc">Description</Label>
            <textarea
              id="tk-desc"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={3}
              className="field-textarea w-full"
              placeholder="What's included; for paid tickets without Stripe this is shown as payment instructions."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="tk-price">Price</Label>
              <Input
                id="tk-price"
                type="number"
                min={0}
                step={ZERO_DECIMAL_CURRENCIES.has(draft.currency) ? 1 : 0.01}
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
              <p className="mt-1 text-xs text-[var(--color-muted)]">0 = free ticket</p>
            </div>
            <div>
              <Label>Currency</Label>
              <Select
                value={draft.currency}
                onChange={(v) => setDraft({ ...draft, currency: v || 'USD' })}
                options={EVENT_CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="tk-qty">Quantity available</Label>
            <Input
              id="tk-qty"
              type="number"
              min={1}
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
              placeholder="Unlimited"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tk-start">Sales start ({event.timezone})</Label>
              <Input id="tk-start" type="datetime-local" value={draft.salesStart} onChange={(e) => setDraft({ ...draft, salesStart: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="tk-end">Sales end</Label>
              <Input id="tk-end" type="datetime-local" value={draft.salesEnd} onChange={(e) => setDraft({ ...draft, salesEnd: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={draft.isActive}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
            />
            Active (visible on the public page)
          </label>
          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing === 'new' ? 'Create ticket' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
