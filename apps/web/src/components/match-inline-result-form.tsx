'use client';



import { resolveGameProfile } from '@bracket/shared';

import { Button } from '@/components/ui/button';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useState } from 'react';

import { api } from '@/lib/api';

import type { Match, Tournament } from '@/lib/types';

import {

  buildMatchMetaFromDraft,

  emptyGameMatchDraft,

  GameMatchEntryFields,

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

  const home = match.homeTeam?.name ?? 'Home';

  const away = match.awayTeam?.name ?? 'Away';



  const save = useMutation({

    mutationFn: () =>

      api(`/matches/${match.id}/result`, {

        method: 'PATCH',

        token,

        body: JSON.stringify({

          homeScore: draft.homeScore === '' ? 0 : Number(draft.homeScore),

          awayScore: draft.awayScore === '' ? 0 : Number(draft.awayScore),

          homePercent:

            draft.homePercent === '' ? null : Number(draft.homePercent),

          awayPercent:

            draft.awayPercent === '' ? null : Number(draft.awayPercent),

          winnerTeamId: null,

          isDraw: false,

          force: false,

          winnersOnly: false,

          playerStats: [],

          matchMeta: buildMatchMetaFromDraft(profile.matchEntry, draft),

        }),

      }),

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

      <p className="mb-2 text-xs font-semibold text-[var(--color-accent)]">

        Enter result

      </p>

      <GameMatchEntryFields

        mode={profile.matchEntry}

        homeName={home}

        awayName={away}

        draft={draft}

        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}

      />

      {error && (

        <p className="mt-2 text-xs text-red-600">{error}</p>

      )}

      <Button

        type="button"

        className="mt-3 w-full"

        disabled={save.isPending}

        onClick={() => save.mutate()}

      >

        {save.isPending ? 'Saving…' : 'Save result'}

      </Button>

    </div>

  );

}

