'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EventResult, Match, Standing, Tournament } from '@/lib/types';
import type { StandingAdjustment } from '@/lib/types-platform';
import { api } from '@/lib/api';
import {
  DEFAULT_STANDINGS_COLUMNS,
  RANK_BY_OPTIONS,
  STANDINGS_COLUMNS_META,
  describeStandingsCriteria,
  resolveRoundLabel,
  type StandingsColumn,
  type StandingsCriterion,
  type TournamentSettings,
} from '@bracket/shared';
import { SymmetricalBracket } from '@/components/symmetrical-bracket/symmetrical-bracket';
import {
  consolationAsTree,
  getPlacementLadders,
  isConsolationMatch,
  isGrandFinalReset,
  isPlacementMatch,
  ordinal,
} from '@/components/symmetrical-bracket/use-bracket-layout';
import { MatchResultView, matchToResultData } from '@/components/match-result-view';
import { SimpleTooltip } from '@/components/ui/tooltip';

function teamLabel(m: Match, side: 'home' | 'away', showSeed = false) {
  const t = side === 'home' ? m.homeTeam : m.awayTeam;
  if (!t) return 'TBD';
  return showSeed && t.seed != null ? `${t.seed}. ${t.name}` : t.name;
}

/** "6-4 3-6 7-5" for set-based matches, otherwise the plain score. */
export function formatMatchScore(m: Match): string {
  if (m.status !== 'COMPLETED') return '—';
  if (m.sets && m.sets.length) {
    return m.sets.map((s) => `${s.home}-${s.away}`).join(' ');
  }
  return `${m.homeScore ?? 0} – ${m.awayScore ?? 0}`;
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

function bracketNames(settings: TournamentSettings | undefined) {
  const names = settings?.bracketNames ?? {};
  return {
    winners: names.winners?.trim() || 'Knockout bracket',
    losers: names.losers?.trim() || 'Losers bracket',
    consolation: names.consolation?.trim() || 'Consolation',
    final: names.final?.trim() || 'Grand final',
  };
}

export function BracketView({ tournament }: { tournament: Tournament }) {
  const format = tournament.format;
  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const names = bracketNames(settings);

  if (!format) {
    return (
      <p className="text-[var(--color-muted)]">Bracket not generated yet.</p>
    );
  }

  const bestOf = settings.knockoutBestOf && settings.knockoutBestOf > 1 ? settings.knockoutBestOf : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--color-line)] bg-gradient-to-br from-white to-[var(--color-sand)]/40 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Format view
        </p>
        <h3 className="font-display text-xl font-bold">
          {FORMAT_TITLES[format] ?? format}
          {bestOf && (format === 'SINGLE_ELIMINATION' || format === 'DOUBLE_ELIMINATION' || format === 'GROUPS_KNOCKOUT') && (
            <span className="ml-2 rounded-full border border-[var(--color-line)] px-2 py-0.5 align-middle text-xs font-semibold text-[var(--color-muted)]">
              Bo{bestOf}
            </span>
          )}
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
            <h4 className="mb-3 font-display text-lg font-semibold">{names.winners}</h4>
            <SymmetricalBracket
              title={names.winners}
              tournament={{
                ...tournament,
                matches: tournament.matches.filter(
                  (m) => m.bracketSide !== 'GROUP' && !isConsolationMatch(m),
                ),
              }}
            />
          </section>
          <ConsolationSection tournament={tournament} title={names.consolation} />
          <PlacementSection tournament={tournament} />
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
  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const names = bracketNames(settings);
  const grandFinals = matches
    .filter((m) => m.bracketSide === 'GRAND_FINAL')
    .sort((a, b) => a.round - b.round);

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
          <SymmetricalBracket
            tournament={{ ...tournament, matches: matches.filter((m) => !isConsolationMatch(m)) }}
            title={names.winners}
          />
          {isDouble && (
            <section className="mt-8">
              <h4 className="mb-3 font-display text-lg font-semibold">{names.losers}</h4>
              <EliminationTree
                tournament={tournament}
                matches={matches.filter((m) => m.bracketSide === 'LOSERS' && !isPlacementMatch(m))}
                sideLabels={names}
              />
            </section>
          )}
          {isDouble && grandFinals.length > 0 && (
            <section className="mt-8">
              <h4 className="mb-3 font-display text-lg font-semibold">{names.final}</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {grandFinals.map((m) => (
                  <KnockoutMatchCard
                    key={m.id}
                    m={m}
                    label={isGrandFinalReset(m) ? 'Bracket reset' : names.final}
                    showSeeds={settings.hideSeedNumbers !== true}
                  />
                ))}
              </div>
            </section>
          )}
          <ConsolationSection tournament={tournament} title={names.consolation} />
          <PlacementSection tournament={tournament} />
        </>
      ) : (
        <EliminationTree tournament={tournament} matches={matches} sideLabels={names} />
      )}
    </div>
  );
}

