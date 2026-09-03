'use client';



import { formatShareDateTime, resolveRoundLabel, type TournamentSettings } from '@bracket/shared';

import type { Match, Tournament } from '@/lib/types';

import { MatchResultView, matchToResultData } from '@/components/match-result-view';

import { MatchVoteBar } from '@/components/match-vote-bar';

import { MatchInlineResultForm } from '@/components/match-inline-result-form';

export function TournamentMatchesView({

  tournament,

  knockoutOnly = false,

  token,

  slug,

  canEnterResults = false,

}: {

  tournament: Tournament;

  knockoutOnly?: boolean;

  token?: string;

  slug?: string;

  canEnterResults?: boolean;

}) {

  let matches = [...tournament.matches];

  if (knockoutOnly) {

    matches = matches.filter(

      (m) =>

        m.bracketSide !== 'GROUP' &&

        m.bracketSide !== 'SWISS' &&

        (tournament.format === 'GROUPS_KNOCKOUT'

          ? m.bracketSide !== 'GROUP'

          : true),

    );

    if (tournament.format === 'GROUPS_KNOCKOUT') {

      matches = matches.filter((m) => m.bracketSide !== 'GROUP');

    }

  }



  if (!matches.length) {

    return (

      <p className="text-sm text-[var(--color-muted)]">

        No matches {knockoutOnly ? 'in the knockout stage ' : ''}yet.

      </p>

    );

  }



  const settings = (tournament.settings ?? {}) as TournamentSettings;

  const koMatches = matches.filter(

    (m) => m.bracketSide !== 'GROUP' && m.bracketSide !== 'SWISS',

  );

  const totalRounds = koMatches.length

    ? Math.max(...koMatches.map((m) => m.round))

    : undefined;

  const requireCheckIn = settings.requireCheckIn === true;

  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);



  return (

    <div className="space-y-8">

      {rounds.map((round) => {

        const roundMatches = matches

          .filter((m) => m.round === round)

          .sort((a, b) => a.position - b.position);

        const side = roundMatches[0]?.bracketSide.replaceAll('_', ' ') ?? '';

        const roundLabel = resolveRoundLabel(round, settings, totalRounds);



        return (

          <section key={round}>

            <h3 className="font-display text-lg font-semibold">

              {roundLabel}

              {side ? (

                <span className="ml-2 text-sm font-normal text-[var(--color-muted)]">

                  · {side}

                </span>

              ) : null}

            </h3>

            <div className="mt-3 space-y-2">

              {roundMatches.map((m) => (

                <MatchListRow

                  key={m.id}

                  match={m}

                  tournament={tournament}

                  token={token}

                  slug={slug}

                  canEnterResults={canEnterResults}

                  requireCheckIn={requireCheckIn}

                />

              ))}

            </div>

          </section>

        );

      })}

    </div>

  );

}



function MatchListRow({

  match: m,

  tournament,

  token,

  slug,

  canEnterResults,

  requireCheckIn,

}: {

  match: Match;

  tournament: Tournament;

  token?: string;

  slug?: string;

  canEnterResults?: boolean;

  requireCheckIn?: boolean;

}) {

  const settings = (tournament.settings ?? {}) as TournamentSettings;

  const home = m.homeTeam?.name ?? 'TBD';

  const away = m.awayTeam?.name ?? 'TBD';

  const done = m.status === 'COMPLETED';

  const bestOf = m.bestOf ?? settings.knockoutBestOf ?? 1;

  const checkInBlocked =

    requireCheckIn &&

    !done &&

    (!m.homeTeam?.checkedIn || !m.awayTeam?.checkedIn);



  return (

    <div className="gaming-card rounded-xl border border-[var(--color-line)] p-4">

      <div className="flex flex-wrap items-start justify-between gap-2">

        <div>

          <p className="text-xs text-[var(--color-muted)]">

            {m.bracketSide.replaceAll('_', ' ')}

            {m.legNumber === 1 && (

              <span className="ml-2 rounded bg-slate-500/15 px-1.5 py-0.5">

                Leg 1

              </span>

            )}

            {m.legNumber === 2 && (

              <span className="ml-2 rounded bg-slate-500/15 px-1.5 py-0.5">

                Leg 2

              </span>

            )}

            {bestOf > 1 && (

              <span className="ml-2 rounded bg-indigo-500/15 px-1.5 py-0.5 text-indigo-800">

                Bo{bestOf}

              </span>

            )}

            {!done && (

              <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700">

                Upcoming

              </span>

            )}

          </p>

          {(m.scheduledAt || m.station) && (

            <p className="mt-1 text-xs text-[var(--color-muted)]">

              {m.scheduledAt && formatShareDateTime(m.scheduledAt)}

              {m.scheduledAt && m.station ? ' · ' : ''}

              {m.station}

            </p>

          )}

        </div>

        {done && (

          <span className="text-xs font-semibold text-[var(--color-ok)]">

            Final

          </span>

        )}

      </div>



      {checkInBlocked && (

        <p className="mt-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-900">

          Check-in required:{' '}

          {!m.homeTeam?.checkedIn && `${home} not checked in`}

          {!m.homeTeam?.checkedIn && !m.awayTeam?.checkedIn ? '; ' : ''}

          {!m.awayTeam?.checkedIn && `${away} not checked in`}

        </p>

      )}



      {done ? (

        <div className="mt-2">

          <MatchResultView

            data={matchToResultData(m, tournament)}

            variant="compact"

            hideSeeds={settings.hideSeedNumbers === true}

          />

        </div>

      ) : (

        <>

          <p className="mt-2 font-semibold">

            {home} <span className="text-[var(--color-muted)]">vs</span> {away}

          </p>

          {canEnterResults && token && slug && !checkInBlocked && (

            <MatchInlineResultForm

              match={m}

              tournament={tournament}

              token={token}

              slug={slug}

            />

          )}

        </>

      )}



      {settings.allowMatchAttachments && m.attachmentUrl && (

        <p className="mt-2 text-xs">

          <a

            href={m.attachmentUrl}

            target="_blank"

            rel="noopener noreferrer"

            className="text-[var(--color-accent)] underline"

          >

            {m.attachmentName ?? 'Match attachment'}

          </a>

        </p>

      )}



      <MatchVoteBar match={m} tournament={tournament} token={token} />

    </div>

  );

}


