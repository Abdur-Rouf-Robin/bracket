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

type CircuitTournament = {
  id: string;
  slug: string;
  name: string;
  status: string;
  circuitSeason: string | null;
  circuitRegion: string | null;
  circuitTier: string | null;
};

type CircuitDetail = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  community: { slug: string; name: string } | null;
  tournaments: CircuitTournament[];
  table: { name: string; points: number; events: number }[];
  seasons: string[];
  regions: string[];
  tiers: string[];
};

export default function CircuitPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { token, user } = useAuth();
  const qc = useQueryClient();
  const [tournamentId, setTournamentId] = useState('');
  const [season, setSeason] = useState('');
  const [region, setRegion] = useState('');
  const [tier, setTier] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const { data: mine = [] } = useQuery({
    queryKey: ['tournaments', 'mine'],
    enabled: !!token,
    queryFn: () => api<{ id: string; name: string; circuitId?: string | null }[]>('/tournaments/mine', { token }),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ['circuit', slug, filterSeason, filterRegion, filterTier],
    queryFn: () => {
      const q = new URLSearchParams();
      if (filterSeason) q.set('season', filterSeason);
      if (filterRegion) q.set('region', filterRegion);
      if (filterTier) q.set('tier', filterTier);
      const suffix = q.toString();
      return api<CircuitDetail>(`/circuits/${slug}${suffix ? `?${suffix}` : ''}`);
    },
  });
  const attach = useMutation({
    mutationFn: () =>
      api(`/circuits/${data?.id}/tournaments`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          tournamentId: tournamentId.trim(),
          season: season.trim() || null,
          region: region.trim() || null,
          tier: tier.trim() || null,
        }),
      }),
    onSuccess: async () => {
      setTournamentId('');
      setSeason('');
      setRegion('');
      setTier('');
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
            <div className="mt-8 flex flex-wrap gap-2">
              <FilterSelect label="Season" value={filterSeason} options={data.seasons} onChange={setFilterSeason} />
              <FilterSelect label="Region" value={filterRegion} options={data.regions} onChange={setFilterRegion} />
              <FilterSelect label="Tier" value={filterTier} options={data.tiers} onChange={setFilterTier} />
            </div>
            <h2 className="font-display mt-6 text-2xl font-semibold">Season table</h2>
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
            <ul className="mt-3 space-y-3">
              {data.tournaments.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/t/${t.slug}`} className="text-[var(--color-accent)]">{t.name}</Link>
                  <span className="text-xs text-[var(--color-muted)]">{t.status}</span>
                  {[t.circuitSeason, t.circuitRegion, t.circuitTier].filter(Boolean).map((label) => (
                    <span key={label} className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-xs">{label}</span>
                  ))}
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
                <input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Season" className="h-10 w-28 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm" />
                <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region" className="h-10 w-28 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm" />
                <input value={tier} onChange={(e) => setTier(e.target.value)} placeholder="Tier" className="h-10 w-28 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm" />
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

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-semibold text-[var(--color-muted)]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ml-2 h-9 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-ink)]"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
