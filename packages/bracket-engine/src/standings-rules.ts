import type { RankBy } from '@bracket/shared';
import type { EngineTeam, MatchResultLike, StandingRow } from './types';

export interface StandingsOptions {
  rankBy?: RankBy;
  pointsWin?: number;
  pointsDraw?: number;
  useHeadToHead?: boolean;
  enableToss?: boolean;
  useBuchholz?: boolean;
  useFairPlay?: boolean;
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

function headToHeadPoints(
  teamIds: string[],
  matches: MatchResultLike[],
  pointsWin: number,
  pointsDraw: number,
): Map<string, number> {
  const set = new Set(teamIds);
  const h2h = new Map<string, number>();
  for (const id of teamIds) h2h.set(id, 0);

  for (const m of matches) {
    if (m.status !== 'COMPLETED' || !m.homeTeamId || !m.awayTeamId) continue;
    if (!set.has(m.homeTeamId) || !set.has(m.awayTeamId)) continue;
    if (m.isDraw) {
      h2h.set(m.homeTeamId, (h2h.get(m.homeTeamId) ?? 0) + pointsDraw);
      h2h.set(m.awayTeamId, (h2h.get(m.awayTeamId) ?? 0) + pointsDraw);
    } else if (m.winnerTeamId === m.homeTeamId) {
      h2h.set(m.homeTeamId, (h2h.get(m.homeTeamId) ?? 0) + pointsWin);
    } else if (m.winnerTeamId === m.awayTeamId) {
      h2h.set(m.awayTeamId, (h2h.get(m.awayTeamId) ?? 0) + pointsWin);
    }
  }
  return h2h;
}

function buchholzScore(
  teamId: string,
  matches: MatchResultLike[],
  rows: StandingRow[],
): number {
  const opponents = new Set<string>();
  for (const m of matches) {
    if (m.status !== 'COMPLETED') continue;
    if (m.homeTeamId === teamId && m.awayTeamId) opponents.add(m.awayTeamId);
    if (m.awayTeamId === teamId && m.homeTeamId) opponents.add(m.homeTeamId);
  }
  let total = 0;
  for (const opp of opponents) {
    total += rows.find((r) => r.teamId === opp)?.points ?? 0;
  }
  return total;
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

function tossSort(a: string, b: string, seed: string): number {
  const hash = (s: string) => {
    let h = 0;
    const key = `${seed}:${s}`;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return h;
  };
  return hash(a) - hash(b);
}

function compareRows(
  a: StandingRow,
  b: StandingRow,
  rankBy: RankBy,
  h2h?: Map<string, number>,
  useFairPlay?: boolean,
): number {
  const pa = primaryMetric(a, rankBy);
  const pb = primaryMetric(b, rankBy);
  if (pb !== pa) return pb - pa;

  if (h2h) {
    const ha = h2h.get(a.teamId) ?? 0;
    const hb = h2h.get(b.teamId) ?? 0;
    if (hb !== ha) return hb - ha;
  }

  if (b.points !== a.points) return b.points - a.points;
  const nrrA = a.netRunRate ?? 0;
  const nrrB = b.netRunRate ?? 0;
  if (nrrB !== nrrA) return nrrB - nrrA;
  const gdA = a.pointsFor - a.pointsAgainst;
  const gdB = b.pointsFor - b.pointsAgainst;
  if (gdB !== gdA) return gdB - gdA;
  if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (useFairPlay) {
    const fpA = a.fairPlayPoints ?? 0;
    const fpB = b.fairPlayPoints ?? 0;
    if (fpA !== fpB) return fpA - fpB;
  }
  return 0;
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
    useHeadToHead = true,
    enableToss = false,
    useBuchholz = false,
    useFairPlay = false,
    tossSeed = 'bracket',
    netRunRateByTeam,
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
      if (rankBy.startsWith('GAME_SET')) {
        home.pointsFor += hs;
        home.pointsAgainst += as;
        away.pointsFor += as;
        away.pointsAgainst += hs;
      } else {
        home.pointsFor += hs;
        home.pointsAgainst += as;
        away.pointsFor += as;
        away.pointsAgainst += hs;
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
    } else if (m.winnerTeamId === m.awayTeamId) {
      away.wins += 1;
      home.losses += 1;
      away.points += pointsWin;
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

  const rows = [...map.values()];
  if (netRunRateByTeam) {
    for (const row of rows) {
      row.netRunRate = netRunRateByTeam.get(row.teamId) ?? 0;
    }
  }
  const byGroup = new Map<string, StandingRow[]>();
  for (const row of rows) {
    const g = row.groupId ?? '__all__';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(row);
  }

  for (const [, groupRows] of byGroup) {
    const groupMatches =
      groupRows[0]?.groupId != null
        ? matches.filter((m) => m.groupId === groupRows[0].groupId)
        : matches;

    const rankGroup = (subset: StandingRow[]) => {
      const tiedBuckets = new Map<number, StandingRow[]>();
      for (const row of subset) {
        const metric = primaryMetric(row, rankBy);
        if (!tiedBuckets.has(metric)) tiedBuckets.set(metric, []);
        tiedBuckets.get(metric)!.push(row);
      }

      const metrics = [...tiedBuckets.keys()].sort((a, b) => b - a);
      const ranked: StandingRow[] = [];

      for (const metric of metrics) {
        const tied = tiedBuckets.get(metric)!;
        if (useHeadToHead && tied.length > 1) {
          const h2h = headToHeadPoints(
            tied.map((r) => r.teamId),
            groupMatches,
            pointsWin,
            pointsDraw,
          );
          tied.sort((a, b) => {
            let cmp = compareRows(a, b, rankBy, h2h, useFairPlay);
            if (cmp !== 0) return cmp;
            if (useBuchholz) {
              const ba = buchholzScore(a.teamId, groupMatches, rows);
              const bb = buchholzScore(b.teamId, groupMatches, rows);
              if (bb !== ba) return bb - ba;
            }
            if (enableToss) return tossSort(a.teamId, b.teamId, tossSeed);
            return a.teamId.localeCompare(b.teamId);
          });
        } else {
          tied.sort((a, b) => {
            let cmp = compareRows(a, b, rankBy, undefined, useFairPlay);
            if (cmp !== 0) return cmp;
            if (useBuchholz) {
              const ba = buchholzScore(a.teamId, groupMatches, rows);
              const bb = buchholzScore(b.teamId, groupMatches, rows);
              if (bb !== ba) return bb - ba;
            }
            if (enableToss) return tossSort(a.teamId, b.teamId, tossSeed);
            return a.teamId.localeCompare(b.teamId);
          });
        }
        ranked.push(...tied);
      }

      ranked.forEach((r, i) => {
        r.rank = i + 1;
      });
    };

    rankGroup(groupRows);
  }

  return rows.sort((a, b) => {
    const ga = a.groupId ?? '';
    const gb = b.groupId ?? '';
    if (ga !== gb) return ga.localeCompare(gb);
    return a.rank - b.rank;
  });
}
