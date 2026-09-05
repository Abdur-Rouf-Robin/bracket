'use client';

import { Ticket as TicketIcon } from 'lucide-react';
import { formatMoney, ticketSaleState } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EventTicketWithSales } from './event-types';
import { fmtInTz } from './event-utils';

export function TicketCard({
  ticket,
  timezone,
  onBuy,
  className,
}: {
  ticket: EventTicketWithSales;
  timezone: string;
  onBuy?: (ticket: EventTicketWithSales) => void;
  className?: string;
}) {
  const state = ticketSaleState(ticket);
  const buyable = state === 'on_sale';
  const stateLabel: Record<typeof state, string> = {
    on_sale: 'Get ticket',
    sold_out: 'Sold out',
    not_started: 'Not on sale yet',
    ended: 'Sales ended',
    inactive: 'Unavailable',
  };

  return (
    <div
      className={cn(
        'panel-card flex flex-col gap-3 rounded-2xl p-5',
        !buyable && 'opacity-80',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--color-ink)]">
            <TicketIcon className="size-4 text-[var(--color-accent)]" />
            <span className="truncate">{ticket.name}</span>
          </h3>
          {ticket.description && (
            <p className="mt-1 whitespace-pre-line text-sm text-[var(--color-muted)]">
              {ticket.description}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-bold text-[var(--color-ink)]">
            {formatMoney(ticket.priceCents, ticket.currency)}
          </p>
          {ticket.priceCents > 0 && (
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
              {ticket.currency}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
        {ticket.remaining != null ? (
          <span>
            {ticket.remaining > 0 ? (
              <>
                <span className="font-semibold text-[var(--color-ink)]">{ticket.remaining}</span>{' '}
                left
              </>
            ) : (
              'None left'
            )}
          </span>
        ) : (
          <span>Unlimited</span>
        )}
        {ticket.salesStartAt && state === 'not_started' && (
          <span>Sales open {fmtInTz(ticket.salesStartAt, timezone, 'MMM d, h:mm a')}</span>
        )}
        {ticket.salesEndAt && state !== 'ended' && (
          <span>Until {fmtInTz(ticket.salesEndAt, timezone, 'MMM d, h:mm a')}</span>
        )}
      </div>

      {onBuy && (
        <Button
          type="button"
          disabled={!buyable}
          onClick={() => onBuy(ticket)}
          className="mt-auto w-full"
          variant={buyable ? 'primary' : 'secondary'}
        >
          {stateLabel[state]}
        </Button>
      )}
    </div>
  );
}
