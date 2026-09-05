'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Dialog } from './dialog';
import type { CreateOrderResponse, EventTicketWithSales } from './event-types';

export function TicketPurchaseDialog({
  slug,
  ticket,
  onClose,
}: {
  slug: string;
  ticket: EventTicketWithSales | null;
  onClose: () => void;
}) {
  const { user, token } = useAuth();
  const router = useRouter();
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ticket) {
      setBuyerName((v) => v || user?.name || '');
      setBuyerEmail((v) => v || user?.email || '');
      setQuantity(1);
      setError('');
    }
  }, [ticket, user]);

  const maxQty = Math.max(
    1,
    Math.min(10, ticket?.remaining ?? 10),
  );

  const purchase = useMutation({
    mutationFn: () =>
      api<CreateOrderResponse>(`/e/${slug}/orders`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          ticketId: ticket!.id,
          quantity,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
        }),
        timeoutMs: 20000,
      }),
    onSuccess: (res) => {
      if (res.checkoutUrl) {
        toast.message('Redirecting to secure checkout…');
        window.location.assign(res.checkoutUrl);
        return;
      }
      toast.success(res.message);
      onClose();
      router.push(`/e/${slug}/ticket/${res.order.code}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const total = ticket ? ticket.priceCents * quantity : 0;

  return (
    <Dialog
      open={!!ticket}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={ticket ? `Get ticket · ${ticket.name}` : 'Get ticket'}
      description={
        ticket
          ? ticket.priceCents > 0
            ? `${formatMoney(ticket.priceCents, ticket.currency)} each`
            : 'Free admission'
          : undefined
      }
    >
      {ticket && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            if (!buyerName.trim() || !buyerEmail.trim()) {
              setError('Name and email are required');
              return;
            }
            purchase.mutate();
          }}
        >
          <div>
            <Label htmlFor="buyerName">Your name</Label>
            <Input
              id="buyerName"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Full name"
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="buyerEmail">Email</Label>
            <Input
              id="buyerEmail"
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              We&apos;ll email your ticket and check-in code here.
            </p>
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="px-3"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                −
              </Button>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={maxQty}
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)),
                  )
                }
                className="w-20 text-center"
              />
              <Button
                type="button"
                variant="secondary"
                className="px-3"
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty}
              >
                +
              </Button>
              <span className="text-xs text-[var(--color-muted)]">max {maxQty}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
            <span className="text-sm text-[var(--color-muted)]">Total</span>
            <span className="text-lg font-bold text-[var(--color-ink)]">
              {formatMoney(total, ticket.currency)}
            </span>
          </div>

          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={purchase.isPending}>
              {purchase.isPending
                ? 'Processing…'
                : ticket.priceCents > 0
                  ? 'Continue to payment'
                  : 'Claim ticket'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
