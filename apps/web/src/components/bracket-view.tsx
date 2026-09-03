'use client';

import { useState } from 'react';
import type { EventResult, Match, Tournament } from '@/lib/types';
import { resolveRoundLabel, type TournamentSettings } from '@bracket/shared';
import { SymmetricalBracket } from '@/components/symmetrical-bracket/symmetrical-bracket';
import { MatchResultView, matchToResultData } from '@/components/match-result-view';

function teamLabel(m: Match, side: 'home' | 'away') {
  const t = side === 'home' ? m.homeTeam : m.awayTeam;
  return t?.name ?? 'TBD';
}

const FORMAT_TITLES: Record<string, string> = {
  SINGLE_ELIMINATION: 'Single Elimination Bracket',
  DOUBLE_ELIMINATION: 'Double Elimination Bracket',
  ROUND_ROBIN: 'Round Robin Schedule',
  SWISS: 'Swiss Pairings',
  GROUPS_KNOCKOUT: 'Two-Stage: Groups → Knockout',
  LEADERBOARD: 'Leaderboard Events',
  FREE_FOR_ALL: 'Free for All Rankings',
  TIME_TRIAL: 'Time Trial Board',
  SINGLE_RACE: 'Race Results',
  GRAND_PRIX: 'Grand Prix Championship',
};

export function BracketView({ tournament }: { tournament: Tournament }) {
  const format = tournament.format;

  if (!format) {
    return (
      <p className="text-[var(--color-muted)]">Bracket not generated yet.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--color-line)] bg-gradient-to-br from-white to-[var(--color-sand)]/40 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Format view
        </p>
        <h3 className="font-display text-xl font-bold">
          {FORMAT_TITLES[format] ?? format}
        </h3>
      </div>

      {(format === 'TIME_TRIAL' ||
        format === 'SINGLE_RACE' ||
        format === 'GRAND_PRIX' ||
        format === 'LEADERBOARD' ||
        format === 'FREE_FOR_ALL') && <EventBoard tournament={tournament} />}

      {format === 'ROUND_ROBIN' && <GroupOrLeagueView tournament={tournament} />}

      {format === 'SWISS' && <SwissView tournament={tournament} />}

      {format === 'GROUPS_KNOCKOUT' && (
        <>
          <GroupOrLeagueView tournament={tournament} />
          <section>
            <h4 className="mb-3 font-display text-lg font-semibold">Knockout</h4>
            <SymmetricalBracket
              tournament={{
                ...tournament,
                matches: tournament.matches.filter(
                  (m) => m.bracketSide !== 'GROUP',
                ),
              }}
            />
          </section>
        </>
      )}

      {(format === 'SINGLE_ELIMINATION' ||
        format === 'DOUBLE_ELIMINATION') && (
        <EliminationSection tournament={tournament} matches={tournament.matches} />
      )}
    </div>
  );
}

function EliminationSection({
  tournament,
  matches,
}: {
  tournament: Tournament;
  matches: Match[];
}) {
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const isDouble = tournament.format === 'DOUBLE_ELIMINATION';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setView('tree')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            view === 'tree'
              ? 'bg-[var(--color-accent)] text-[#0a0c10]'
              : 'border border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          Bracket tree
        </button>
        <button
          type="button"
          onClick={() => setView('list')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            view === 'list'
              ? 'bg-[var(--color-accent)] text-[#0a0c10]'
              : 'border border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          Round list
        </button>
      </div>

      {view === 'tree' ? (
        <>
          <SymmetricalBracket tournament={tournament} />
          {isDouble && (
            <section className="mt-8">
              <h4 className="mb-3 font-display text-lg font-semibold">
                Losers bracket
              </h4>
              <EliminationTree
                tournament={tournament}
                matches={matches.filter((m) => m.bracketSide === 'LOSERS')}
              />
            </section>
          )}
        </>
      ) : (
        <EliminationTree tournament={tournament} matches={matches} />
      )}
    </div>
  );
}

