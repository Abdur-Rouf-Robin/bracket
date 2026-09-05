import type { RankBy, StandingsCriterion } from '@bracket/shared';
import { seededShuffle } from '@bracket/shared';
import type { EngineTeam, FormResult, MatchResultLike, StandingRow } from './types';

export type Criterion = StandingsCriterion;

export interface StandingsOptions {
  rankBy?: RankBy;
  pointsWin?: number;
  pointsDraw?: number;
  /** Points awarded for a loss (can be negative). */
  pointsLoss?: number;
  /**
   * Ordered tiebreakers applied after the primary `rankBy` metric.
   * When omitted the legacy flags (`useHeadToHead`, `useBuchholz`, …) build
   * an equivalent list so existing callers keep their behaviour.
   */
  criteria?: Criterion[];
  /** Manual point adjustments per team (added to `points`). */
  adjustments?: Map<string, number>;
  useHeadToHead?: boolean;
  enableToss?: boolean;
  useBuchholz?: boolean;
  useFairPlay?: boolean;
  /** Seed string for drawing of lots (tournament id). */
  tossSeed?: string;
  netRunRateByTeam?: Map<string, number>;
}

function gamesWon(teamId: string, m: MatchResultLike): number {
  if (m.status !== 'COMPLETED') return 0;
  if (m.homeTeamId === teamId) return m.homeScore ?? 0;
  if (m.awayTeamId === teamId) return m.awayScore ?? 0;
  return 0;
}

function gamesLost(teamId: string, m: MatchResultLike): number {
  if (m.status !== 'COMPLETED') return 0;
  if (m.homeTeamId === teamId) return m.awayScore ?? 0;
  if (m.awayTeamId === teamId) return m.homeScore ?? 0;
  return 0;
}

function isPlayable(m: MatchResultLike): boolean {
  return m.status === 'COMPLETED' && !!m.homeTeamId && !!m.awayTeamId;
}

/** Mini-table among a set of tied teams using only their mutual matches. */
export function headToHeadTable(
  teamIds: string[],
  matches: MatchResultLike[],
  pointsWin: number,
  pointsDraw: number,
  pointsLoss = 0,
): Map<string, { points: number; diff: number; scored: number }> {
  const set = new Set(teamIds);
  const table = new Map<string, { points: number; diff: number; scored: number }>();
  for (const id of teamIds) table.set(id, { points: 0, diff: 0, scored: 0 });

  for (const m of matches) {
    if (!isPlayable(m)) continue;
    const h = m.homeTeamId!;
    const a = m.awayTeamId!;
    if (!set.has(h) || !set.has(a)) continue;
    const home = table.get(h)!;
    const away = table.get(a)!;
    if (!m.isNoResult) {
      const hs = m.homeScore ?? 0;
      const as = m.awayScore ?? 0;
      home.scored += hs;
      away.scored += as;
      home.diff += hs - as;
      away.diff += as - hs;
    }
    if (m.isDraw) {
      home.points += pointsDraw;
      away.points += pointsDraw;
    } else if (m.winnerTeamId === h) {
      home.points += pointsWin;
      away.points += pointsLoss;
    } else if (m.winnerTeamId === a) {
      away.points += pointsWin;
      home.points += pointsLoss;
    }
  }
  return table;
}

/** Legacy helper kept for callers that only need mutual points. */
export function headToHeadPoints(
  teamIds: string[],
  matches: MatchResultLike[],
  pointsWin: number,
  pointsDraw: number,
): Map<string, number> {
  const table = headToHeadTable(teamIds, matches, pointsWin, pointsDraw);
  return new Map([...table.entries()].map(([id, row]) => [id, row.points]));
}

function opponentsOf(teamId: string, matches: MatchResultLike[]) {
  const result: { opponentId: string; outcome: 'W' | 'D' | 'L' }[] = [];
  for (const m of matches) {
    if (!isPlayable(m)) continue;
    const isHome = m.homeTeamId === teamId;
    const isAway = m.awayTeamId === teamId;
    if (!isHome && !isAway) continue;
    const opponentId = isHome ? m.awayTeamId! : m.homeTeamId!;
    const outcome: 'W' | 'D' | 'L' = m.isDraw
      ? 'D'
      : m.winnerTeamId === teamId
        ? 'W'
        : 'L';
    result.push({ opponentId, outcome });
  }
  return result;
}

/** Sum of opponents' points. */
export function buchholzScore(
  teamId: string,
  matches: MatchResultLike[],
  pointsByTeam: Map<string, number>,
): number {
  let total = 0;
  for (const { opponentId } of opponentsOf(teamId, matches)) {
    total += pointsByTeam.get(opponentId) ?? 0;
  }
  return total;
}

