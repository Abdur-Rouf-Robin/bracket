'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RANKING_DEFAULTS } from '@bracket/shared';
import { RankingSettingsEditor } from '@/components/community/ranking-settings-editor';
import type { Game } from '@/components/community/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Community, Ranking } from '@/lib/types-platform';

type RankingRow = Ranking & { _count?: { entries?: number; tournaments?: number } };

export function ManageCommunityRankings({
  community,
  games,
}: {
  community: Community;
  games: Game[];
}) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [gameId, setGameId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['community-rankings', community.id],
    queryFn: () =>
      api<RankingRow[]>(`/communities/${community.id}/rankings`, { token: token ?? undefined }),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['community-rankings', community.id] });
    void qc.invalidateQueries({ queryKey: ['community', community.slug] });
  }

  const create = useMutation({
    mutationFn: () =>
      api<Ranking>(`/communities/${community.id}/rankings`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: name.trim(),
          gameId: gameId || null,
          startingRating: RANKING_DEFAULTS.startingRating,
          kFactorNew: RANKING_DEFAULTS.kFactorNew,
          kFactorNormal: RANKING_DEFAULTS.kFactorNormal,
          kFactorPro: RANKING_DEFAULTS.kFactorPro,
          newPlayerMatches: RANKING_DEFAULTS.newPlayerMatches,
          proThreshold: RANKING_DEFAULTS.proThreshold,
          isActive: true,
        }),
      }),
    onSuccess: (r) => {
      toast.success('Ranking created');
      setName('');
      setGameId('');
      setEditingId(r.id);
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not create ranking'),
  });

  return (
    <div className="space-y-8">
      <section className="panel-card space-y-4 rounded-2xl p-5">
        <h3 className="font-display text-lg font-bold">New ranking</h3>
        <p className="text-sm text-[var(--color-muted)]">
          One ranking per game or division. Completed matches in linked tournaments update Elo
          automatically.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_200px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <div>
            <Label htmlFor="rk-new-name">Name</Label>
            <Input
              id="rk-new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Valorant ladder"
              required
            />
          </div>
          <div>
            <Label>Game (optional)</Label>
            <Select
              value={gameId}
              onChange={setGameId}
              placeholder="Any game"
              options={[
                { value: '', label: 'Any game' },
                ...games.map((g) => ({ value: g.id, label: g.name })),
              ]}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={create.isPending || !name.trim()}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </section>

      {isLoading ? (
        <div className="panel-card h-32 animate-pulse rounded-xl" />
      ) : rankings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-muted)]">
          No rankings yet.
        </p>
      ) : (
        <div className="space-y-3">
          {rankings.map((r) => (
            <div key={r.id} className="panel-card rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display font-bold">{r.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {r.game?.name ? `${r.game.name} · ` : ''}
                    {r._count?.entries ?? 0} rated · {r._count?.tournaments ?? 0} tournaments
                    {r.isActive ? '' : ' · inactive'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingId((id) => (id === r.id ? null : r.id))}
                >
                  {editingId === r.id ? 'Close' : 'Edit'}
                </Button>
              </div>
              {editingId === r.id && (
                <RankingSettingsEditor
                  ranking={r}
                  onSaved={refresh}
                  onDeleted={() => {
                    setEditingId(null);
                    refresh();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
