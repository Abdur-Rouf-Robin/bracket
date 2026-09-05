'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { COMMUNITY_SORT_OPTIONS, COUNTRY_OPTIONS, type CommunitySort } from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CommunityCard, CommunityCardSkeleton } from '@/components/community/community-card';
import type {
  CommunityListResponse,
  Game,
  MyCommunity,
} from '@/components/community/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { CommunityRole } from '@/lib/types-platform';

const SORT_LABELS: Record<CommunitySort, string> = {
  popular: 'Most popular',
  newest: 'Newest',
  active: 'Most active',
};

const PAGE_SIZE = 24;

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const ROLE_GROUPS: { key: string; label: string; match: (c: MyCommunity) => boolean }[] = [
  { key: 'owned', label: 'You own', match: (c) => c.viewerRole === 'OWNER' },
  {
    key: 'staff',
    label: 'You help run',
    match: (c) => c.viewerRole === 'ADMIN' || c.viewerRole === 'COLLABORATOR',
  },
  { key: 'affiliate', label: 'You are an affiliate of', match: (c) => c.viewerRole === 'AFFILIATE' },
  { key: 'following', label: 'You follow', match: (c) => !c.viewerRole && c.isFollowing },
];

export default function CommunitiesPage() {
  const { token, user } = useAuth();
  const [q, setQ] = useState('');
  const [game, setGame] = useState('');
  const [country, setCountry] = useState('');
  const [sort, setSort] = useState<CommunitySort>('popular');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q);

  const params = new URLSearchParams();
  if (debouncedQ) params.set('q', debouncedQ);
  if (game) params.set('game', game);
  if (country) params.set('country', country);
  params.set('sort', sort);
  params.set('page', String(page));
  params.set('pageSize', String(PAGE_SIZE));

  const { data, isLoading, error } = useQuery({
    queryKey: ['communities', params.toString()],
    queryFn: () => api<CommunityListResponse>(`/communities?${params.toString()}`),
  });

  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => api<Game[]>('/games'),
  });

  const { data: mine = [], isLoading: mineLoading } = useQuery({
    queryKey: ['communities-mine'],
    enabled: !!token,
    queryFn: () => api<MyCommunity[]>('/communities/mine', { token }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const gameOptions = useMemo(
    () => games.map((g) => ({ value: g.id, label: g.name })),
    [games],
  );
  const countryOptions = useMemo(
    () => COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.name })),
    [],
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-[var(--color-muted)]">Discover</p>
            <h1 className="font-display text-4xl font-bold">Communities</h1>
            <p className="mt-2 max-w-xl text-[var(--color-muted)]">
              Find organizers, leagues, clubs and friend groups running tournaments. Follow to get
              announcements, or start your own.
            </p>
          </div>
          <Link href={user ? '/communities/new' : '/login?next=/communities/new'}>
            <Button className="gap-2">
              <Plus className="size-4" /> Start a community
            </Button>
          </Link>
        </div>

        {token && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-bold">Your communities</h2>
            {mineLoading ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <CommunityCardSkeleton key={i} />
                ))}
              </div>
            ) : mine.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">
                You are not part of any community yet. Follow one below or{' '}
                <Link href="/communities/new" className="text-[var(--color-accent)] underline">
                  start your own
                </Link>
                .
              </p>
            ) : (
              <div className="mt-4 space-y-6">
                {ROLE_GROUPS.map((group) => {
                  const items = mine.filter(group.match);
                  if (items.length === 0) return null;
                  return (
                    <div key={group.key}>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        {group.label}
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {items.map((c) => (
                          <CommunityCard
                            key={c.id}
                            community={c}
                            viewerRole={c.viewerRole as CommunityRole | null}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="mt-10">
          <div className="panel-card grid gap-3 rounded-2xl p-4 md:grid-cols-[1fr_200px_200px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search communities"
                className="pl-9"
              />
            </div>
            <Select
              value={game}
              onChange={(v) => {
                setGame(v);
                setPage(1);
              }}
              placeholder="All games"
              options={gameOptions}
            />
            <Select
              value={country}
              onChange={(v) => {
                setCountry(v);
                setPage(1);
              }}
              placeholder="All countries"
              options={countryOptions}
            />
            <Select
              value={sort}
              onChange={(v) => {
                setSort((v || 'popular') as CommunitySort);
                setPage(1);
              }}
              options={COMMUNITY_SORT_OPTIONS.map((s) => ({ value: s, label: SORT_LABELS[s] }))}
            />
          </div>

          <div className="mt-6 flex items-center justify-between text-sm text-[var(--color-muted)]">
            <span>{data ? `${data.total} ${data.total === 1 ? 'community' : 'communities'}` : ''}</span>
            {totalPages > 1 && (
              <span>
                Page {page} of {totalPages}
              </span>
            )}
          </div>

          {error && (
            <p className="mt-4 text-[var(--color-danger)]">
              {error instanceof Error ? error.message : 'Could not load communities'}
            </p>
          )}

          {isLoading ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <CommunityCardSkeleton key={i} />
              ))}
            </div>
          ) : data && data.items.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-line)] p-12 text-center">
              <p className="font-display text-lg font-bold">No communities match</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Try a different search, or be the first to start one.
              </p>
              <Link href="/communities/new" className="mt-4 inline-block">
                <Button variant="secondary">Start a community</Button>
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data?.items.map((c) => <CommunityCard key={c.id} community={c} />)}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
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