/** Buchholz with the best and worst opponent removed (needs 3+ opponents). */
export function medianBuchholzScore(
  teamId: string,
  matches: MatchResultLike[],
  pointsByTeam: Map<string, number>,
): number {
  const scores = opponentsOf(teamId, matches).map(
    ({ opponentId }) => pointsByTeam.get(opponentId) ?? 0,
  );
  if (scores.length < 3) return scores.reduce((a, b) => a + b, 0);
  scores.sort((a, b) => a - b);
  return scores.slice(1, -1).reduce((a, b) => a + b, 0);
}

/** Points of defeated opponents + half the points of drawn opponents. */
export function sonnebornBergerScore(
  teamId: string,
  matches: MatchResultLike[],
  pointsByTeam: Map<string, number>,
): number {
  let total = 0;
  for (const { opponentId, outcome } of opponentsOf(teamId, matches)) {
    const pts = pointsByTeam.get(opponentId) ?? 0;
    if (outcome === 'W') total += pts;
    else if (outcome === 'D') total += pts / 2;
  }
  return total;
}

/** Last N results (oldest first) in the order matches were provided. */
export function computeForm(
  teamId: string,
  matches: MatchResultLike[],
  length = 5,
): FormResult[] {
  const out: FormResult[] = [];
  for (const m of matches) {
    if (!isPlayable(m)) continue;
    if (m.homeTeamId !== teamId && m.awayTeamId !== teamId) continue;
    if (m.isDraw) out.push('D');
    else if (m.winnerTeamId === teamId) out.push('W');
    else out.push('L');
  }
  return out.slice(-length);
}

function primaryMetric(row: StandingRow, rankBy: RankBy): number {
  switch (rankBy) {
    case 'TOURNAMENT_POINTS':
      return row.points;
    case 'NET_RUN_RATE':
      return row.netRunRate ?? 0;
    case 'GAME_SET_WINS':
      return row.pointsFor;
    case 'GAME_SET_DIFF':
      return row.pointsFor - row.pointsAgainst;
    case 'GAME_SET_WIN_PCT':
      return row.pointsFor + row.pointsAgainst > 0
        ? row.pointsFor / (row.pointsFor + row.pointsAgainst)
        : 0;
    case 'POINTS_SCORED':
      return row.pointsFor;
    case 'POINTS_DIFF':
      return row.pointsFor - row.pointsAgainst;
    case 'CUSTOM':
    case 'MATCH_WINS':
    default:
      return row.wins;
  }
}

/** Deterministic pseudo-random order for a set of tied teams. */
export function drawLotsOrder(teamIds: string[], seed: string): Map<string, number> {
  const sorted = [...teamIds].sort();
  const shuffled = seededShuffle(
    sorted.map((id) => ({ id })),
    `${seed}:draw-lots:${sorted.join(',')}`,
    'draw-lots',
  ).items;
  return new Map(shuffled.map((item, i) => [item.id, i]));
}

/** Build the legacy tiebreak chain from boolean flags (pre-criteria behaviour). */
function legacyCriteria(opts: {
  useHeadToHead: boolean;
  useBuchholz: boolean;
  useFairPlay: boolean;
  enableToss: boolean;
  hasNrr: boolean;
}): Criterion[] {
  const list: Criterion[] = [];
  if (opts.useHeadToHead) list.push('HEAD_TO_HEAD');
  list.push('POINTS');
  if (opts.hasNrr) list.push('NET_RUN_RATE');
  list.push('SCORE_DIFF', 'SCORE_FOR', 'WINS');
  if (opts.useFairPlay) list.push('FAIR_PLAY');
  if (opts.useBuchholz) list.push('BUCHHOLZ');
  if (opts.enableToss) list.push('DRAW_LOTS');
  return list;
}

type TieContext = {
  matches: MatchResultLike[];
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  pointsByTeam: Map<string, number>;
  tossSeed: string;
  rows: Map<string, StandingRow>;
};

/**
 * Metric for one criterion over a set of tied rows. Higher is better.
 * Returns a tuple per team so multi-step criteria (head-to-head mini-table)
 * can be compared lexicographically.
 */
