'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RANKING_K_FACTOR_HELP } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Ranking } from '@/lib/types-platform';

const NUMERIC_FIELDS: {
  key: keyof typeof RANKING_K_FACTOR_HELP;
  label: string;
}[] = [
  { key: 'startingRating', label: 'Starting rating' },
  { key: 'kFactorNew', label: 'New K-factor' },
  { key: 'kFactorNormal', label: 'Normal K-factor' },
  { key: 'kFactorPro', label: 'Pro K-factor' },
  { key: 'newPlayerMatches', label: 'New player matches' },
  { key: 'proThreshold', label: 'Pro threshold' },
];

export function RankingSettingsEditor({
  ranking,
  onSaved,
  onDeleted,
}: {
  ranking: Ranking;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const { token } = useAuth();
  const [form, setForm] = useState({
    name: ranking.name,
    description: ranking.description ?? '',
    startAt: ranking.startAt ? ranking.startAt.slice(0, 10) : '',
    endAt: ranking.endAt ? ranking.endAt.slice(0, 10) : '',
    isActive: ranking.isActive,
    startingRating: ranking.startingRating,
    kFactorNew: ranking.kFactorNew,
    kFactorNormal: ranking.kFactorNormal,
    kFactorPro: ranking.kFactorPro,
    newPlayerMatches: ranking.newPlayerMatches,
    proThreshold: ranking.proThreshold,
  });

  const save = useMutation({
    mutationFn: () =>
      api<Ranking>(`/rankings/${ranking.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
          endAt: form.endAt ? new Date(`${form.endAt}T23:59:59`).toISOString() : null,
          isActive: form.isActive,
          startingRating: form.startingRating,
          kFactorNew: form.kFactorNew,
          kFactorNormal: form.kFactorNormal,
          kFactorPro: form.kFactorPro,
          newPlayerMatches: form.newPlayerMatches,
          proThreshold: form.proThreshold,
        }),
      }),
    onSuccess: () => {
      toast.success('Ranking settings saved. Recompute to apply new K-factors to past matches.');
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Save failed'),
  });

  const remove = useMutation({
    mutationFn: () => api(`/rankings/${ranking.id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Ranking deleted');
      onDeleted?.();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Delete failed'),
  });

  return (
    <form
      className="panel-card mt-6 space-y-4 rounded-2xl p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="rk-name">Name</Label>
          <Input
            id="rk-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="rk-desc">Description</Label>
          <textarea
            id="rk-desc"
            className="field-textarea min-h-[70px]"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="rk-start">Start date</Label>
          <Input
            id="rk-start"
            type="date"
            value={form.startAt}
            onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="rk-end">End date</Label>
          <Input
            id="rk-end"
            type="date"
            value={form.endAt}
            onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
          />
        </div>
        {NUMERIC_FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={`rk-${f.key}`}>{f.label}</Label>
            <Input
              id={`rk-${f.key}`}
              type="number"
              min={0}
              value={form[f.key]}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [f.key]: Number(e.target.value) || 0 }))
              }
            />
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">{RANKING_K_FACTOR_HELP[f.key]}</p>
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-accent)]"
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
        />
        Active (new results update ratings and the ranking is shown publicly)
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {onDeleted ? (
          <Button
            type="button"
            variant="ghost"
            className="text-[var(--color-danger)]"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm(`Delete ranking "${ranking.name}" and all its ratings?`)) remove.mutate();
            }}
          >
            Delete ranking
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={save.isPending || !form.name.trim()}>
          {save.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}
