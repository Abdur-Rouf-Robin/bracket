'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search } from 'lucide-react';
import type { SearchFacets, SearchResultItem } from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { api } from '@/lib/api';
import { CardSkeleton, TournamentCard, formatLabel } from '@/components/sharing/discovery-card';

type Landing = { live: SearchResultItem[]; upcoming: SearchResultItem[]; completed: SearchResultItem[]; facets: SearchFacets };

/** Discovery landing: hero search, quick filter chips and three rails. */
export default function BrowsePage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['discover-landing'],
    queryFn: () => api<Landing>('/discover/landing'),
    staleTime: 30_000,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
  }

  const empty = data && !data.live.length && !data.upcoming.length && !data.completed.length;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="gaming-card relative mb-10 overflow-hidden rounded-3xl px-6 py-12 text-center md:px-12">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--color-accent)_0%,transparent_60%)] opacity-20" />
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-muted)]">Discover</p>
          <h1 className="font-display mt-2 text-4xl font-bold md:text-5xl">Find a tournament</h1>
          <p className="mx-auto mt-2 max-w-xl text-[var(--color-muted)]">Follow live brackets, browse upcoming events near you, or relive recent finals.</p>
          <form onSubmit={submit} className="mx-auto mt-6 flex max-w-xl gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, game, community…"
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] py-3 pl-10 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <button type="submit" className="rounded-xl bg-[var(--color-accent)] px-5 text-sm font-semibold text-[#041018]">Search</button>
          </form>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Chip href="/search?status=live" label="Live now" tone="live" />
            <Chip href="/search?status=upcoming" label="Upcoming" />
            <Chip href="/search?status=completed" label="Completed" />
            {(data?.facets.games ?? []).slice(0, 6).map((g) => (
              <Chip key={g.id} href={`/search?game=${encodeURIComponent(g.id)}`} label={`${g.name} (${g.count})`} />
            ))}
            {(data?.facets.formats ?? []).slice(0, 4).map((f) => (
              <Chip key={f.format} href={`/search?format=${encodeURIComponent(f.format)}`} label={formatLabel(f.format)} />
            ))}
          </div>
        </section>

        {error && <p className="text-red-500">{error instanceof Error ? error.message : 'Could not load tournaments'}</p>}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        )}
        {empty && (
          <p className="rounded-xl border border-dashed border-[var(--color-line)] p-10 text-center text-[var(--color-muted)]">
            No public tournaments yet. <Link href="/tournaments/new" className="text-[var(--color-accent)] hover:underline">Create the first one</Link>.
          </p>
        )}
        {data && data.live.length > 0 && <Rail title="Live now" href="/search?status=live" items={data.live} live />}
        {data && data.upcoming.length > 0 && <Rail title="Upcoming" href="/search?status=upcoming&sort=startAt" items={data.upcoming} />}
        {data && data.completed.length > 0 && <Rail title="Recently completed" href="/search?status=completed&sort=newest" items={data.completed} />}
      </main>
    </div>
  );
}

function Chip({ href, label, tone }: { href: string; label: string; tone?: 'live' }) {
  return (
    <Link
      href={href}
      className={`choice-btn rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:border-[var(--color-accent)] ${tone === 'live' ? 'border-emerald-500/40 text-emerald-500' : 'border-[var(--color-line)]'}`}
    >
      {label}
    </Link>
  );
}

function Rail({ title, href, items, live }: { title: string; href: string; items: SearchResultItem[]; live?: boolean }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display flex items-center gap-2 text-2xl font-bold">
          {live && <span className="relative inline-flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>}
          {title}
        </h2>
        <Link href={href} className="flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline">See all <ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.slice(0, 8).map((t) => <TournamentCard key={t.id} t={t} />)}
      </div>
    </section>
  );
}
