'use client';

import { resolveGameProfile, summarizeSets, type TournamentSettings } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { Match, Tournament } from '@/lib/types';
import {
  buildMatchMetaFromDraft,
  emptyGameMatchDraft,
  GameMatchEntryFields,
  setsFromDraft,
} from '@/components/game-match-entry-fields';
import { CricketMatchEntryOptions } from '@/components/cricket-match-entry-options';

export function MatchInlineResultForm({
  match,
  tournament,
  token,
  slug,
}: {
  match: Match;
  tournament: Tournament;
  token: string;
  slug: string;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(emptyGameMatchDraft());
  const [error, setError] = useState('');
  const profile = resolveGameProfile({ gameName: tournament.game?.name });
  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const home = match.homeTeam?.name ?? 'Home';
  const away = match.awayTeam?.name ?? 'Away';

  const quickWinMode = settings.quickAdvanceWinnersOnly === true;
  const setBased = settings.setBasedScoring === true;
  const setsBestOf = setBased ? settings.setsBestOf ?? null : null;
  const bestOf = match.bestOf ?? (settings.knockoutBestOf > 1 ? settings.knockoutBestOf : null);

  const save = useMutation({
    mutationFn: (winnerTeamId: string | null) => {
      let homeScore = draft.homeScore === '' ? 0 : Number(draft.homeScore);
      let awayScore = draft.awayScore === '' ? 0 : Number(draft.awayScore);
      let sets: { home: number; away: number }[] | undefined;

      if (winnerTeamId) {
        homeScore = 0;
        awayScore = 0;
      } else if (setBased) {
        sets = setsFromDraft(draft.sets);
        const summary = summarizeSets(sets, setsBestOf);
        if (summary.error) throw new Error(summary.error);
        homeScore = summary.homeSetsWon;
        awayScore = summary.awaySetsWon;
      }

      return api(`/matches/${match.id}/result`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          homeScore,
          awayScore,
          homePercent: draft.homePercent === '' ? null : Number(draft.homePercent),
          awayPercent: draft.awayPercent === '' ? null : Number(draft.awayPercent),
          winnerTeamId,
          isDraw: false,
          force: false,
          winnersOnly: !!winnerTeamId,
          playerStats: [],
          sets,
          matchMeta: buildMatchMetaFromDraft(profile.matchEntry, draft),
        }),
      });
    },
    onSuccess: async () => {
      setError('');
      await qc.invalidateQueries({ queryKey: ['tournament', slug] });
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!match.homeTeamId || !match.awayTeamId) {
    return (
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Waiting for both teams before you can enter a result.
      </p>
    );
  }

  if (profile.matchEntry === 'cricket') {
    return (
      <div className="mt-3">
        <CricketMatchEntryOptions
          slug={slug}
          matchId={match.id}
          token={token}
          homeTeamId={match.homeTeamId}
          awayTeamId={match.awayTeamId}
          homeName={home}
          awayName={away}
        />
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--color-accent)]">
          {quickWinMode ? 'Advance winner' : 'Enter result'}
        </p>
        {bestOf && bestOf > 1 && !setBased && (
          <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-muted)]">
            Bo{bestOf}
          </span>
        )}
      </div>

      {quickWinMode ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              [match.homeTeamId, home],
              [match.awayTeamId, away],
            ] as const
          ).map(([teamId, name]) => (
            <button
              key={teamId}
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate(teamId)}
              className="rounded-lg border-2 border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-4 py-3 text-left font-semibold transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-50"
            >
              <span className="block text-xs font-normal text-[var(--color-muted)]">Winner</span>
              {name}
            </button>
          ))}
        </div>
      ) : (
        <>
          <GameMatchEntryFields
            mode={profile.matchEntry}
            homeName={home}
            awayName={away}
            draft={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            setBasedScoring={setBased}
            setsBestOf={setsBestOf}
          />
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={save.isPending}
            onClick={() => save.mutate(null)}
          >
            {save.isPending ? 'Saving…' : 'Save result'}
          </Button>
        </>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
