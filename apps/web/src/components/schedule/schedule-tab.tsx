'use client';

import Link from 'next/link';
import type { Tournament } from '@/lib/types';
import { CalendarView } from './calendar-view';
import { GeneratePanel } from './generate-panel';
import { RefereesPanel } from './referees-panel';
import { StationQueueBoard } from './station-queue-board';
import { StationsPanel } from './stations-panel';

/**
 * Schedule tab (calendar, stations, station queue, referees, auto-schedule).
 * Rendered for both public and manage modes; manager-only subs fall back to
 * the calendar when no token is present.
 */
export function ScheduleTab({
  tournament,
  token,
  mode,
  sub,
}: {
  tournament: Tournament;
  token?: string;
  mode: 'public' | 'manage';
  sub: string;
}) {
  const manage = mode === 'manage' && !!token;
  const basePath = manage ? `/t/${tournament.slug}/manage` : `/t/${tournament.slug}`;

  switch (sub) {
    case 'stations':
      return <StationsPanel tournament={tournament} token={token} mode={mode} />;
    case 'queue':
      return (
        <div className="space-y-3">
          <StationQueueBoard
            tournamentId={tournament.id}
            slug={tournament.slug}
            timezone={tournament.timezone}
            token={token}
          />
          <p className="text-xs text-[var(--color-muted)]">
            TV / big-screen version:{' '}
            <Link href={`/t/${tournament.slug}/schedule?view=queue`} className="text-[var(--color-accent)] hover:underline">
              /t/{tournament.slug}/schedule?view=queue
            </Link>
          </p>
        </div>
      );
    case 'referees':
      if (manage) return <RefereesPanel tournament={tournament} token={token!} />;
      return <CalendarView tournament={tournament} token={token} mode={mode} basePath={basePath} />;
    case 'generate':
      if (manage) return <GeneratePanel tournament={tournament} token={token!} basePath={basePath} />;
      return <CalendarView tournament={tournament} token={token} mode={mode} basePath={basePath} />;
    case 'calendar':
    default:
      return <CalendarView tournament={tournament} token={token} mode={mode} basePath={basePath} />;
  }
}