function criterionMetrics(
  criterion: Criterion,
  tied: StandingRow[],
  ctx: TieContext,
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const ids = tied.map((r) => r.teamId);
  switch (criterion) {
    case 'HEAD_TO_HEAD': {
      const table = headToHeadTable(
        ids,
        ctx.matches,
        ctx.pointsWin,
        ctx.pointsDraw,
        ctx.pointsLoss,
      );
      for (const id of ids) {
        const row = table.get(id)!;
        out.set(id, [row.points, row.diff, row.scored]);
      }
      return out;
    }
    case 'DRAW_LOTS': {
      const order = drawLotsOrder(ids, ctx.tossSeed);
      for (const id of ids) out.set(id, [-(order.get(id) ?? 0)]);
      return out;
    }
    case 'BUCHHOLZ':
      for (const r of tied) {
        out.set(r.teamId, [
          r.buchholz ?? buchholzScore(r.teamId, ctx.matches, ctx.pointsByTeam),
        ]);
      }
      return out;
    case 'MEDIAN_BUCHHOLZ':
      for (const r of tied) {
        out.set(r.teamId, [
          r.medianBuchholz ??
            medianBuchholzScore(r.teamId, ctx.matches, ctx.pointsByTeam),
        ]);
      }
      return out;
    case 'SONNEBORN_BERGER':
      for (const r of tied) {
        out.set(r.teamId, [
          r.sonnebornBerger ??
            sonnebornBergerScore(r.teamId, ctx.matches, ctx.pointsByTeam),
        ]);
      }
      return out;
    default:
      for (const r of tied) out.set(r.teamId, [simpleMetric(criterion, r)]);
      return out;
  }
}

function simpleMetric(criterion: Criterion, r: StandingRow): number {
  switch (criterion) {
    case 'POINTS':
      return r.points;
    case 'WINS':
      return r.wins;
    case 'SCORE_DIFF':
      return r.pointsFor - r.pointsAgainst;
    case 'SCORE_FOR':
      return r.pointsFor;
    case 'SCORE_AGAINST':
      return -r.pointsAgainst;
    case 'SETS_WON':
      return r.setsWon ?? 0;
    case 'SET_DIFF':
      return (r.setsWon ?? 0) - (r.setsLost ?? 0);
    case 'GAMES_PLAYED':
      return -r.played;
    case 'FAIR_PLAY':
      return -(r.fairPlayPoints ?? 0);
    case 'NET_RUN_RATE':
      return r.netRunRate ?? 0;
    default:
      return 0;
  }
}

