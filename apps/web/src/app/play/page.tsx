'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, Trophy } from 'lucide-react';
import type { PlayerHubItem } from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function PlayPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/play');
  }, [loading, user, router]);

  const { data = [], isLoading } = useQuery({
    queryKey: ['play-hub'],
    enabled: !!token,
    queryFn: () => api<PlayerHubItem[]>('/account/play', { token }),
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Playing
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">What do I do now?</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Your next match, check-in and score reporting — one screen per tournament.
        </p>

        {isLoading && <p className="mt-8 text-sm text-[var(--color-muted)]">Loading your matches…</p>}

        {!isLoading && data.length === 0 && (
          <div className="gaming-card mt-8 rounded-2xl p-6 text-center">
            <p className="font-semibold">You are not in an active tournament</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Register on a public tournament page, or open the private link the organizer sent
              you.
            </p>
            <Link href="/browse" className="mt-4 inline-block">
              <Button variant="secondary">Browse tournaments</Button>
            </Link>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {data.map((row) => (
            <PlayCard key={row.team.id} row={row} token={token} />
          ))}
        </div>
      </main>
    </div>
  );
}

function PlayCard({ row, token }: { row: PlayerHubItem; token?: string | null }) {
  const qc = useQueryClient();
  const checkIn = useMutation({
    mutationFn: () =>
      api(`/t/${row.tournament.slug}/check-in`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success('You are checked in');
      void qc.invalidateQueries({ queryKey: ['play-hub'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const next = row.nextMatch;
  let action = 'Waiting for the organizer.';
  if (row.tournament.status === 'DRAFT') action = 'Waiting for the bracket to be generated.';
  else if (row.canCheckIn) action = 'Check in so you can play.';
  else if (next && row.canReportScore) action = `Report the score vs ${next.opponent?.name ?? 'your opponent'}.`;
  else if (next) action = `Play ${next.opponent?.name ?? 'TBD'}${next.station ? ` at ${next.station}` : ''}.`;
  else if (row.tournament.status === 'ACTIVE') action = 'No upcoming match right now.';

  return (
    <section className="gaming-card rounded-2xl p-5">
      <div className="flex items-start gap-3">
        {row.tournament.logoUrl ? (
          <img src={row.tournament.logoUrl} alt="" className="size-12 rounded-xl object-cover" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--color-surface)]">
            <Trophy className="size-5 text-[var(--color-accent)]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-[var(--color-muted)]">{row.tournament.name}</p>
          <h2 className="font-display truncate text-lg font-bold">{row.team.name}</h2>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium">{action}</p>
      {next && (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
          <span>{next.roundLabel}</span>
          {next.station && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {next.station}
            </span>
          )}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        {row.canCheckIn && (
          <Button type="button" disabled={checkIn.isPending} onClick={() => checkIn.mutate()}>
            {checkIn.isPending ? 'Checking in…' : 'Check in'}
          </Button>
        )}
        {next && row.canReportScore && (
          <Link href={`/t/${row.tournament.slug}/m/${next.id}`}>
            <Button className="w-full">Report score</Button>
          </Link>
        )}
        <Link href={`/t/${row.tournament.slug}`}>
          <Button variant="secondary" className="w-full">
            Tournament page
          </Button>
        </Link>
      </div>
    </section>
  );
}
