'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { formatMoney } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { EventDashboard, EventDetail } from '../event-types';
import { fmtInTz } from '../event-utils';

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="panel-card rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}

export function ManageOverview({
  event,
  onNavigate,
}: {
  event: EventDetail;
  onNavigate: (tab: string) => void;
}) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: dash, isLoading } = useQuery({
    queryKey: ['event-dashboard', event.id],
    enabled: !!token,
    queryFn: () => api<EventDashboard>(`/events/${event.id}/dashboard`, { token }),
  });

  const togglePublish = useMutation({
    mutationFn: () =>
      api<EventDetail>(`/events/${event.id}/${event.isPublished ? 'unpublish' : 'publish'}`, {
        method: 'POST',
        token,
      }),
    onSuccess: (res) => {
      toast.success(res.isPublished ? 'Event published' : 'Event unpublished');
      void qc.invalidateQueries({ queryKey: ['event', event.slug] });
      void qc.invalidateQueries({ queryKey: ['event-dashboard', event.id] });
      void qc.invalidateQueries({ queryKey: ['events-mine'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/e/${event.slug}` : `/e/${event.slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  }

  const revenue = Object.entries(dash?.revenueByCurrency ?? {});

  return (
    <div className="space-y-6">
      <div className="panel-card flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
            {event.isPublished ? (
              <>
                <Eye className="size-4 text-[var(--color-ok)]" /> Published
              </>
            ) : (
              <>
                <EyeOff className="size-4 text-[#fbbf24]" /> Draft
              </>
            )}
            {!event.isPublic && (
              <span className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                Unlisted
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {event.isPublished
              ? 'Anyone with the link can view this event and buy tickets.'
              : 'Only you and event admins can see this event. Publish when ready.'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <code className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">
              {publicUrl}
            </code>
            <Button type="button" variant="ghost" className="gap-1 px-2 py-1 text-xs" onClick={copy}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Link href={`/e/${event.slug}`} className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline">
              Open <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
        <Button
          type="button"
          variant={event.isPublished ? 'secondary' : 'primary'}
          disabled={togglePublish.isPending}
          onClick={() => togglePublish.mutate()}
        >
          {togglePublish.isPending ? 'Saving…' : event.isPublished ? 'Unpublish' : 'Publish event'}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Tournaments"
          value={isLoading ? '…' : dash?.tournaments.total ?? 0}
          hint={
            dash
              ? `${dash.tournaments.in_progress} live · ${dash.tournaments.upcoming} upcoming · ${dash.tournaments.completed} done`
              : undefined
          }
        />
        <Stat
          label="Tickets sold"
          value={isLoading ? '…' : dash?.tickets.sold ?? 0}
          hint={dash ? `${dash.orders.byStatus.PENDING ?? 0} pending orders` : undefined}
        />
        <Stat
          label="Revenue"
          value={
            isLoading
              ? '…'
              : revenue.length
                ? revenue.map(([cur, cents]) => formatMoney(cents, cur)).join(' · ')
                : '—'
          }
          hint="Paid orders only"
        />
        <Stat
          label="Checked in"
          value={isLoading ? '…' : `${dash?.checkIn.checkedIn ?? 0} / ${dash?.checkIn.paidOrders ?? 0}`}
          hint={dash ? `${dash.checkIn.remaining} remaining` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel-card rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--color-ink)]">Next 24 hours</h3>
            <span className="text-xs text-[var(--color-muted)]">{dash?.upcomingMatches.length ?? 0} matches</span>
          </div>
          {!dash || dash.upcomingMatches.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No scheduled matches in the next 24 hours.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)]/60">
              {dash.upcomingMatches.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-[var(--color-ink)]">
                      {m.homeTeam?.name ?? 'TBD'} <span className="text-[var(--color-muted)]">vs</span>{' '}
                      {m.awayTeam?.name ?? 'TBD'}
                    </p>
                    <Link href={`/t/${m.tournament.slug}/manage`} className="truncate text-xs text-[var(--color-accent)] hover:underline">
                      {m.tournament.name} · R{m.round}
                    </Link>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--color-muted)]">
                    {fmtInTz(m.scheduledAt, event.timezone, 'EEE h:mm a')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-card rounded-2xl p-5">
          <h3 className="mb-3 font-semibold text-[var(--color-ink)]">Quick actions</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['tournaments', 'Add a tournament'],
              ['tickets', 'Create a ticket type'],
              ['checkin', 'Open check-in desk'],
              ['stream', 'Set stream URL'],
              ['permissions', 'Invite an admin'],
              ['setup', 'Edit details'],
            ].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => onNavigate(tab)}
                className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-left text-sm text-[var(--color-ink)] transition hover:border-[var(--color-accent)]/50"
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
