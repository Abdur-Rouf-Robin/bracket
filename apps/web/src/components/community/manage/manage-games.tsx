'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Game } from '@/components/community/types';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Community } from '@/lib/types-platform';
import { cn } from '@/lib/utils';

export function ManageCommunityGames({
  community,
  selected,
}: {
  community: Community;
  selected: Game[];
}) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [ids, setIds] = useState<string[]>(() => selected.map((g) => g.id));

  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => api<Game[]>('/games'),
  });

  const save = useMutation({
    mutationFn: () =>
      api(`/communities/${community.id}/games`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ gameIds: ids }),
      }),
    onSuccess: () => {
      toast.success('Games updated');
      void qc.invalidateQueries({ queryKey: ['community', community.slug] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save games'),
  });

  const byCategory = new Map<string, Game[]>();
  for (const g of games) {
    if (!byCategory.has(g.category)) byCategory.set(g.category, []);
    byCategory.get(g.category)!.push(g);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-muted)]">
        Highlight the titles this community runs. Shown on the public page and used as
        shortcuts when creating a tournament.
      </p>
      {[...byCategory.entries()].map(([category, list]) => (
        <section key={category}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {category}
          </h3>
          <div className="flex flex-wrap gap-2">
            {list.map((g) => {
              const active = ids.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  className={cn(
                    'choice-btn rounded-full px-3 py-1.5 text-sm transition',
                    active && 'choice-btn-active',
                  )}
                  onClick={() =>
                    setIds((prev) =>
                      active ? prev.filter((id) => id !== g.id) : [...prev, g.id],
                    )
                  }
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <div className="flex justify-end">
        <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save games'}
        </Button>
      </div>
    </div>
  );
}
