'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search, Settings2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { communityRoleAtLeast } from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RankingSettingsEditor } from '@/components/community/ranking-settings-editor';
import { RankingTable, RankingTableSkeleton } from '@/components/community/ranking-table';
import {
  formatDate,
  formatDateTime,
  initialsOf,
  type RankingEntryDetail,
  type RankingPagePayload,
} from '@/components/community/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { RankingEntry } from '@/lib/types-platform';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

export default function RankingPage() {
  const params = useParams<{ slug: string; id: string }>();
  const { slug, id } = params;
  const { token } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RankingEntry | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const sp = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (debouncedQ) sp.set('q', debouncedQ);

  const { data, isLoading, error } = useQuery({
    queryKey: ['ranking', id, sp.toString(), token ?? 'anon'],
    queryFn: () => api<RankingPagePayload>(`/rankings/${id}?${sp.toString()}`, { token: token ?? undefined }),
  });

  const isAdmin = communityRoleAtLeast(data?.viewerRole ?? null, 'ADMIN');

  const recompute = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; matches: number; applied: number; skipped: number; entries: number }>(
        `/rankings/${id}/recompute`,
        { method: 'POST', token, timeoutMs: 120000 },
      ),
    onSuccess: (r) => {
      toast.success(`Recomputed: ${r.applied} matches applied, ${r.entries} players rated`);
      void qc.invalidateQueries({ queryKey: ['ranking', id] });
      setSelected(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Recompute failed'),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Link href={`/c/${slug}?tab=rankings`} className="text-sm text-[var(--color-muted)] hover:underline">
          ← {data?.community.name ?? 'Community'} rankings
        </Link>

        {error && (
          <p className="mt-4 text-[var(--color-danger)]">
            {error instanceof Error ? error.message : 'Could not load ranking'}
          </p>
        )}

        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            {isLoading || !data ? (
              <div className="h-9 w-64 animate-pulse rounded bg-[var(--color-surface)]" />
            ) : (
              <>
                <h1 className="font-display text-3xl font-bold">{data.ranking.name}</h1>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {data.ranking.game?.name ? `${data.ranking.game.name} · ` : ''}
                  {data.ranking._count.entries} rated · {data.ranking._count.tournaments} tournaments
                  {data.ranking.startAt || data.ranking.endAt
                    ? ` · ${data.ranking.startAt ? formatDate(data.ranking.startAt) : '…'} – ${
                        data.ranking.endAt ? formatDate(data.ranking.endAt) : 'ongoing'
                      }`
                    : ''}
                  {!data.ranking.isActive && ' · Inactive'}
                </p>
                {data.ranking.description && (
                  <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
                    {data.ranking.description}
                  </p>
                )}
              </>
            )}
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => setShowSettings((v) => !v)}
              >
                <Settings2 className="size-4" /> Settings
              </Button>
              <Button
                variant="secondary"
                className="gap-2"
                disabled={recompute.isPending}
                onClick={() => {
                  if (confirm('Recompute wipes all ratings and replays every completed match. Continue?')) {
                    recompute.mutate();
                  }
                }}
              >
                <RefreshCw className={cn('size-4', recompute.isPending && 'animate-spin')} />
                {recompute.isPending ? 'Recomputing…' : 'Recompute'}
              </Button>
            </div>
          )}
        </div>

        {isAdmin && showSettings && data && (
          <RankingSettingsEditor
            ranking={data.ranking}
            onSaved={() => {
              setShowSettings(false);
              void qc.invalidateQueries({ queryKey: ['ranking', id] });
            }}
          />
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search players"
                  className="pl-9"
                />
              </div>
              {data && data.total > 0 && (
                <p className="text-xs text-[var(--color-muted)]">
                  {data.total} players{totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
                </p>
              )}
            </div>
            {isLoading || !data ? (
              <RankingTableSkeleton />
            ) : (
              <RankingTable
                entries={data.entries}
                onSelect={(e) => setSelected(e)}
                selectedId={selected?.id}
              />
            )}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
            {data && data.tournaments.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-2 font-display text-base font-bold">Counting tournaments</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {data.tournaments.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/t/${t.slug}`}
                        className="panel-card flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:border-[var(--color-accent)]/40"
                      >
                        <span className="truncate">{t.name}</span>
                        <span className="shrink-0 text-xs text-[var(--color-muted)]">
                          {t.status === 'ACTIVE' ? 'Live' : t.status === 'COMPLETED' ? 'Done' : 'Upcoming'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="hidden lg:block">
            {selected ? (
              <EntryPanel rankingId={id} entry={selected} onClose={() => setSelected(null)} />
            ) : (
              <div className="panel-card rounded-xl p-6 text-center text-sm text-[var(--color-muted)]">
                Select a player to see their rating history.
              </div>
            )}
          </aside>
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/60 lg:hidden" onClick={() => setSelected(null)}>
            <div
              className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-[var(--color-paper)] p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <EntryPanel rankingId={id} entry={selected} onClose={() => setSelected(null)} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function EntryPanel({
  rankingId,
  entry,
  onClose,
}: {
  rankingId: string;
  entry: RankingEntry;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['ranking-entry', rankingId, entry.id],
    queryFn: () =>
      api<RankingEntryDetail>(`/rankings/${rankingId}/entries/${entry.id}`, {
        token: token ?? undefined,
      }),
  });
  const name = entry.user?.name ?? entry.displayName;
  const chart = (data?.history ?? []).map((h, i) => ({
    i: i + 1,
    rating: Math.round(h.ratingAfter),
    label: `${h.result} vs ${h.opponentName ?? '?'}`,
    date: formatDate(h.createdAt),
  }));

  return (
    <div className="panel-card rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface)] font-bold">
            {entry.user?.avatarUrl ? (
              <img src={entry.user.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              initialsOf(name)
            )}
          </div>
          <div>
            <p className="font-display text-lg font-bold">{name}</p>
            <p className="text-xs text-[var(--color-muted)]">
              Rank #{data?.rank ?? entry.rank ?? '—'} · Peak {Math.round(entry.peakRating)}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          <X className="size-5" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Mini label="Rating" value={Math.round(entry.rating)} />
        <Mini label="Wins" value={entry.wins} tone="ok" />
        <Mini label="Losses" value={entry.losses} tone="danger" />
        <Mini label="Draws" value={entry.draws} />
      </div>

      <div className="mt-4 h-44">
        {isLoading ? (
          <div className="size-full animate-pulse rounded bg-[var(--color-surface)]" />
        ) : chart.length < 2 ? (
          <p className="flex h-full items-center justify-center text-xs text-[var(--color-muted)]">
            Not enough matches for a chart yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
              <XAxis dataKey="i" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--color-muted)' }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-line)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { label?: string; date?: string } | undefined;
                  return p ? `${p.label} · ${p.date}` : '';
                }}
              />
              <Line
                type="monotone"
                dataKey="rating"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Recent matches
      </h4>
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
        {(data?.history ?? [])
          .slice()
          .reverse()
          .slice(0, 25)
          .map((h) => (
            <li key={h.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[var(--color-surface)]">
              <span
                className={cn(
                  'w-5 text-center font-mono text-xs font-bold',
                  h.result === 'W' && 'text-[var(--color-ok)]',
                  h.result === 'L' && 'text-[var(--color-danger)]',
                  h.result === 'D' && 'text-[var(--color-muted)]',
                )}
              >
                {h.result}
              </span>
              <span className="flex-1 truncate">
                vs {h.opponentName ?? 'Unknown'}
                {h.tournament && (
                  <span className="text-xs text-[var(--color-muted)]"> · {h.tournament.name}</span>
                )}
              </span>
              <span
                className={cn(
                  'font-mono text-xs',
                  h.delta > 0 ? 'text-[var(--color-ok)]' : h.delta < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-muted)]',
                )}
              >
                {h.delta > 0 ? '+' : ''}
                {Math.round(h.delta)}
              </span>
              <span className="w-24 text-right text-[11px] text-[var(--color-muted)]">
                {formatDateTime(h.createdAt)}
              </span>
            </li>
          ))}
        {data && data.history.length === 0 && (
          <li className="text-xs text-[var(--color-muted)]">No matches yet.</li>
        )}
      </ul>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'danger' }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface)] px-2 py-2">
      <p
        className={cn(
          'font-mono text-base font-bold',
          tone === 'ok' && 'text-[var(--color-ok)]',
          tone === 'danger' && 'text-[var(--color-danger)]',
        )}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
    </div>
  );
}