/** Cup & consolation: round-1 losers play their own single-elimination bracket. */
function ConsolationSection({ tournament, title }: { tournament: Tournament; title: string }) {
  const tree = useMemo(() => consolationAsTree(tournament.matches), [tournament.matches]);
  if (!tree.length) return null;
  return (
    <section className="mt-8">
      <h4 className="mb-3 font-display text-lg font-semibold">{title}</h4>
      <p className="mb-3 text-xs text-[var(--color-muted)]">
        Teams knocked out in the first round continue here and play for the {title.toLowerCase()} title.
      </p>
      <SymmetricalBracket
        tournament={{ ...tournament, matches: tree }}
        title={title}
        championLabel={`${title} champion`}
        hideThirdPlace
        showFooter
      />
    </section>
  );
}

/** Placement ladders (5th–8th, 9th–16th, …). The 3rd-place match is drawn by SymmetricalBracket. */
function PlacementSection({ tournament }: { tournament: Tournament }) {
  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const ladders = useMemo(() => getPlacementLadders(tournament.matches), [tournament.matches]);
  if (!ladders.length) return null;
  const showSeeds = settings.hideSeedNumbers !== true;
  return (
    <section className="mt-8">
      <h4 className="mb-1 font-display text-lg font-semibold">Placement matches</h4>
      <p className="mb-3 text-xs text-[var(--color-muted)]">
        Classification matches decide every final position from 3rd downwards.
      </p>
      <div className="space-y-6">
        {ladders.map((ladder) => {
          const rounds = [...new Set(ladder.matches.map((m) => m.round))].sort((a, b) => a - b);
          return (
            <div key={ladder.rank}>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
                {ladder.label}
              </p>
              <div className="flex min-w-max gap-6 overflow-x-auto pb-2">
                {rounds.map((round, ri) => (
                  <div key={round} className="flex w-[220px] flex-col gap-3">
                    <p className="text-center text-[10px] font-semibold uppercase text-[var(--color-muted)]">
                      {ri === rounds.length - 1 ? 'Final' : `Round ${ri + 1}`}
                    </p>
                    {ladder.matches
                      .filter((m) => m.round === round)
                      .map((m) => (
                        <KnockoutMatchCard
                          key={m.id}
                          m={m}
                          showSeeds={showSeeds}
                          label={
                            /(?:^|-)(3rd|pl-\d+)$/.test(m.key) && m.placementRank
                              ? `${ordinal(m.placementRank)} place`
                              : undefined
                          }
                        />
                      ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function KnockoutMatchCard({
  m,
  label,
  showSeeds,
}: {
  m: Match;
  label?: string;
  showSeeds: boolean;
}) {
  const bestOf = m.bestOf && m.bestOf > 1 ? m.bestOf : null;
  return (
    <div className="rounded-lg border-2 border-[var(--color-line)] bg-[var(--color-card)] p-2.5 text-[var(--color-ink)] shadow-sm">
      {(label || bestOf) && (
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          <span>{label}</span>
          {bestOf && <span>Bo{bestOf}</span>}
        </div>
      )}
      <div className="flex justify-between gap-2 text-sm">
        <span
          className={
            m.winnerTeamId && m.winnerTeamId === m.homeTeamId
              ? 'font-bold text-[var(--color-ok)]'
              : ''
          }
        >
          {teamLabel(m, 'home', showSeeds)}
        </span>
        <span className="tabular-nums text-[var(--color-muted)]">
          {m.status === 'COMPLETED' ? m.homeScore : ''}
        </span>
      </div>
      <div className="mt-1.5 flex justify-between gap-2 border-t border-[var(--color-line)] pt-1.5 text-sm">
        <span
          className={
            m.winnerTeamId && m.winnerTeamId === m.awayTeamId
              ? 'font-bold text-[var(--color-ok)]'
              : ''
          }
        >
          {teamLabel(m, 'away', showSeeds)}
        </span>
        <span className="tabular-nums text-[var(--color-muted)]">
          {m.status === 'COMPLETED' ? m.awayScore : ''}
        </span>
      </div>
      {m.status === 'COMPLETED' && m.sets && m.sets.length > 0 && (
        <p className="mt-1 text-right font-mono text-[10px] text-[var(--color-muted)]">
          {formatMatchScore(m)}
        </p>
      )}
    </div>
  );
}

function GroupOrLeagueView({ tournament }: { tournament: Tournament }) {
  const settings = (tournament.settings ?? {}) as TournamentSettings;
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
  const legs = settings.meetingsPerPair ?? 1;

  return (
    <div className="space-y-8">
      {[...byGroup.entries()].map(([gid, matches]) => {
        const group = tournament.groups.find((g) => g.id === gid);
        return (
          <section key={gid}>
            <h4 className="font-display text-lg font-semibold">
              {group?.name ?? 'All matches'}
              {legs > 1 && (
                <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">
                  {legs === 2 ? 'home & away' : `${legs} meetings per pair`}
                </span>
              )}
            </h4>
            <MatchList matches={matches} settings={settings} />
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
  const isPots = settings.swissMode === 'POTS';
  return (
    <div className="space-y-6">
      {isPots && (
        <p className="text-xs text-[var(--color-muted)]">
          Pots mode: all {tournament.swissRounds ?? rounds.length} rounds were drawn upfront from
          seeded pots.
        </p>
      )}
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

function MatchList({ matches, settings }: { matches: Match[]; settings?: TournamentSettings }) {
  const showSeeds = settings?.hideSeedNumbers !== true;
  const totalRounds = matches.length ? Math.max(...matches.map((m) => m.round)) : 1;
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
              <td className="px-3 py-2">
                {settings?.showCustomRoundLabels
                  ? resolveRoundLabel(m.round, settings, totalRounds)
                  : m.round}
                {m.legNumber && m.legNumber > 1 ? (
                  <span className="ml-1 text-[10px] text-[var(--color-muted)]">leg {m.legNumber}</span>
                ) : null}
              </td>
              <td className="px-3 py-2 font-medium">{teamLabel(m, 'home', showSeeds)}</td>
              <td className="px-3 py-2 tabular-nums">
                {m.status === 'COMPLETED' ? (
                  m.sets && m.sets.length ? (
                    <span title={formatMatchScore(m)}>
                      {m.homeSetsWon ?? m.homeScore ?? 0} – {m.awaySetsWon ?? m.awayScore ?? 0}
                      <span className="ml-1 font-mono text-[10px] text-[var(--color-muted)]">
                        ({formatMatchScore(m)})
                      </span>
                    </span>
                  ) : (
                    `${m.homeScore ?? 0} – ${m.awayScore ?? 0}`
                  )
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2 font-medium">{teamLabel(m, 'away', showSeeds)}</td>
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
            <PendingMatchCard key={m.id} m={m} showSeeds={!hideSeeds} />
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

function PendingMatchCard({ m, showSeeds = false }: { m: Match; showSeeds?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-3 shadow-sm">
      <div className="flex justify-between gap-2 text-sm">
        <span>{teamLabel(m, 'home', showSeeds)}</span>
        <span className="text-[var(--color-muted)]">vs</span>
        <span>{teamLabel(m, 'away', showSeeds)}</span>
      </div>
      <p className="mt-2 text-center text-xs text-[var(--color-muted)]">
        {m.status}
      </p>
    </div>
  );
}

type SideLabels = ReturnType<typeof bracketNames>;

function sideTitle(side: string, labels?: SideLabels) {
  switch (side) {
    case 'WINNERS':
      return labels?.winners ?? 'Winners';
    case 'LOSERS':
      return labels?.losers ?? 'Losers';
    case 'GRAND_FINAL':
      return labels?.final ?? 'Grand final';
    case 'CONSOLATION':
      return labels?.consolation ?? 'Consolation';
    case 'PLACEMENT':
      return 'Placement matches';
    default:
      return side.replaceAll('_', ' ');
  }
}

/** Virtual side used for grouping in the round list. */
function listSide(m: Match): string {
  if (isConsolationMatch(m)) return 'CONSOLATION';
  if (isPlacementMatch(m)) return 'PLACEMENT';
  return m.bracketSide;
}

function EliminationTree({
  tournament,
  matches,
  sideLabels,
}: {
  tournament: Tournament;
  matches: Match[];
  sideLabels?: SideLabels;
}) {
  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const showSeeds = settings.hideSeedNumbers !== true;
  const totalRounds = matches.length
    ? Math.max(...matches.filter((m) => m.bracketSide === 'WINNERS' || m.bracketSide === 'FINAL').map((m) => m.round), 1)
    : 1;

  if (!matches.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Knockout bracket appears after the group stage.
      </p>
    );
  }

  const order = ['WINNERS', 'FINAL', 'LOSERS', 'GRAND_FINAL', 'CONSOLATION', 'PLACEMENT'];
  const sides = [...new Set(matches.map(listSide))].sort(
    (a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)),
  );
  return (
    <div className="space-y-8 overflow-x-auto pb-2">
      {sides.map((side) => {
        const sideMatches = matches.filter((m) => listSide(m) === side);
        const rounds = [...new Set(sideMatches.map((m) => m.round))].sort(
          (a, b) => a - b,
        );
        const isMain = side === 'WINNERS' || side === 'FINAL';
        return (
          <div key={side}>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
              {sideTitle(side, sideLabels)}
            </p>
            <div className="flex min-w-max gap-6">
              {rounds.map((round, ri) => (
                <div key={round} className="flex w-[200px] flex-col gap-4">
                  <p className="text-center text-[10px] font-semibold uppercase text-[var(--color-muted)]">
                    {isMain
                      ? resolveRoundLabel(round, settings, totalRounds)
                      : side === 'GRAND_FINAL'
                        ? ri === 0
                          ? sideLabels?.final ?? 'Grand final'
                          : 'Bracket reset'
                        : `Round ${ri + 1}`}
                  </p>
                  {sideMatches
                    .filter((m) => m.round === round)
                    .map((m) => (
                      <KnockoutMatchCard
                        key={m.id}
                        m={m}
                        showSeeds={showSeeds}
                        label={
                          side === 'PLACEMENT' && m.placementRank && /(?:^|-)(3rd|pl-\d+)$/.test(m.key)
                            ? `${ordinal(m.placementRank)} place`
                            : undefined
                        }
                      />
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

/* ------------------------------------------------------------------ */
/* Standings                                                           */
/* ------------------------------------------------------------------ */

type FormResult = 'W' | 'D' | 'L';

/** Last five results per team, computed client-side from completed matches (most recent last). */
function computeForm(matches: Match[]): Map<string, FormResult[]> {
  const out = new Map<string, FormResult[]>();
  const done = matches
    .filter((m) => m.status === 'COMPLETED' && !m.isBye && m.homeTeamId && m.awayTeamId)
    .sort((a, b) => a.round - b.round || a.position - b.position);
  const push = (teamId: string, r: FormResult) => {
    if (!out.has(teamId)) out.set(teamId, []);
    out.get(teamId)!.push(r);
  };
  for (const m of done) {
    const home = m.homeTeamId!;
    const away = m.awayTeamId!;
    if (m.isDraw || !m.winnerTeamId) {
      push(home, 'D');
      push(away, 'D');
    } else if (m.winnerTeamId === home) {
      push(home, 'W');
      push(away, 'L');
    } else {
      push(home, 'L');
      push(away, 'W');
    }
  }
  for (const [id, list] of out) out.set(id, list.slice(-5));
  return out;
}

function FormPills({ form }: { form: FormResult[] | undefined }) {
  if (!form?.length) return <span className="text-[var(--color-muted)]">—</span>;
  return (
    <span className="inline-flex gap-0.5">
      {form.map((r, i) => (
        <span
          key={i}
          className={`inline-flex size-5 items-center justify-center rounded text-[10px] font-bold text-white ${
            r === 'W' ? 'bg-emerald-500' : r === 'D' ? 'bg-slate-400' : 'bg-rose-500'
          }`}
          title={r === 'W' ? 'Win' : r === 'D' ? 'Draw' : 'Loss'}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Resolve which columns to show, in order. Explicit settings win; otherwise derive from context. */
function resolveColumns(input: {
  settings: TournamentSettings;
  isEvent: boolean;
  isSwiss: boolean;
  hasAdjustments: boolean;
  isCricket: boolean;
}): StandingsColumn[] {
  const { settings, isEvent, isSwiss, hasAdjustments, isCricket } = input;
  if (isEvent) return ['RANK', 'TEAM', 'PLAYED', 'SCORE_FOR', 'POINTS'];
  const explicit = settings.standingsColumns as StandingsColumn[] | undefined;
  let cols: StandingsColumn[] = explicit && explicit.length ? [...explicit] : [...DEFAULT_STANDINGS_COLUMNS];
  if (!explicit?.length) {
    if (settings.setBasedScoring) cols.splice(cols.indexOf('POINTS'), 0, 'SETS');
    if (settings.rankBy === 'NET_RUN_RATE' || isCricket) cols.splice(cols.indexOf('POINTS'), 0, 'NET_RUN_RATE');
    if (settings.useFairPlayTiebreaker) cols.splice(cols.indexOf('POINTS'), 0, 'FAIR_PLAY');
    if (isSwiss && settings.useBuchholzSwiss !== false) cols.push('BUCHHOLZ');
    const crit = (settings.standingsCriteria ?? []) as StandingsCriterion[];
    if (crit.includes('BUCHHOLZ') || crit.includes('MEDIAN_BUCHHOLZ')) {
      if (!cols.includes('BUCHHOLZ')) cols.push('BUCHHOLZ');
    }
    if (hasAdjustments) cols.push('ADJUSTMENTS');
  }
  if (!cols.includes('RANK')) cols = ['RANK', ...cols];
  if (!cols.includes('TEAM')) cols.splice(1, 0, 'TEAM');
  return [...new Set(cols)];
}

function primaryRankLabel(settings: TournamentSettings, isCricket: boolean): string {
  const rankBy = settings.rankBy ?? 'MATCH_WINS';
  switch (rankBy) {
    case 'TOURNAMENT_POINTS':
      return 'points';
    case 'MATCH_WINS':
      return 'wins';
    case 'NET_RUN_RATE':
      return 'net run rate';
    case 'GAME_SET_WINS':
      return 'sets won';
    case 'GAME_SET_WIN_PCT':
      return 'set win percentage';
    case 'GAME_SET_DIFF':
      return 'set difference';
    case 'POINTS_SCORED':
      return 'points scored';
    case 'POINTS_DIFF':
      return 'points difference';
    default: {
      const opt = RANK_BY_OPTIONS.find((o) => o.value === rankBy);
      return opt?.label.toLowerCase() ?? (isCricket ? 'points' : 'points');
    }
  }
}

function effectiveCriteria(settings: TournamentSettings, isSwiss: boolean, isCricket: boolean): StandingsCriterion[] {
  const explicit = settings.standingsCriteria as StandingsCriterion[] | undefined;
  if (explicit && explicit.length) return explicit;
  // Mirrors the engine's legacy mapping so the footnote matches how rows were actually ranked.
  const list: StandingsCriterion[] = [];
  if (settings.useHeadToHead !== false) list.push('HEAD_TO_HEAD');
  list.push('POINTS');
  if (settings.rankBy === 'NET_RUN_RATE' || isCricket) list.push('NET_RUN_RATE');
  list.push('SCORE_DIFF', 'SCORE_FOR', 'WINS');
  if (settings.useFairPlayTiebreaker) list.push('FAIR_PLAY');
  if (isSwiss && settings.useBuchholzSwiss !== false) list.push('BUCHHOLZ');
  if (settings.enableToss) list.push('DRAW_LOTS');
  return list;
}

export function StandingsTable({
  tournament,
  showFootnote = true,
}: {
  tournament: Tournament;
  /** Hide the tiebreak explanation (e.g. in compact overview cards). */
  showFootnote?: boolean;
}) {
  const settings = (tournament.settings ?? {}) as TournamentSettings;
  const isCricket =
    settings.rankBy === 'NET_RUN_RATE' ||
    !!tournament.game?.name?.toLowerCase().includes('cricket');
  const isSwiss = tournament.format === 'SWISS';
  const isTime = tournament.format === 'TIME_TRIAL';
  const isEvent =
    tournament.format === 'TIME_TRIAL' ||
    tournament.format === 'SINGLE_RACE' ||
    tournament.format === 'GRAND_PRIX' ||
    tournament.format === 'LEADERBOARD';
  const isGroups = tournament.groups.length > 0;

  const hasAdjustments =
    tournament.standings.some((s) => (s.adjustments ?? 0) !== 0) ||
    (tournament.standingAdjustments?.length ?? 0) > 0 ||
    ((settings.standingsColumns as string[] | undefined)?.includes('ADJUSTMENTS') ?? false);

  const columns = useMemo(
    () => resolveColumns({ settings, isEvent, isSwiss, hasAdjustments, isCricket }),
    [settings, isEvent, isSwiss, hasAdjustments, isCricket],
  );

  const adjustmentsQuery = useQuery({
    queryKey: ['standings-adjustments', tournament.id],
    queryFn: () =>
      api<StandingAdjustment[]>(`/tournaments/${tournament.id}/standings/adjustments`),
    enabled: hasAdjustments && columns.includes('ADJUSTMENTS') && !tournament.standingAdjustments,
    staleTime: 30_000,
  });
  const adjustments = tournament.standingAdjustments ?? adjustmentsQuery.data ?? [];
  const adjustmentsByTeam = useMemo(() => {
    const map = new Map<string, StandingAdjustment[]>();
    for (const a of adjustments) {
      if (!map.has(a.teamId)) map.set(a.teamId, []);
      map.get(a.teamId)!.push(a);
    }
    return map;
  }, [adjustments]);

  const form = useMemo(
    () => (columns.includes('FORM') ? computeForm(tournament.matches) : new Map<string, FormResult[]>()),
    [columns, tournament.matches],
  );

  const groups = isGroups
    ? [...tournament.groups].sort((a, b) => a.order - b.order)
    : [{ id: null as string | null, name: 'Overall standings', order: 0 }];
  const [activeGroup, setActiveGroup] = useState<string | 'ALL'>(groups[0]?.id ?? 'ALL');
  const useTabs = isGroups && groups.length > 1;

  if (!tournament.standings.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Standings appear after results are entered.
      </p>
    );
  }

  const advancePerGroup =
    tournament.format === 'GROUPS_KNOCKOUT' && isGroups ? tournament.advancePerGroup ?? 0 : 0;

  const pfLabel = isTime
    ? 'Best time'
    : isCricket
      ? 'Runs'
      : (settings.rankBy ?? '').startsWith('GAME_SET') || (settings.rankBy ?? '').startsWith('POINTS')
        ? 'For'
        : STANDINGS_COLUMNS_META.SCORE_FOR.short;
  const paLabel = isCricket
    ? 'Runs ag'
    : (settings.rankBy ?? '').startsWith('GAME_SET') || (settings.rankBy ?? '').startsWith('POINTS')
      ? 'Ag'
      : STANDINGS_COLUMNS_META.SCORE_AGAINST.short;

  const header = (col: StandingsColumn) => {
    if (col === 'SCORE_FOR') return pfLabel;
    if (col === 'SCORE_AGAINST') return paLabel;
    return STANDINGS_COLUMNS_META[col].short;
  };

  const cell = (col: StandingsColumn, s: Standing) => {
    switch (col) {
      case 'RANK':
        return <span className="font-semibold">{s.rank}</span>;
      case 'TEAM':
        return (
          <span className="font-medium">
            {settings.hideSeedNumbers !== true && s.team.seed != null && (
              <span className="mr-1.5 text-[10px] text-[var(--color-muted)]">{s.team.seed}</span>
            )}
            {s.team.name}
          </span>
        );
      case 'PLAYED':
        return s.played;
      case 'WINS':
        return s.wins;
      case 'DRAWS':
        return s.draws;
      case 'LOSSES':
        return s.losses;
      case 'SCORE_FOR':
        return s.pointsFor;
      case 'SCORE_AGAINST':
        return s.pointsAgainst;
      case 'SCORE_DIFF':
        return <span className="tabular-nums">{signed(s.pointsFor - s.pointsAgainst)}</span>;
      case 'SETS':
        return (
          <span className="tabular-nums" title="Sets won – lost">
            {s.setsWon ?? 0}–{s.setsLost ?? 0}
          </span>
        );
      case 'POINTS':
        return <span className="font-semibold">{s.points}</span>;
      case 'ADJUSTMENTS': {
        const value = s.adjustments ?? 0;
        const list = adjustmentsByTeam.get(s.teamId ?? s.team.id) ?? [];
        const body = (
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
              value > 0
                ? 'bg-emerald-500/15 text-emerald-600'
                : value < 0
                  ? 'bg-rose-500/15 text-rose-600'
                  : 'text-[var(--color-muted)]'
            }`}
          >
            {value === 0 ? '—' : signed(value)}
          </span>
        );
        if (!list.length) return body;
        return (
          <SimpleTooltip
            label={
              <ul className="max-w-xs space-y-1 text-xs">
                {list.map((a) => (
                  <li key={a.id}>
                    <span className="font-semibold tabular-nums">{signed(a.points)}</span> · {a.reason}
                  </li>
                ))}
              </ul>
            }
          >
            <button type="button" className="cursor-help">
              {body}
            </button>
          </SimpleTooltip>
        );
      }
      case 'FORM':
        return <FormPills form={form.get(s.teamId ?? s.team.id)} />;
      case 'NET_RUN_RATE':
        return (
          <span className="font-mono text-xs">
            {s.netRunRate != null ? (s.netRunRate >= 0 ? '+' : '') + s.netRunRate.toFixed(3) : '—'}
          </span>
        );
      case 'BUCHHOLZ':
        return <span className="tabular-nums">{s.buchholz != null ? s.buchholz : '—'}</span>;
      case 'FAIR_PLAY':
        return s.team.fairPlayPoints ?? 0;
      default:
        return null;
    }
  };

  const footnote =
    showFootnote && !isEvent
      ? describeStandingsCriteria(
          primaryRankLabel(settings, isCricket),
          effectiveCriteria(settings, isSwiss, isCricket),
        )
      : null;

  const rowsFor = (groupId: string | null) => {
    if (!isGroups) return tournament.standings;
    const rows = tournament.standings.filter((s) => s.groupId === groupId);
    return rows;
  };

  const visibleGroups = useTabs
    ? activeGroup === 'ALL'
      ? groups
      : groups.filter((g) => g.id === activeGroup)
    : groups;

  return (
    <div className="space-y-4">
      {useTabs && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Groups">
          {groups.map((g) => (
            <button
              key={g.id ?? 'all'}
              type="button"
              role="tab"
              aria-selected={activeGroup === g.id}
              onClick={() => setActiveGroup(g.id ?? 'ALL')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                activeGroup === g.id
                  ? 'bg-[var(--color-accent)] text-[#0a0c10]'
                  : 'border border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {g.name}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={activeGroup === 'ALL'}
            onClick={() => setActiveGroup('ALL')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              activeGroup === 'ALL'
                ? 'bg-[var(--color-accent)] text-[#0a0c10]'
                : 'border border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            All groups
          </button>
        </div>
      )}

      {visibleGroups.map((g) => {
        const rows = rowsFor(g.id);
        if (!rows.length) return null;
        return (
          <section key={g.id ?? 'all'}>
            {(!useTabs || activeGroup === 'ALL') && (
              <h3 className="font-display text-lg font-semibold">{g.name}</h3>
            )}
            <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-ink)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface)] text-left text-[var(--color-ink)]">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className={`px-3 py-2 ${col === 'TEAM' ? '' : 'whitespace-nowrap'}`}
                        title={STANDINGS_COLUMNS_META[col].description}
                      >
                        {header(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const advancing = advancePerGroup > 0 && s.rank <= advancePerGroup;
                    return (
                      <tr
                        key={s.teamId ?? s.team.id}
                        className={`border-t border-[var(--color-line)] text-[var(--color-ink)] transition-colors even:bg-[var(--color-surface)]/40 ${
                          advancing
                            ? 'border-l-2 border-l-[var(--color-accent)] bg-[var(--color-accent)]/5'
                            : 'border-l-2 border-l-transparent'
                        }`}
                        title={advancing ? 'Advances to the knockout stage' : undefined}
                      >
                        {columns.map((col) => (
                          <td key={col} className={`px-3 py-2 ${col === 'TEAM' ? '' : 'tabular-nums'}`}>
                            {cell(col, s)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {advancePerGroup > 0 && (
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                Top {advancePerGroup} advance to the knockout stage.
              </p>
            )}
          </section>
        );
      })}

      {footnote && (
        <p className="text-xs text-[var(--color-muted)]">{footnote}</p>
      )}
    </div>
  );
}