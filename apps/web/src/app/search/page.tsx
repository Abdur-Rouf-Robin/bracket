'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { SEARCH_SORTS, SEARCH_STATUSES, type SearchSort, type TournamentSearchResponse } from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { api } from '@/lib/api';
import { CardSkeleton, TournamentCard, formatLabel } from '@/components/sharing/discovery-card';

const PAGE_SIZE = 24;
const SORT_LABELS: Record<SearchSort, string> = { startAt: 'Start date', newest: 'Newest', popular: 'Most participants', name: 'Name' };

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const q = sp.get('q') ?? '';
  const game = sp.get('game') ?? '';
  const format = sp.get('format') ?? '';
  const status = sp.get('status') ?? '';
  const country = sp.get('country') ?? '';
  const community = sp.get('community') ?? '';
  const sort = ((SEARCH_SORTS as readonly string[]).includes(sp.get('sort') ?? '') ? sp.get('sort') : 'startAt') as SearchSort;
  const page = Math.max(1, Number(sp.get('page')) || 1);

  const [qInput, setQInput] = useState(q);
  useEffect(() => setQInput(q), [q]);

  function setParams(patch: Record<string, string | null>, resetPage = true) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (resetPage) next.delete('page');
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (game) params.set('game', game);
  if (format) params.set('format', format);
  if (status) params.set('status', status);
  if (country) params.set('country', country);
  if (community) params.set('community', community);
  params.set('sort', sort);
  params.set('page', String(page));
  params.set('pageSize', String(PAGE_SIZE));

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['tournament-search', params.toString()],
    queryFn: () => api<TournamentSearchResponse>(`/discover/search?${params.toString()}`),
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const active = [
    q && { k: 'q', label: `“${q}”` },
    game && { k: 'game', label: data?.facets.games.find((g) => g.id === game)?.name ?? game },
    format && { k: 'format', label: formatLabel(format) },
    status && { k: 'status', label: status },
    country && { k: 'country', label: country },
    community && { k: 'community', label: community },
  ].filter(Boolean) as { k: string; label: string }[];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <form
          onSubmit={(e) => { e.preventDefault(); setParams({ q: qInput.trim() || null }); }}
          className="mb-6 flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
            <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search tournaments…" className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] py-3 pl-10 pr-3 text-sm outline-none focus:border-[var(--color-accent)]" />
          </div>
          <select className="field-select" value={sort} onChange={(e) => setParams({ sort: e.target.value })}>
            {SEARCH_SORTS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
          </select>
          <button type="submit" className="rounded-xl bg-[var(--color-accent)] px-5 text-sm font-semibold text-[#041018]">Search</button>
        </form>

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-6 text-sm">
            <FacetGroup title="Status">
              {SEARCH_STATUSES.map((s) => (
                <FacetRow key={s} label={s} count={data?.facets.statuses.find((x) => x.status === s)?.count} active={status === s} onClick={() => setParams({ status: status === s ? null : s })} />
              ))}
            </FacetGroup>
            <FacetGroup title="Game">
              {(data?.facets.games ?? []).slice(0, 12).map((g) => (
                <FacetRow key={g.id} label={g.name} count={g.count} active={game === g.id} onClick={() => setParams({ game: game === g.id ? null : g.id })} />
              ))}
              {data && !data.facets.games.length && <p className="text-xs text-[var(--color-muted)]">—</p>}
            </FacetGroup>
            <FacetGroup title="Format">
              {(data?.facets.formats ?? []).map((f) => (
                <FacetRow key={f.format} label={formatLabel(f.format)} count={f.count} active={format === f.format} onClick={() => setParams({ format: format === f.format ? null : f.format })} />
              ))}
              {data && !data.facets.formats.length && <p className="text-xs text-[var(--color-muted)]">—</p>}
            </FacetGroup>
            <FacetGroup title="Country">
              <input value={country} onChange={(e) => setParams({ country: e.target.value.toUpperCase().slice(0, 2) || null })} placeholder="e.g. US" maxLength={2} className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5 font-mono text-xs uppercase" />
            </FacetGroup>
          </aside>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--color-muted)]">
              <p>{data ? `${data.total} tournament${data.total === 1 ? '' : 's'}` : 'Searching…'}{isFetching && data ? ' · updating' : ''}</p>
              {active.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {active.map((a) => (
                    <button key={a.k} type="button" onClick={() => setParams({ [a.k]: null })} className="flex items-center gap-1 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-xs hover:border-[var(--color-accent)]">
                      {a.label} <X className="h-3 w-3" />
                    </button>
                  ))}
                  <button type="button" onClick={() => router.replace(pathname)} className="text-xs text-[var(--color-accent)] hover:underline">Clear all</button>
                </div>
              )}
            </div>
            {error && <p className="text-red-500">{error instanceof Error ? error.message : 'Search failed'}</p>}
            {isLoading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}</div>}
            {data && data.items.length === 0 && (
              <p className="rounded-xl border border-dashed border-[var(--color-line)] p-10 text-center text-[var(--color-muted)]">No tournaments match these filters.</p>
            )}
            {data && data.items.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((t) => <TournamentCard key={t.id} t={t} />)}
              </div>
            )}
            {data && totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-2 text-sm">
                <button type="button" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) }, false)} className="rounded-md border border-[var(--color-line)] p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-[var(--color-muted)]">Page {page} of {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setParams({ page: String(page + 1) }, false)} className="rounded-md border border-[var(--color-line)] p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </nav>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function FacetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FacetRow({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left capitalize transition ${active ? 'bg-[var(--color-accent)]/15 font-semibold text-[var(--color-accent)]' : 'hover:bg-[var(--color-surface)]'}`}>
      <span className="truncate">{label}</span>
      {count != null && <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">{count}</span>}
    </button>
  );
}
