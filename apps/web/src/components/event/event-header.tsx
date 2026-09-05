'use client';

import Link from 'next/link';
import { CalendarDays, ExternalLink, Globe, MapPin, Radio, Settings } from 'lucide-react';
import { venueMapsUrl } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import type { EventDetail } from './event-types';
import { formatEventDateRange } from './event-utils';

export function EventHeader({ event }: { event: EventDetail }) {
  const mapsUrl =
    event.venueType === 'PHYSICAL'
      ? venueMapsUrl(event.venueName, event.venueAddress)
      : null;

  return (
    <header className="gaming-card overflow-hidden rounded-3xl">
      <div className="relative h-48 w-full bg-[var(--color-surface)] sm:h-64">
        {event.bannerUrl ? (
          <img src={event.bannerUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent)_40%,transparent),color-mix(in_srgb,var(--color-accent-glow)_40%,transparent))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-card)] via-transparent to-transparent" />
        {!event.isPublished && (
          <span className="absolute left-4 top-4 rounded-full border border-[#fbbf24]/40 bg-black/60 px-3 py-1 text-xs font-semibold text-[#fbbf24] backdrop-blur">
            Draft — only managers can see this
          </span>
        )}
      </div>

      <div className="relative -mt-12 flex flex-col gap-4 px-5 pb-6 sm:flex-row sm:items-end sm:px-8">
        <div className="size-24 shrink-0 overflow-hidden rounded-2xl border-2 border-[var(--color-line)] bg-[var(--color-card)] shadow-lg sm:size-28">
          {event.logoUrl ? (
            <img src={event.logoUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-3xl font-black text-[var(--color-accent)]">
              {event.name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--color-ink)] sm:text-3xl">
              {event.name}
            </h1>
            {event.community && (
              <Link
                href={`/c/${event.community.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-ink)]"
              >
                {event.community.logoUrl && (
                  <img src={event.community.logoUrl} alt="" className="size-4 rounded-full object-cover" />
                )}
                {event.community.name}
              </Link>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {formatEventDateRange(event.startAt, event.endAt, event.timezone, {
                withZone: true,
              })}
            </span>
            {event.venueType === 'ONLINE' && (
              <span className="inline-flex items-center gap-1.5">
                <Radio className="size-4" />
                Online
                {event.venueUrl && (
                  <a
                    href={event.venueUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
                  >
                    {event.venueName || 'Join link'} <ExternalLink className="size-3" />
                  </a>
                )}
              </span>
            )}
            {event.venueType === 'PHYSICAL' && (event.venueName || event.venueAddress) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" />
                <span>
                  {event.venueName}
                  {event.venueName && event.venueAddress ? ' · ' : ''}
                  {event.venueAddress}
                </span>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
                  >
                    Map <ExternalLink className="size-3" />
                  </a>
                )}
              </span>
            )}
            {event.venueType !== 'ONLINE' && event.venueUrl && (
              <a
                href={event.venueUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[var(--color-accent)] hover:underline"
              >
                <Globe className="size-4" /> Website
              </a>
            )}
          </div>
        </div>

        {event.canManage && (
          <Link href={`/e/${event.slug}/manage`} className="shrink-0">
            <Button variant="secondary" className="gap-2">
              <Settings className="size-4" /> Manage
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
