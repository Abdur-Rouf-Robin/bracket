'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SymmetricalBracket } from '@/components/symmetrical-bracket/symmetrical-bracket';
import { BracketView } from '@/components/bracket-view';
import { api } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { useTournamentLive } from '@/lib/use-tournament-live';

const BRACKET_FORMATS = new Set([
  'SINGLE_ELIMINATION',
  'DOUBLE_ELIMINATION',
  'GROUPS_KNOCKOUT',
]);

export default function EmbedTournamentPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data, isLoading, error } = useQuery({
    queryKey: ['tournament', slug],
    queryFn: () => api<Tournament>(`/t/${slug}`),
  });

  useTournamentLive(data?.id, slug);

  const format = data?.format;
  const useTree =
    format != null && BRACKET_FORMATS.has(format) && !data?.previewHidden;

  const knockoutTournament =
    data && format === 'GROUPS_KNOCKOUT'
      ? {
          ...data,
          matches: data.matches.filter((m) => m.bracketSide !== 'GROUP'),
        }
      : data;

  return (
    <div className="min-h-0 bg-[#0a0c10] p-2 text-white">
      {isLoading && (
        <p className="p-4 text-sm text-white/60">Loading bracket…</p>
      )}
      {error && (
        <p className="p-4 text-sm text-red-400">
          {error instanceof Error ? error.message : 'Not found'}
        </p>
      )}
      {data && (
        <>
          <p className="mb-2 truncate px-1 text-xs font-semibold text-white/70">
            {data.name}
          </p>
          {data.previewHidden ? (
            <p className="rounded border border-dashed border-white/20 p-4 text-sm text-white/50">
              Bracket preview hidden
            </p>
          ) : useTree && knockoutTournament ? (
            <SymmetricalBracket tournament={knockoutTournament} />
          ) : (
            <div className="embed-bracket text-[var(--color-ink)]">
              <BracketView tournament={data} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