function GroupOrLeagueView({ tournament }: { tournament: Tournament }) {
  const groupMatches = tournament.matches.filter(
    (m) =>
      m.bracketSide === 'GROUP' || tournament.format === 'ROUND_ROBIN',
  );
  const byGroup = new Map<string, Match[]>();
  for (const m of groupMatches) {
    const key = m.groupId ?? 'all';
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(m);
  }

  return (
    <div className="space-y-8">
      {[...byGroup.entries()].map(([gid, matches]) => {
        const group = tournament.groups.find((g) => g.id === gid);
        return (
          <section key={gid}>
            <h4 className="font-display text-lg font-semibold">
              {group?.name ?? 'All matches'}
            </h4>
            <MatchList matches={matches} />
          </section>
        );
      })}
    </div>
  );
}

function SwissView({ tournament }: { tournament: Tournament }) {
  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const totalRounds = tournament.matches.length
    ? Math.max(...tournament.matches.map((m) => m.round))
    : 1;
  const rounds = [...new Set(tournament.matches.map((m) => m.round))].sort(
    (a, b) => a - b,
  );
  return (
    <div className="space-y-6">
      {rounds.map((round) => (
        <section key={round}>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-[var(--color-ink)] px-3 py-0.5 text-xs font-semibold text-white">
              {resolveRoundLabel(round, settings, totalRounds)}
            </span>
            <span className="text-xs text-[var(--color-muted)]">
              of {tournament.swissRounds ?? '—'}
            </span>
          </div>
          <MatchCards
            matches={tournament.matches.filter((m) => m.round === round)}
            tournament={tournament}
          />
        </section>
      ))}
    </div>
  );
}

