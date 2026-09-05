'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Gamepad2, Trophy, Users } from 'lucide-react';
import { FORMAT_META, bucketTournamentStatus, type TournamentFormat } from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { EventHeader } from '@/components/event/event-header';
import { StreamEmbed } from '@/components/event/stream-embed';
import { TicketCard } from '@/components/event/ticket-card';
import { TicketPurchaseDialog } from '@/components/event/ticket-purchase-dialog';
import { TournamentStatusChip } from '@/components/event/status-badge';
import type {
  EventDetail,
  EventTicketWithSales,
  EventTournamentSummary,
} from '@/components/event/event-types';
import { fmtInTz } from '@/components/event/event-utils';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function EventPublicPage() {
  return (
    <Suspense fallback={null}>
      <EventPublicPageInner />
    </Suspense>
  );
}

function EventPublicPageInner() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, loading } = useAuth();
  const [buying, setBuying] = useState<EventTicketWithSales | null>(null);

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event', slug, token ? 'auth' : 'anon'],
    enabled: !loading,
    queryFn: () => api<EventDetail>(`/e/${slug}`, { token }),
    retry: false,
  });

  useEffect(() => {
    if (searchParams.get('cancelled') === '1') {
      toast.message('Checkout cancelled — your ticket was not purchased.');
      router.replace(`/e/${slug}`);
    }
  }, [searchParams, router, slug]);

  const grouped = useMemo(() => {
    const g: Record<'upcoming' | 'in_progress' | 'completed', EventTournamentSummary[]> = {
      upcoming: [],
      in_progress: [],
      completed: [],
    };
    for (const t of event?.tournaments ?? []) g[bucketTournamentStatus(t.status)].push(t);
    return g;
  }, [event]);

  const schedule = useMemo(
    () =>
      [...(event?.tournaments ?? [])]
        .filter((t) => t.startAt)
        .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime()),
    [event],
  );

  if (isLoading || loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-6 py-10">
          <div className="gaming-card h-64 animate-pulse rounded-3xl" />
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="panel-card h-40 animate-pulse rounded-2xl lg:col-span-2" />
            <div className="panel-card h-40 animate-pulse rounded-2xl" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !event) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">
            {notFound ? 'Event not found' : 'Could not load event'}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {notFound
              ? 'It may be unpublished or the link is wrong.'
              : (error as Error | null)?.message}
          </p>
          <Link href="/events" className="mt-6 inline-block">
            <Button variant="secondary">Browse events</Button>
          </Link>
        </main>
      </div>
    );
  }

  const hasStream = !!event.streamEmbedUrl || !!event.streamUrl;
  const hasTickets = event.tickets.length > 0;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <EventHeader event={event} />

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {event.description && (
              <section className="panel-card rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-[var(--color-ink)]">About</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--color-muted)]">
                  {event.description}
                </p>
              </section>
            )}

            {hasStream && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--color-ink)]">
                  <span className="inline-block size-2 animate-pulse rounded-full bg-[var(--color-danger)]" />
                  Stream
                </h2>
                <StreamEmbed url={event.streamUrl} embedUrl={event.streamEmbedUrl} title={`${event.name} stream`} />
              </section>
            )}

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-ink)]">
                  <Trophy className="size-5 text-[var(--color-accent)]" /> Tournaments
                </h2>
                <span className="text-xs text-[var(--color-muted)]">{event.tournaments.length} total</span>
              </div>
              {event.tournaments.length === 0 ? (
                <div className="panel-card rounded-2xl px-6 py-10 text-center text-sm text-[var(--color-muted)]">
                  No tournaments announced yet.
                  {event.canManage && (
                    <>
                      {' '}
                      <Link href={`/e/${event.slug}/manage?tab=tournaments`} className="text-[var(--color-accent)] hover:underline">
                        Add one
                      </Link>
                      .
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {(
                    [
                      ['in_progress', 'In progress'],
                      ['upcoming', 'Upcoming'],
                      ['completed', 'Completed'],
                    ] as const
                  ).map(([key, label]) =>
                    grouped[key].length ? (
                      <div key={key}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                          {label} · {grouped[key].length}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {grouped[key].map((t) => (
                            <TournamentTile key={t.id} t={t} timezone={event.timezone} />
                          ))}
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-8">
            {hasTickets && (
              <section id="tickets">
                <h2 className="mb-3 text-lg font-semibold text-[var(--color-ink)]">Tickets</h2>
                <div className="space-y-3">
                  {event.tickets.map((t) => (
                    <TicketCard key={t.id} ticket={t} timezone={event.timezone} onBuy={setBuying} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Already have a ticket? Check your email for the code.
                </p>
              </section>
            )}

            {schedule.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--color-ink)]">
                  <CalendarClock className="size-5 text-[var(--color-accent)]" /> Schedule
                </h2>
                <ol className="panel-card divide-y divide-[var(--color-line)]/60 rounded-2xl">
                  {schedule.map((t) => (
                    <li key={t.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="w-16 shrink-0 text-center">
                        <p className="text-[10px] font-semibold uppercase text-[var(--color-muted)]">
                          {fmtInTz(t.startAt, event.timezone, 'EEE')}
                        </p>
                        <p className="text-lg font-bold leading-tight text-[var(--color-ink)]">
                          {fmtInTz(t.startAt, event.timezone, 'd')}
                        </p>
                        <p className="text-[10px] text-[var(--color-muted)]">
                          {fmtInTz(t.startAt, event.timezone, 'MMM')}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/t/${t.slug}`} className="block truncate text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]">
                          {t.name}
                        </Link>
                        <p className="text-xs text-[var(--color-muted)]">
                          {fmtInTz(t.startAt, event.timezone, 'h:mm a')}
                          {t.game ? ` · ${t.game.name}` : ''}
                        </p>
                      </div>
                      <TournamentStatusChip status={t.status} />
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </aside>
        </div>
      </main>

      <TicketPurchaseDialog slug={event.slug} ticket={buying} onClose={() => setBuying(null)} />
    </div>
  );
}

function TournamentTile({ t, timezone }: { t: EventTournamentSummary; timezone: string }) {
  const formatLabel = t.format ? FORMAT_META[t.format as TournamentFormat]?.label ?? t.format : 'Format TBA';
  return (
    <Link
      href={`/t/${t.slug}`}
      className="gaming-card flex flex-col gap-2 rounded-2xl p-4 transition hover:border-[var(--color-accent)]/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-semibold text-[var(--color-ink)]">{t.name}</h3>
        <TournamentStatusChip status={t.status} />
      </div>
      <p className="text-xs text-[var(--color-muted)]">{formatLabel}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-[var(--color-muted)]">
        {t.game && (
          <span className="inline-flex items-center gap-1">
            <Gamepad2 className="size-3.5" /> {t.game.name}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" /> {t._count.teams}
        </span>
        {t.startAt && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" /> {fmtInTz(t.startAt, timezone, 'MMM d, h:mm a')}
          </span>
        )}
      </div>
    </Link>
  );
}
