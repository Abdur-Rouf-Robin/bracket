'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type CircuitDetail = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  community: { slug: string; name: string } | null;
  tournaments: { id: string; slug: string; name: string; status: string }[];
  table: { name: string; points: number; events: number }[];
};

export default function CircuitPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { token, user } = useAuth();
  const qc = useQueryClient();
  const [tournamentId, setTournamentId] = useState('');
  const { data: mine = [] } = useQuery({
    queryKey: ['tournaments', 'mine'],
    enabled: !!token,
    queryFn: () => api<{ id: string; name: string; circuitId?: string | null }[]>('/tournaments/mine', { token }),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ['circuit', slug],
    queryFn: () => api<CircuitDetail>(`/circuits/${slug}`),
  });
  const attach = useMutation({
    mutationFn: () =>
      api(`/circuits/${data?.id}/tournaments`, {
        method: 'POST',
        token,
        body: JSON.stringify({ tournamentId: tournamentId.trim() }),
      }),
    onSuccess: async () => {
      setTournamentId('');
      toast.success('Tournament added');
      await qc.invalidateQueries({ queryKey: ['circuit', slug] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="container-page flex-1 py-12">
        {isLoading && <p className="text-sm text-[var(--color-muted)]">Loading…</p>}
        {error && <p className="text-sm">Circuit not found.</p>}
        {data && (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">Circuit</p>
            <h1 className="font-display mt-2 text-4xl font-bold">{data.name}</h1>
            {data.description && <p className="mt-3 max-w-2xl text-[var(--color-muted)]">{data.description}</p>}
            {data.community && (
              <p className="mt-2 text-sm">
                <Link href={`/c/${data.community.slug}`} className="text-[var(--color-accent)]">{data.community.name}</Link>
              </p>
            )}
            <h2 className="font-display mt-10 text-2xl font-semibold">Season table</h2>
            {data.table.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-muted)]">Points appear after a tournament in this circuit has standings.</p>
            ) : (
              <table className="mt-4 w-full max-w-xl text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
                    <th className="py-2">#</th>
                    <th>Name</th>
                    <th>Events</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {data.table.map((row, i) => (
                    <tr key={row.name} className="border-b border-[var(--color-line)]">
                      <td className="py-2">{i + 1}</td>
                      <td>{row.name}</td>
                      <td>{row.events}</td>
                      <td>{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <h2 className="font-display mt-10 text-2xl font-semibold">Tournaments</h2>
            <ul className="mt-3 space-y-2">
              {data.tournaments.map((t) => (
                <li key={t.id}>
                  <Link href={`/t/${t.slug}`} className="text-[var(--color-accent)]">{t.name}</Link>
                  <span className="ml-2 text-xs text-[var(--color-muted)]">{t.status}</span>
                </li>
              ))}
            </ul>
            {user && user.id === data.ownerId && (
              <form
                className="mt-8 flex max-w-lg flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  attach.mutate();
                }}
              >
                <select
                  value={tournamentId}
                  onChange={(e) => setTournamentId(e.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm"
                >
                  <option value="">Choose a tournament you own</option>
                  {mine
                    .filter((t) => !data.tournaments.some((row) => row.id === t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <Button type="submit" disabled={!tournamentId || attach.isPending}>Add tournament</Button>
                <Link href={`/tournaments/new?circuit=${data.id}`} className="text-sm text-[var(--color-accent)]">
                  Or create one in this circuit
                </Link>
              </form>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
