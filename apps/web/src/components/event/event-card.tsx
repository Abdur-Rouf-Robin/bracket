'use client';

import Link from 'next/link';
import { CalendarDays, MapPin, Radio, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EventListItem } from './event-types';
import { formatEventDateRange } from './event-utils';

export function EventCard({
  event,
  href,
  manage,
  className,
}: {
  event: EventListItem;
  /** Defaults to the public page. */
  href?: string;
  /** Show draft/published state (for "Your events"). */
  manage?: boolean;
  className?: string;
}) {
  const target = href ?? `/e/${event.slug}`;
  const venue =
    event.venueType === 'ONLINE'
      ? 'Online'
      : event.venueName || event.venueAddress || null;

  return (
    <Link
      href={target}
      className={cn(
        'gaming-card group flex flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:border-[var(--color-accent)]/50',
        className,
      )}
    >
      <div className="relative h-36 w-full overflow-hidden bg-[var(--color-surface)]">
        {event.bannerUrl ? (
          <img
            src={event.bannerUrl}
            alt=""
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="size-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent)_35%,transparent),color-mix(in_srgb,var(--color-accent-glow)_35%,transparent))]" />
        )}
        {event.logoUrl && (
          <img
            src={event.logoUrl}
            alt=""
            className="absolute bottom-3 left-3 size-12 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] object-cover shadow"
          />
        )}
        {manage && (
          <span
            className={cn(
              'absolute right-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur',
              event.isPublished
                ? 'border-[var(--color-ok)]/40 bg-[color-mix(in_srgb,var(--color-ok)_25%,black)] text-[var(--color-ok)]'
                : 'border-[var(--color-line)] bg-black/50 text-[var(--color-muted)]',
            )}
          >
            {event.isPublished ? 'Published' : 'Draft'}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold text-[var(--color-ink)]">
          {event.name}
        </h3>
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <CalendarDays className="size-3.5 shrink-0" />
          <span className="truncate">
            {formatEventDateRange(event.startAt, event.endAt, event.timezone, {
              short: true,
            })}
          </span>
        </p>
        {venue && (
          <p className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            {event.venueType === 'ONLINE' ? (
              <Radio className="size-3.5 shrink-0" />
            ) : (
              <MapPin className="size-3.5 shrink-0" />
            )}
            <span className="truncate">{venue}</span>
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <Trophy className="size-3.5" />
            {event._count.tournaments} tournament{event._count.tournaments === 1 ? '' : 's'}
          </span>
          {event.community && (
            <span className="inline-flex max-w-[55%] items-center gap-1.5 truncate rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
              {event.community.logoUrl && (
                <img src={event.community.logoUrl} alt="" className="size-3.5 rounded-full object-cover" />
              )}
              <span className="truncate">{event.community.name}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="gaming-card animate-pulse overflow-hidden rounded-2xl">
      <div className="h-36 bg-[var(--color-surface)]" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 rounded bg-[var(--color-surface)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--color-surface)]" />
        <div className="h-3 w-2/3 rounded bg-[var(--color-surface)]" />
      </div>
    </div>
  );
}
