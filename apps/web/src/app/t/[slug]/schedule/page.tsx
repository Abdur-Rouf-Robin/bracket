'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { ScheduleTab } from '@/components/schedule/schedule-tab';
import { StationQueueBoard } from '@/components/schedule/station-queue-board';
import { icsUrl } from '@/components/schedule/schedule-shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';
import { useTournamentLive } from '@/lib/use-tournament-live';
import { cn } from '@/lib/utils';

/**
 * Standalone public schedule page.
 *  - default: calendar (list/timeline) for spectators & players
 *  - ?view=queue: full-width station queue board for TVs
 *  - ?print=1: hides site chrome for printing / kiosk
 */
export default function PublicSchedulePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const searchParams = useSearchParams();
  const view = searchParams.get('view') === 'queue' ? 'queue' : 'calendar';
  const print = searchParams.get('print') === '1';
  const { token } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tournament', slug, token ?? 'anon'],
    queryFn: () => api<Tournament>(`/t/${slug}`, { token: token ?? undefined }),
  });
  // The queue board owns the socket subscription in queue view (see `live`).
  useTournamentLive(view === 'queue' ? undefined : data?.id, slug);

  return (
    <div className={cn('min-h-screen', print && 'print-mode')}>
      {!print && <SiteHeader />}
      <main className={cn('mx-auto px-4 py-6 sm:px-6', view === 'queue' ? 'max-w-[1800px]' : 'max-w-7xl')}>
        {isLoading && <p className="text-[var(--color-muted)]">Loading…</p>}
        {error && (
          <p className="text-[var(--color-danger)]">{error instanceof Error ? error.message : 'Not found'}</p>
        )}
        {data && (
          <>
            {!print && (
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-wide text-[var(--color-muted)]">
                    <Link href={`/t/${data.slug}`} className="hover:underline">
                      {data.name}
                    </Link>
                    {data.game?.name ? ` · ${data.game.name}` : ''}
                  </p>
                  <h1 className="font-display text-3xl font-bold sm:text-4xl">
                    {view === 'queue' ? 'Station queue' : 'Schedule'}
                  </h1>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">All times in {data.timezone ?? 'UTC'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/t/${data.slug}/schedule${view === 'queue' ? '' : '?view=queue'}`}>
                    <Button variant="secondary">{view === 'queue' ? 'Calendar view' : 'Station queue (TV)'}</Button>
                  </Link>
                  <a href={icsUrl(data.slug)}>
                    <Button variant="secondary">Add to calendar (.ics)</Button>
                  </a>
                  <Link href={`/t/${data.slug}/schedule?${view === 'queue' ? 'view=queue&' : ''}print=1`}>
                    <Button variant="ghost">Print / kiosk</Button>
                  </Link>
                  <Link href={`/t/${data.slug}`}>
                    <Button variant="ghost">Back to tournament</Button>
                  </Link>
                </div>
              </div>
            )}
            {print && (
              <h1 className="mb-4 font-display text-2xl font-bold">
                {data.name} — {view === 'queue' ? 'Station queue' : 'Schedule'}
              </h1>
            )}

            {view === 'queue' ? (
              <StationQueueBoard
                tournamentId={data.id}
                slug={data.slug}
                timezone={data.timezone}
                token={token ?? undefined}
                fullWidth
                hideChrome={print}
                live
              />
            ) : (
              <ScheduleTab
                tournament={data}
                token={data.canManage ? token ?? undefined : undefined}
                mode={data.canManage && token ? 'manage' : 'public'}
                sub="calendar"
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