function EventBoard({ tournament }: { tournament: Tournament }) {
  const results = tournament.eventResults ?? [];
  const events = [...new Set(results.map((r) => r.eventKey))].map((key) => {
    const sample = results.find((r) => r.eventKey === key)!;
    return {
      key,
      label: sample.eventLabel,
      rows: results
        .filter((r) => r.eventKey === key)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999)),
    };
  });

  const isTime = tournament.format === 'TIME_TRIAL';

  return (
    <div className="space-y-8">
      {events.map((ev) => (
        <section key={ev.key}>
          <h4 className="font-display text-lg font-semibold">{ev.label}</h4>
          <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-ink)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface)] text-left text-[var(--color-ink)]">
                <tr>
                  <th className="px-3 py-2">Pos</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">
                    {isTime
                      ? 'Time (sec)'
                      : tournament.format === 'LEADERBOARD'
                        ? 'Score'
                        : 'Finish'}
                  </th>
                  <th className="px-3 py-2">Pts</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {ev.rows.map((r: EventResult) => (
                  <tr key={r.id} className="border-t border-[var(--color-line)]">
                    <td className="px-3 py-2 font-semibold tabular-nums">
                      {r.status === 'COMPLETED' ? (r.position ?? '—') : '—'}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.team.name}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.status === 'COMPLETED' ? r.value : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.points}</td>
                    <td className="px-3 py-2 text-[var(--color-muted)]">
                      {r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function MatchList({ matches }: { matches: Match[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-ink)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface)] text-left text-[var(--color-ink)]">
          <tr>
            <th className="px-3 py-2">Round</th>
            <th className="px-3 py-2">Team 1</th>
            <th className="px-3 py-2">Score</th>
            <th className="px-3 py-2">Team 2</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id} className="border-t border-[var(--color-line)]">
              <td className="px-3 py-2">{m.round}</td>
              <td className="px-3 py-2 font-medium">{teamLabel(m, 'home')}</td>
              <td className="px-3 py-2 tabular-nums">
                {m.status === 'COMPLETED'
                  ? `${m.homeScore ?? 0} – ${m.awayScore ?? 0}`
                  : '—'}
              </td>
              <td className="px-3 py-2 font-medium">{teamLabel(m, 'away')}</td>
              <td className="px-3 py-2 text-[var(--color-muted)]">{m.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchCards({
  matches,
  tournament,
}: {
  matches: Match[];
  tournament?: Pick<
    Tournament,
    'name' | 'format' | 'allowPercent' | 'game' | 'settings'
  >;
}) {
  const hideSeeds =
    (tournament?.settings as { hideSeedNumbers?: boolean } | undefined)
      ?.hideSeedNumbers === true;

  if (tournament) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {matches.map((m) =>
          m.status === 'COMPLETED' ? (
            <MatchResultView
              key={m.id}
              data={matchToResultData(m, tournament)}
              variant="compact"
              hideSeeds={hideSeeds}
            />
          ) : (
            <PendingMatchCard key={m.id} m={m} />
          ),
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {matches.map((m) => (
        <PendingMatchCard key={m.id} m={m} />
      ))}
    </div>
  );
}

function PendingMatchCard({ m }: { m: Match }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-3 shadow-sm">
      <div className="flex justify-between gap-2 text-sm">
        <span>{teamLabel(m, 'home')}</span>
        <span className="text-[var(--color-muted)]">vs</span>
        <span>{teamLabel(m, 'away')}</span>
      </div>
      <p className="mt-2 text-center text-xs text-[var(--color-muted)]">
        {m.status}
      </p>
    </div>
  );
}

function EliminationTree({
  tournament,
  matches,
}: {
  tournament: Tournament;
  matches: Match[];
}) {
  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const totalRounds = matches.length
    ? Math.max(...matches.map((m) => m.round))
    : 1;

  if (!matches.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Knockout bracket appears after the group stage.
      </p>
    );
  }

  const sides = [...new Set(matches.map((m) => m.bracketSide))];
  return (
    <div className="space-y-8 overflow-x-auto pb-2">
      {sides.map((side) => {
        const sideMatches = matches.filter((m) => m.bracketSide === side);
        const rounds = [...new Set(sideMatches.map((m) => m.round))].sort(
          (a, b) => a - b,
        );
        return (
          <div key={side}>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
              {side.replaceAll('_', ' ')}
            </p>
            <div className="flex min-w-max gap-6">
              {rounds.map((round, ri) => (
                <div key={round} className="flex w-[200px] flex-col gap-4">
                  <p className="text-center text-[10px] font-semibold uppercase text-[var(--color-muted)]">
                    {resolveRoundLabel(round, settings, totalRounds)}
                  </p>
                  {sideMatches
                    .filter((m) => m.round === round)
                    .map((m) => (
                      <div
                        key={m.id}
                        className="rounded-lg border-2 border-[var(--color-line)] bg-[var(--color-card)] p-2.5 shadow-sm text-[var(--color-ink)]"
                      >
                        <div className="flex justify-between gap-2 text-sm">
                          <span
                            className={
                              m.winnerTeamId === m.homeTeamId
                                ? 'font-bold text-[var(--color-ok)]'
                                : ''
                            }
                          >
                            {teamLabel(m, 'home')}
                          </span>
                          <span className="tabular-nums text-[var(--color-muted)]">
                            {m.status === 'COMPLETED' ? m.homeScore : ''}
                          </span>
                        </div>
                        <div className="mt-1.5 flex justify-between gap-2 border-t border-[var(--color-line)] pt-1.5 text-sm">
                          <span
                            className={
                              m.winnerTeamId === m.awayTeamId
                                ? 'font-bold text-[var(--color-ok)]'
                                : ''
                            }
                          >
                            {teamLabel(m, 'away')}
                          </span>
                          <span className="tabular-nums text-[var(--color-muted)]">
                            {m.status === 'COMPLETED' ? m.awayScore : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StandingsTable({ tournament }: { tournament: Tournament }) {
  if (!tournament.standings.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Standings appear after results are entered.
      </p>
    );
  }

  const settings = (tournament.settings ?? {}) as {
    useFairPlayTiebreaker?: boolean;
    useHeadToHead?: boolean;
    useBuchholzSwiss?: boolean;
    rankBy?: string;
  };
  const showFairPlay = settings.useFairPlayTiebreaker === true;
  const rankBy = settings.rankBy ?? 'MATCH_WINS';
  const showNrr = rankBy === 'NET_RUN_RATE' || tournament.game?.name?.toLowerCase().includes('cricket');
  const pfLabel =
    rankBy.startsWith('GAME_SET') || rankBy.startsWith('POINTS')
      ? 'For'
      : showNrr
        ? 'Runs'
        : 'GF';
  const paLabel =
    rankBy.startsWith('GAME_SET') || rankBy.startsWith('POINTS')
      ? 'Ag'
      : showNrr
        ? 'Runs ag'
        : 'GA';

  const groups = tournament.groups.length
    ? tournament.groups
    : [{ id: null as string | null, name: 'Overall standings', order: 0 }];

  const isTime = tournament.format === 'TIME_TRIAL';
  const isEvent =
    tournament.format === 'TIME_TRIAL' ||
    tournament.format === 'SINGLE_RACE' ||
    tournament.format === 'GRAND_PRIX' ||
    tournament.format === 'LEADERBOARD';

  return (
    <div className="space-y-6">
      {(showFairPlay ||
        settings.useHeadToHead !== false ||
        settings.useBuchholzSwiss !== false) && (
        <p className="text-xs text-[var(--color-muted)]">
          Tiebreakers:
          {settings.useHeadToHead !== false && ' head-to-head'}
          {showFairPlay && ' · fair play (fewer discipline points ranks higher)'}
          {settings.useBuchholzSwiss !== false && ' · Buchholz (Swiss)'}
        </p>
      )}
      {groups.map((g) => {
        const rows = tournament.standings.filter((s) =>
          g.id
            ? s.groupId === g.id
            : !s.groupId || tournament.groups.length === 0,
        );
        if (!rows.length && g.id) return null;
        const list =
          g.id || tournament.groups.length === 0
            ? rows.length
              ? rows
              : tournament.standings
            : rows;
        return (
          <section key={g.id ?? 'all'}>
            <h3 className="font-display text-lg font-semibold">{g.name}</h3>
            <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-ink)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface)] text-left text-[var(--color-ink)]">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Team</th>
                    <th className="px-3 py-2">P</th>
                    {!isEvent && (
                      <>
                        <th className="px-3 py-2">W</th>
                        <th className="px-3 py-2">D</th>
                        <th className="px-3 py-2">L</th>
                      </>
                    )}
                    <th className="px-3 py-2">{isTime ? 'Best time' : pfLabel}</th>
                    {!isEvent && <th className="px-3 py-2">{paLabel}</th>}
                    {showFairPlay && !isEvent && (
                      <th className="px-3 py-2" title="Discipline points">
                        FP
                      </th>
                    )}
                    {showNrr && !isEvent && (
                      <th className="px-3 py-2" title="Net run rate">
                        NRR
                      </th>
                    )}
                    <th className="px-3 py-2">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {(g.id ? rows : list).map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-[var(--color-line)] text-[var(--color-ink)] even:bg-[var(--color-surface)]/40"
                    >
                      <td className="px-3 py-2 font-semibold">{s.rank}</td>
                      <td className="px-3 py-2 font-medium">{s.team.name}</td>
                      <td className="px-3 py-2">{s.played}</td>
                      {!isEvent && (
                        <>
                          <td className="px-3 py-2">{s.wins}</td>
                          <td className="px-3 py-2">{s.draws}</td>
                          <td className="px-3 py-2">{s.losses}</td>
                        </>
                      )}
                      <td className="px-3 py-2">{s.pointsFor}</td>
                      {!isEvent && (
                        <td className="px-3 py-2">{s.pointsAgainst}</td>
                      )}
                      {showFairPlay && !isEvent && (
                        <td className="px-3 py-2">
                          {s.team.fairPlayPoints ?? 0}
                        </td>
                      )}
                      {showNrr && !isEvent && (
                        <td className="px-3 py-2 font-mono text-xs">
                          {s.netRunRate != null
                            ? (s.netRunRate >= 0 ? '+' : '') + s.netRunRate.toFixed(3)
                            : '—'}
                        </td>
                      )}
                      <td className="px-3 py-2 font-semibold">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