function compareTuples(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (b[i] ?? 0) - (a[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Recursively resolve a bucket of tied rows with the ordered criteria list.
 * Each criterion splits the bucket into sub-buckets; sub-buckets continue
 * with the remaining criteria. Ends with a stable team-id order.
 */
function resolveTies(
  tied: StandingRow[],
  criteria: Criterion[],
  ctx: TieContext,
): StandingRow[] {
  if (tied.length <= 1) return tied;
  if (!criteria.length) {
    return [...tied].sort((a, b) => a.teamId.localeCompare(b.teamId));
  }
  const [criterion, ...rest] = criteria;
  const metrics = criterionMetrics(criterion!, tied, ctx);
  const sorted = [...tied].sort((a, b) =>
    compareTuples(metrics.get(a.teamId) ?? [], metrics.get(b.teamId) ?? []),
  );

  const out: StandingRow[] = [];
  let bucket: StandingRow[] = [];
  for (const row of sorted) {
    if (
      bucket.length &&
      compareTuples(
        metrics.get(bucket[0]!.teamId) ?? [],
        metrics.get(row.teamId) ?? [],
      ) !== 0
    ) {
      out.push(...resolveTies(bucket, rest, ctx));
      bucket = [];
    }
    bucket.push(row);
  }
  if (bucket.length) out.push(...resolveTies(bucket, rest, ctx));
  return out;
}

export function computeStandingsInternational(
  teams: EngineTeam[],
  matches: MatchResultLike[],
  options: StandingsOptions = {},
): StandingRow[] {
  const {
    rankBy = 'TOURNAMENT_POINTS',
    pointsWin = 3,
    pointsDraw = 1,
    pointsLoss = 0,
    useHeadToHead = true,
    enableToss = false,
    useBuchholz = false,
    useFairPlay = false,
    tossSeed = 'bracket',
    netRunRateByTeam,
    adjustments,
  } = options;

  const map = new Map<string, StandingRow>();
  for (const t of teams) {
    map.set(t.id, {
      teamId: t.id,
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      points: 0,
      rank: 0,
      groupId: t.groupId ?? null,
      fairPlayPoints: t.fairPlayPoints ?? 0,
      setsWon: 0,
      setsLost: 0,
      adjustments: 0,
      form: [],
    });
  }

  for (const m of matches) {
    if (m.status !== 'COMPLETED') continue;
    if (!m.homeTeamId || !m.awayTeamId) continue;
    const home = map.get(m.homeTeamId);
    const away = map.get(m.awayTeamId);
    if (!home || !away) continue;

    const isNr = m.isNoResult === true;
    const hs = isNr ? 0 : (m.homeScore ?? 0);
    const as = isNr ? 0 : (m.awayScore ?? 0);
    home.played += 1;
    away.played += 1;

    if (!isNr) {
      home.pointsFor += hs;
      home.pointsAgainst += as;
      away.pointsFor += as;
      away.pointsAgainst += hs;
      const hSets = m.homeSetsWon ?? null;
      const aSets = m.awaySetsWon ?? null;
      if (hSets != null && aSets != null) {
        home.setsWon = (home.setsWon ?? 0) + hSets;
        home.setsLost = (home.setsLost ?? 0) + aSets;
        away.setsWon = (away.setsWon ?? 0) + aSets;
        away.setsLost = (away.setsLost ?? 0) + hSets;
      }
    }

    if (m.isDraw) {
      home.draws += 1;
      away.draws += 1;
      home.points += pointsDraw;
      away.points += pointsDraw;
    } else if (m.winnerTeamId === m.homeTeamId) {
      home.wins += 1;
      away.losses += 1;
      home.points += pointsWin;
      away.points += pointsLoss;
    } else if (m.winnerTeamId === m.awayTeamId) {
      away.wins += 1;
      home.losses += 1;
      away.points += pointsWin;
      home.points += pointsLoss;
    }
  }

  if (rankBy === 'GAME_SET_WINS' || rankBy === 'GAME_SET_DIFF' || rankBy === 'GAME_SET_WIN_PCT') {
    for (const t of teams) {
      const row = map.get(t.id)!;
      row.pointsFor = 0;
      row.pointsAgainst = 0;
      for (const m of matches) {
        row.pointsFor += gamesWon(t.id, m);
        row.pointsAgainst += gamesLost(t.id, m);
      }
    }
  }

  if (adjustments) {
    for (const [teamId, delta] of adjustments) {
      const row = map.get(teamId);
      if (!row || !delta) continue;
      row.adjustments = (row.adjustments ?? 0) + delta;
      row.points += delta;
    }
  }

  const rows = [...map.values()];
  if (netRunRateByTeam) {
    for (const row of rows) {
      row.netRunRate = netRunRateByTeam.get(row.teamId) ?? 0;
    }
  }

  const criteriaBase: Criterion[] =
    options.criteria && options.criteria.length
      ? [...options.criteria]
      : legacyCriteria({
          useHeadToHead,
          useBuchholz,
          useFairPlay,
          enableToss,
          hasNrr: !!netRunRateByTeam,
        });
  let criteria = criteriaBase;
  if (options.criteria && options.criteria.length) {
    if (!useHeadToHead) criteria = criteria.filter((c) => c !== 'HEAD_TO_HEAD');
    if (useFairPlay && !criteria.includes('FAIR_PLAY')) criteria.push('FAIR_PLAY');
    if (useBuchholz && !criteria.includes('BUCHHOLZ')) criteria.push('BUCHHOLZ');
    if (netRunRateByTeam && !criteria.includes('NET_RUN_RATE')) criteria.push('NET_RUN_RATE');
    if (enableToss && !criteria.includes('DRAW_LOTS')) criteria.push('DRAW_LOTS');
  }

  const byGroup = new Map<string, StandingRow[]>();
  for (const row of rows) {
    const g = row.groupId ?? '__all__';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(row);
  }

  for (const [, groupRows] of byGroup) {
    const groupId = groupRows[0]?.groupId ?? null;
    const groupMatches =
      groupId != null ? matches.filter((m) => m.groupId === groupId) : matches;

    const pointsByTeam = new Map(groupRows.map((r) => [r.teamId, r.points]));
    for (const row of groupRows) {
      row.buchholz = buchholzScore(row.teamId, groupMatches, pointsByTeam);
      row.medianBuchholz = medianBuchholzScore(row.teamId, groupMatches, pointsByTeam);
      row.sonnebornBerger = sonnebornBergerScore(row.teamId, groupMatches, pointsByTeam);
      row.form = computeForm(row.teamId, groupMatches);
    }

    const ctx: TieContext = {
      matches: groupMatches,
      pointsWin,
      pointsDraw,
      pointsLoss,
      pointsByTeam,
      tossSeed,
      rows: map,
    };

    const tiedBuckets = new Map<number, StandingRow[]>();
    for (const row of groupRows) {
      const metric = primaryMetric(row, rankBy);
      if (!tiedBuckets.has(metric)) tiedBuckets.set(metric, []);
      tiedBuckets.get(metric)!.push(row);
    }
    const metrics = [...tiedBuckets.keys()].sort((a, b) => b - a);
    const ranked: StandingRow[] = [];
    for (const metric of metrics) {
      ranked.push(...resolveTies(tiedBuckets.get(metric)!, criteria, ctx));
    }
    ranked.forEach((r, i) => {
      r.rank = i + 1;
    });
  }

  return rows.sort((a, b) => {
    const ga = a.groupId ?? '';
    const gb = b.groupId ?? '';
    if (ga !== gb) return ga.localeCompare(gb);
    return a.rank - b.rank;
  });
}
