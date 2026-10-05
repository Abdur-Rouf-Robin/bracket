'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type GameRow = { id: string; name: string; category: string; slug: string | null };

export default function GamesPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['games'],
    queryFn: () => api<GameRow[]>('/games'),
  });
  const groups = new Map<string, GameRow[]>();
  for (const game of data) {
    const list = groups.get(game.category) ?? [];
    list.push(game);
    groups.set(game.category, list);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="container-page flex-1 py-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">Games</p>
        <h1 className="font-display mt-2 text-4xl font-bold">Pick a game, start a tournament</h1>
        <p className="mt-3 max-w-2xl text-[var(--color-muted)]">
          The catalog is the games Bracket already scores. Choose one when you create a tournament and the rules preset comes with it.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/tournaments/new">Create a tournament</Link>
          </Button>
        </div>
        {isLoading && <p className="mt-10 text-sm text-[var(--color-muted)]">Loading games…</p>}
        <div className="mt-10 space-y-10">
          {[...groups.entries()].map(([category, games]) => (
            <section key={category}>
              <h2 className="font-display text-xl font-semibold">{category}</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {games.map((game) => (
                  <li key={game.id} className="card p-4">
                    <p className="font-semibold">{game.name}</p>
                    <Link href={`/tournaments/new?game=${game.id}`} className="mt-2 inline-block text-sm text-[var(--color-accent)]">
                      Host this game
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
