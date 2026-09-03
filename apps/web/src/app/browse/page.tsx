'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { SiteHeader } from '@/components/site-header';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';

type BrowseRow = Pick<
  Tournament,
  'id' | 'name' | 'slug' | 'status' | 'format' | 'startAt' | 'game'
> & { _count?: { teams: number; matches: number } };

export default function BrowseTournamentsPage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['tournaments-browse'],
    queryFn: () => api<BrowseRow[]>('/tournaments/browse'),
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-wide text-[var(--color-muted)]">
            Discover
          </p>
          <h1 className="font-display text-4xl font-bold">Public tournaments</h1>
          <p className="mt-2 max-w-xl text-[var(--color-muted)]">
            Browse open events, follow live brackets, and register when signup is
            enabled.
          </p>
        </div>

        {isLoading && (
          <p className="text-[var(--color-muted)]">Loading tournaments…</p>
        )}
        {error && (
          <p className="text-red-700">
            {error instanceof Error ? error.message : 'Could not load list'}
          </p>
        )}

        {!isLoading && !error && data.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-[var(--color-muted)]">
            No public tournaments listed yet.
          </p>
        )}

        <ul className="space-y-3">
          {data.map((t) => (
            <li key={t.id}>
              <Link
                href={`/t/${t.slug}`}
                className="gaming-card flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4 transition hover:border-[var(--color-accent)]/40"
              >
                <div>
                  <h2 className="font-display text-lg font-bold">{t.name}</h2>
                  <p className="text-sm text-[var(--color-muted)]">
                    {t.game?.name ? `${t.game.name} · ` : ''}
                    {t.format?.replaceAll('_', ' ') ?? 'Draft'} · {t.status}
                    {t.startAt
                      ? ` · ${new Date(t.startAt).toLocaleDateString()}`
                      : ''}
                  </p>
                </div>
                <div className="text-right text-sm text-[var(--color-muted)]">
                  <p>{t._count?.teams ?? 0} participants</p>
                  <p className="font-mono text-xs">/t/{t.slug}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
