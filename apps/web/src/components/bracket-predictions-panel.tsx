'use client';



import { useEffect, useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';

import { api } from '@/lib/api';

import { resolveRoundLabel, type TournamentSettings } from '@bracket/shared';
import type { Match, Tournament } from '@/lib/types';



const GUEST_KEY_STORAGE = 'bracket-prediction-guest-key';



function getGuestKey(): string {

  if (typeof window === 'undefined') return '';

  let key = localStorage.getItem(GUEST_KEY_STORAGE);

  if (!key) {

    key = crypto.randomUUID();

    localStorage.setItem(GUEST_KEY_STORAGE, key);

  }

  return key;

}



export function BracketPredictionsPanel({

  tournament,

  token,

}: {

  tournament: Tournament;

  token?: string;

}) {

  const settings = (tournament.settings ?? {}) as TournamentSettings;

  if (settings.enableBracketPredictions !== true) return null;



  const allowAnonymous = settings.allowAnonymousPredictions === true;

  const customFields = settings.predictionCustomFields ?? [];

  const canSave = !!token || allowAnonymous;



  const qc = useQueryClient();

  const guestKey = useMemo(() => (allowAnonymous ? getGuestKey() : ''), [allowAnonymous]);

  const [guestName, setGuestName] = useState('');



  const knockoutMatches = tournament.matches.filter(

    (m) =>

      m.bracketSide !== 'GROUP' &&

      m.bracketSide !== 'SWISS' &&

      m.homeTeamId &&

      m.awayTeamId,

  );



  const totalRounds = knockoutMatches.length
    ? Math.max(...knockoutMatches.map((m) => m.round))
    : undefined;

  const queryParams = new URLSearchParams();

  if (!token && guestKey) queryParams.set('guestKey', guestKey);



  const { data } = useQuery({

    queryKey: ['bracket-predictions', tournament.id, token ?? guestKey],

    queryFn: () =>

      api<{

        enabled: boolean;

        picks: Record<string, string>;

        customFields?: Record<string, string | number>;

        guestName?: string | null;

      }>(

        `/tournaments/${tournament.id}/predictions${queryParams.size ? `?${queryParams}` : ''}`,

        token ? { token } : {},

      ),

    enabled: canSave,

  });



  const [picks, setPicks] = useState<Record<string, string>>({});

  const [customValues, setCustomValues] = useState<Record<string, string>>({});



  useEffect(() => {

    if (data?.picks) setPicks(data.picks);

    if (data?.customFields) {

      const next: Record<string, string> = {};

      for (const [k, v] of Object.entries(data.customFields)) {

        next[k] = String(v);

      }

      setCustomValues(next);

    }

    if (data?.guestName) setGuestName(data.guestName);

  }, [data?.picks, data?.customFields, data?.guestName]);



  const save = useMutation({

    mutationFn: () => {

      const body: Record<string, unknown> = {

        picks,

        customFields: Object.fromEntries(

          Object.entries(customValues).filter(([, v]) => v !== ''),

        ),

      };

      if (!token && allowAnonymous) {

        body.guestKey = guestKey;

        body.guestName = guestName.trim() || 'Guest';

      }

      return api(`/tournaments/${tournament.id}/predictions`, {

        method: 'POST',

        token,

        body: JSON.stringify(body),

      });

    },

    onSuccess: () => {

      qc.invalidateQueries({ queryKey: ['bracket-predictions', tournament.id] });

    },

  });



  if (!knockoutMatches.length) {

    return (

      <p className="text-sm text-[var(--color-muted)]">

        Bracket predictions unlock once knockout matches are set.

      </p>

    );

  }



  if (!canSave) {

    return (

      <p className="text-sm text-[var(--color-muted)]">

        Sign in to save bracket predictions.

      </p>

    );

  }



  return (

    <div className="space-y-3 rounded-xl border border-[var(--color-line)] p-4">

      <h3 className="font-display text-lg font-semibold">Bracket predictions</h3>

      <p className="text-xs text-[var(--color-muted)]">

        Pick who you think wins each knockout match before it is played.

      </p>



      {!token && allowAnonymous && (

        <div>

          <label className="text-xs font-medium">Your name</label>

          <input

            className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"

            value={guestName}

            onChange={(e) => setGuestName(e.target.value)}

            placeholder="Guest predictor"

          />

        </div>

      )}



      {settings.allowCustomPredictionFields &&

        customFields.map((field) => (

          <div key={field.id}>

            <label className="text-xs font-medium">{field.label}</label>

            <input

              type={field.type === 'number' ? 'number' : 'text'}

              className="mt-1 w-full rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"

              value={customValues[field.id] ?? ''}

              onChange={(e) =>

                setCustomValues((prev) => ({

                  ...prev,

                  [field.id]: e.target.value,

                }))

              }

            />

          </div>

        ))}



      {knockoutMatches.map((m) => (

        <PredictionRow

          key={m.id}

          match={m}

          roundLabel={resolveRoundLabel(m.round, settings, totalRounds)}

          value={picks[m.id] ?? ''}

          onChange={(teamId) =>

            setPicks((prev) => ({ ...prev, [m.id]: teamId }))

          }

        />

      ))}

      <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>

        {save.isPending ? 'Saving…' : 'Save predictions'}

      </Button>

    </div>

  );

}



function PredictionRow({

  match: m,

  roundLabel,

  value,

  onChange,

}: {

  match: Match;

  roundLabel: string;

  value: string;

  onChange: (teamId: string) => void;

}) {

  return (

    <div className="flex flex-wrap items-center gap-2 text-sm">

      <span className="text-xs text-[var(--color-muted)]">{roundLabel}</span>

      <select

        className="min-w-[200px] rounded-md border border-[var(--color-line)] px-2 py-1 text-sm"

        value={value}

        onChange={(e) => onChange(e.target.value)}

      >

        <option value="">— pick winner —</option>

        {m.homeTeamId && (

          <option value={m.homeTeamId}>{m.homeTeam?.name ?? 'Home'}</option>

        )}

        {m.awayTeamId && (

          <option value={m.awayTeamId}>{m.awayTeam?.name ?? 'Away'}</option>

        )}

      </select>

      <span className="text-[var(--color-muted)]">

        {m.homeTeam?.name} vs {m.awayTeam?.name}

      </span>

    </div>

  );

}


