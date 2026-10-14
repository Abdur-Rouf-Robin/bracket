'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

type Stage = {
  id: string;
  order: number;
  name: string;
  format: string;
  advanceCount: number | null;
  status: string;
  _count?: { matches: number };
};

const FORMATS = [
  ['SINGLE_ELIMINATION', 'Single elimination'],
  ['DOUBLE_ELIMINATION', 'Double elimination'],
  ['ROUND_ROBIN', 'Round robin'],
  ['SWISS', 'Swiss'],
  ['GAUNTLET', 'Gauntlet'],
] as const;

export function StagesPanel({
  tournamentId,
  slug,
  token,
}: {
  tournamentId: string;
  slug: string;
  token: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('Playoffs');
  const [format, setFormat] = useState<(typeof FORMATS)[number][0]>('SINGLE_ELIMINATION');
  const [advance, setAdvance] = useState('4');
  const [error, setError] = useState('');

  const stages = useQuery({
    queryKey: ['stages', tournamentId],
    queryFn: () => api<Stage[]>(`/tournaments/${tournamentId}/stages`, { token }),
  });

  const add = useMutation({
    mutationFn: () =>
      api(`/tournaments/${tournamentId}/stages`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: name.trim(),
          format,
          advanceCount: advance ? Number(advance) : null,
        }),
      }),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['stages', tournamentId] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const open = useMutation({
    mutationFn: (stageId: string) =>
      api(`/tournaments/${tournamentId}/stages/${stageId}/open`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['stages', tournamentId] });
      qc.invalidateQueries({ queryKey: ['tournament', slug] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: (stageId: string) =>
      api(`/tournaments/${tournamentId}/stages/${stageId}`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stages', tournamentId] }),
    onError: (err: Error) => setError(err.message),
  });

  const list = stages.data ?? [];

  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-line)] p-4">
      <h2 className="font-display text-lg font-semibold">Stages</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Chain formats in one tournament. Open the next stage after the current one is finished.
        The number is how many teams move on.
      </p>
      <ul className="mt-3 space-y-2">
        {list.map((stage) => (
          <li key={stage.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {stage.order}. {stage.name}{' '}
              <span className="text-[var(--color-muted)]">
                {stage.format.replaceAll('_', ' ').toLowerCase()} · {stage.status.toLowerCase()}
                {stage.advanceCount ? ` · top ${stage.advanceCount}` : ''}
              </span>
            </span>
            <span className="flex gap-2">
              {stage.status === 'PENDING' && (
                <>
                  <Button type="button" className="h-8" disabled={open.isPending} onClick={() => open.mutate(stage.id)}>
                    Open stage
                  </Button>
                  <Button type="button" variant="ghost" className="h-8" onClick={() => remove.mutate(stage.id)}>
                    Remove
                  </Button>
                </>
              )}
            </span>
          </li>
        ))}
        {list.length === 0 && (
          <li className="text-sm text-[var(--color-muted)]">No extra stages yet.</li>
        )}
      </ul>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Stage name" />
        <select
          className="h-10 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-sm"
          value={format}
          onChange={(e) => setFormat(e.target.value as (typeof FORMATS)[number][0])}
        >
          {FORMATS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={2}
          value={advance}
          onChange={(e) => setAdvance(e.target.value)}
          placeholder="Advance"
        />
        <Button type="button" disabled={add.isPending || !name.trim()} onClick={() => add.mutate()}>
          Add stage
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
