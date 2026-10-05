'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type CircuitRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  _count: { tournaments: number };
};

export default function CircuitsPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['circuits'],
    queryFn: () => api<CircuitRow[]>('/circuits'),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="container-page flex-1 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">Circuits</p>
            <h1 className="font-display mt-2 text-4xl font-bold">A season of tournaments</h1>
            <p className="mt-3 max-w-2xl text-[var(--color-muted)]">
              Add the events you already run. Finish positions become season points, 25 for first down to 1.
            </p>
          </div>
          <Button asChild>
            <Link href="/circuits/new">New circuit</Link>
          </Button>
        </div>
        {isLoading && <p className="mt-10 text-sm text-[var(--color-muted)]">Loading circuits…</p>}
        {!isLoading && data.length === 0 && (
          <p className="mt-10 text-sm text-[var(--color-muted)]">No public circuits yet.</p>
        )}
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {data.map((circuit) => (
            <li key={circuit.id} className="card p-5">
              <Link href={`/circuits/${circuit.slug}`} className="font-display text-xl font-semibold">
                {circuit.name}
              </Link>
              {circuit.description && (
                <p className="mt-2 line-clamp-3 text-sm text-[var(--color-muted)]">{circuit.description}</p>
              )}
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                {circuit._count.tournaments} tournament{circuit._count.tournaments === 1 ? '' : 's'}
              </p>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
