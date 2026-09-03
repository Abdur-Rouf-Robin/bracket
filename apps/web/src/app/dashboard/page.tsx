'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';

export default function DashboardPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [slugLookup, setSlugLookup] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['my-tournaments'],
    enabled: !!token,
    queryFn: () => api<Tournament[]>('/tournaments/mine', { token }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/tournaments/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-tournaments'] }),
  });

  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <p className="p-8 text-[var(--color-muted)]">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <p className="p-8 text-[var(--color-muted)]">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Your tournaments</h1>
            <p className="mt-1 text-[var(--color-muted)]">
              Welcome back, {user.name}.
            </p>
          </div>
          <Link href="/tournaments/new">
            <Button>New tournament</Button>
          </Link>
        </div>

        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (slugLookup.trim()) {
              router.push(`/t/${slugLookup.trim()}`);
            }
          }}
        >
          <input
            className="flex-1 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]/50 focus:ring-2 focus:ring-[var(--color-accent)]"
            placeholder="Open public tournament by slug"
            value={slugLookup}
            onChange={(e) => setSlugLookup(e.target.value)}
          />
          <Button type="submit" variant="secondary">
            Open
          </Button>
        </form>

        <div className="mt-8 space-y-3">
          {isLoading && (
            <p className="text-[var(--color-muted)]">Loading tournaments…</p>
          )}
          {!isLoading && (!data || data.length === 0) && (
            <p className="gaming-card rounded-lg border-dashed p-8 text-center text-[var(--color-muted)]">
              No tournaments yet. Create your first one.
            </p>
          )}
          {data?.map((t) => (
            <div
              key={t.id}
              className="gaming-card flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
            >
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm text-[var(--color-muted)]">
                  /t/{t.slug} · {t.status}
                  {t.format ? ` · ${t.format.replaceAll('_', ' ')}` : ''}
                  {t._count
                    ? ` · ${t._count.teams} teams · ${t._count.matches} matches`
                    : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/t/${t.slug}`}>
                  <Button variant="secondary">View</Button>
                </Link>
                <Link href={`/t/${t.slug}/manage`}>
                  <Button>Manage</Button>
                </Link>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete “${t.name}”?`)) {
                      deleteMutation.mutate(t.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
