'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Match, Tournament } from '@/lib/types';

export function MatchVoteBar({
  match,
  tournament,
  token,
}: {
  match: Match;
  tournament: Tournament;
  token?: string;
}) {
  const settings = tournament.settings as { enableMatchVoting?: boolean } | undefined;
  if (settings?.enableMatchVoting !== true) return null;
  if (match.status === 'COMPLETED' || !match.homeTeamId || !match.awayTeamId) {
    return null;
  }

  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['match-votes', match.id],
    queryFn: () =>
      api<{
        enabled: boolean;
        home: number;
        away: number;
        total: number;
        myVote: string | null;
      }>(`/matches/${match.id}/votes`),
  });

  const vote = useMutation({
    mutationFn: (teamId: string) =>
      api(`/matches/${match.id}/vote`, {
        method: 'POST',
        token: token!,
        body: JSON.stringify({ teamId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['match-votes', match.id] });
    },
  });

  if (!data?.enabled) return null;

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]/40 p-2">
      <p className="text-xs font-semibold text-[var(--color-muted)]">
        Fan vote · {data.total} total
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={data.myVote === match.homeTeamId ? 'primary' : 'secondary'}
          className="h-8 text-xs"
          disabled={!token || vote.isPending}
          onClick={() => match.homeTeamId && vote.mutate(match.homeTeamId)}
        >
          {match.homeTeam?.name ?? 'Home'} ({data.home})
        </Button>
        <Button
          type="button"
          variant={data.myVote === match.awayTeamId ? 'primary' : 'secondary'}
          className="h-8 text-xs"
          disabled={!token || vote.isPending}
          onClick={() => match.awayTeamId && vote.mutate(match.awayTeamId)}
        >
          {match.awayTeam?.name ?? 'Away'} ({data.away})
        </Button>
      </div>
      {!token && (
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">
          Log in to vote
        </p>
      )}
    </div>
  );
}
