'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Search } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EventCard, EventCardSkeleton } from '@/components/event/event-card';
import type { EventListItem, EventListResponse } from '@/components/event/event-types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 24;

export default function EventsPage() {
  const { user, token } = useAuth();
  const [q, setQ] = useState('');
  const [upcoming, setUpcoming] = useState(true);
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (upcoming) params.set('upcoming', '1');
  params.set('page', String(page));
  params.set('pageSize', String(PAGE_SIZE));

  const { data, isLoading, isError } = useQuery({
    queryKey: ['events', params.toString()],
    queryFn: () => api<EventListResponse>(`/events?${params.toString()}`),
  });

  const { data: mine } = useQuery({
    queryKey: ['events-mine'],
    enabled: !!token,
    queryFn: () => api<EventListItem[]>('/events/mine', { token }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
              Events
            </p>
            <h1 className="mt-1 text-3xl font-bold text-[var(--color-ink)]">
              Multi-tournament events
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
              LANs, conventions and online festivals — one hub for every bracket, ticket and
              stream.
            </p>
          </div>
          <Link href={user ? '/events/new' : '/login'}>
            <Button className="gap-2">
              <CalendarPlus className="size-4" /> Create an event
            </Button>
          </Link>
        </div>

        {user && mine && mine.length > 0 && (
          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--color-ink)]">Your events</h2>
              <span className="text-xs text-[var(--color-muted)]">{mine.length} total</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {mine.slice(0, 8).map((e) => (
                <EventCard key={e.id} event={e} href={`/e/${e.slug}/manage`} manage />
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search events, venues…"
                className="pl-9"
              />
            </div>
            <div className="inline-flex overflow-hidden rounded-md border border-[var(--color-line)] text-sm">
              <button
                type="button"
                onClick={() => {
                  setUpcoming(true);
                  setPage(1);
                }}
                className={cn(
                  'px-4 py-2 transition',
                  upcoming
                    ? 'bg-[var(--color-accent)] font-semibold text-[#041018]'
                    : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-ink)]',
                )}
              >
                Upcoming
              </button>
              <button
                type="button"
                onClick={() => {
                  setUpcoming(false);
                  setPage(1);
                }}
                className={cn(
                  'px-4 py-2 transition',
                  !upcoming
                    ? 'bg-[var(--color-accent)] font-semibold text-[#041018]'
                    : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-ink)]',
                )}
              >
                All
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => <EventCardSkeleton key={i} />)}
            {data?.items.map((e) => <EventCard key={e.id} event={e} />)}
          </div>

          {isError && (
            <p className="mt-6 text-sm text-[var(--color-danger)]">
              Could not load events. Is the API running?
            </p>
          )}

          {!isLoading && data && data.items.length === 0 && (
            <div className="panel-card mt-6 rounded-2xl px-6 py-14 text-center">
              <p className="text-lg font-semibold text-[var(--color-ink)]">No events found</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {q ? 'Try a different search.' : upcoming ? 'Nothing upcoming yet — check "All".' : 'Be the first to host one.'}
              </p>
              <Link href={user ? '/events/new' : '/login'} className="mt-4 inline-block">
                <Button variant="secondary">Create an event</Button>
              </Link>
            </div>
          )}

          {data && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3 text-sm">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-[var(--color-muted)]">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
