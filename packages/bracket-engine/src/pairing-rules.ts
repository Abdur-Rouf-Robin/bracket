import type { BracketSide } from '@bracket/shared';
import { BracketSide as BracketSideEnum } from '@bracket/shared';
import type { EngineGroup, EngineTeam, GeneratedMatch, StandingRow } from './types';

export interface KnockoutPairing {
  homeTeamId: string;
  awayTeamId: string;
}

/** Reconstruct advancers matrix: byGroup[groupIndex][rankIndex] */
export function advancersByGroup(
  advancers: string[],
  groupCount: number,
  advancePerGroup: number,
): string[][] {
  const byGroup: string[][] = Array.from({ length: groupCount }, () => []);
  for (let rank = 0; rank < advancePerGroup; rank++) {
    for (let g = 0; g < groupCount; g++) {
      const id = advancers[rank * groupCount + g];
      if (id) byGroup[g].push(id);
    }
  }
  return byGroup;
}

/**
 * FIFA / UEFA-style cross-group knockout pairings.
 * Avoids same-group rematches in round 1 where possible.
 */
export function buildInternationalKnockoutPairings(
  groupCount: number,
  advancePerGroup: number,
  advancers: string[],
): KnockoutPairing[] {
  const byGroup = advancersByGroup(advancers, groupCount, advancePerGroup);

  if (advancePerGroup === 1) {
    const pairs: KnockoutPairing[] = [];
    for (let i = 0; i < groupCount; i += 2) {
      if (i + 1 < groupCount) {
        pairs.push({
          homeTeamId: byGroup[i][0],
          awayTeamId: byGroup[i + 1][0],
        });
      } else {
        pairs.push({ homeTeamId: byGroup[i][0], awayTeamId: byGroup[i][0] });
      }
    }
    return pairs;
  }

  if (advancePerGroup === 2 && groupCount === 2) {
    return [
      { homeTeamId: byGroup[0][0], awayTeamId: byGroup[1][1] },
      { homeTeamId: byGroup[1][0], awayTeamId: byGroup[0][1] },
    ];
  }

  if (advancePerGroup === 2 && groupCount === 4) {
    return [
      { homeTeamId: byGroup[0][0], awayTeamId: byGroup[1][1] },
      { homeTeamId: byGroup[2][0], awayTeamId: byGroup[3][1] },
      { homeTeamId: byGroup[1][0], awayTeamId: byGroup[0][1] },
      { homeTeamId: byGroup[3][0], awayTeamId: byGroup[2][1] },
    ];
  }

  if (advancePerGroup === 2 && groupCount === 8) {
    // FIFA World Cup R16: 1A–2B, 1C–2D, 1E–2F, 1G–2H, 1B–2A, 1D–2C, 1F–2E, 1H–2G
    const templates = [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [1, 0],
      [3, 2],
      [5, 4],
      [7, 6],
    ];
    const pairs: KnockoutPairing[] = [];
    for (let i = 0; i < 8; i++) {
      const [wG, rG] = templates[i];
      pairs.push({
        homeTeamId: byGroup[wG][0],
        awayTeamId: byGroup[rG][1],
      });
    }
    return pairs;
  }

  if (groupCount === 6 && advancePerGroup === 2 && advancers.length >= 16) {
    return buildEuroSixGroupKnockoutPairings(advancers);
  }

  const pairs: KnockoutPairing[] = [];
  for (let g = 0; g < groupCount; g++) {
    const winner = byGroup[g][0];
    const runnerGroup = (g + Math.ceil(groupCount / 2)) % groupCount;
    const runner = byGroup[runnerGroup]?.[1] ?? byGroup[runnerGroup]?.[0];
    if (winner && runner && winner !== runner) {
      pairs.push({ homeTeamId: winner, awayTeamId: runner });
    }
  }
  for (let g = 0; g < groupCount && advancePerGroup > 1; g++) {
    if (pairs.length >= groupCount) break;
    const second = byGroup[g][1];
    const oppGroup = (g + 1) % groupCount;
    const opp = byGroup[oppGroup]?.[0];
    if (second && opp && second !== opp) {
      const key = [second, opp].sort().join(':');
      if (!pairs.some((p) => [p.homeTeamId, p.awayTeamId].sort().join(':') === key)) {
        pairs.push({ homeTeamId: second, awayTeamId: opp });
      }
    }
  }
  return pairs;
}

/**
 * UEFA Euro 24-team R16 matrix: 6 groups × top-2 + 4 best thirds.
 * Advancers order: G0#1..G5#1, G0#2..G5#2, T0..T3 (best thirds).
 */
export function buildEuroSixGroupKnockoutPairings(
  advancers: string[],
): KnockoutPairing[] {
  const w = (g: number) => advancers[g]!;
  const r = (g: number) => advancers[6 + g]!;
  const t = (i: number) => advancers[12 + i]!;

  return [
    { homeTeamId: w(0), awayTeamId: r(1) }, // 1A vs 2B
    { homeTeamId: w(2), awayTeamId: t(0) }, // 1C vs best 3rd
    { homeTeamId: w(1), awayTeamId: t(1) }, // 1B vs 2nd best 3rd
    { homeTeamId: w(5), awayTeamId: t(2) }, // 1F vs 3rd best 3rd
    { homeTeamId: r(5), awayTeamId: r(4) }, // 2F vs 2E
    { homeTeamId: w(3), awayTeamId: r(2) }, // 1D vs 2C
    { homeTeamId: w(4), awayTeamId: t(3) }, // 1E vs 4th best 3rd
    { homeTeamId: r(0), awayTeamId: r(3) }, // 2A vs 2D
  ];
}

export function seedKnockoutRound1International(
  round1Matches: { id: string; position: number }[],
  advancerIds: string[],
  groupCount: number,
  advancePerGroup: number,
): { matchId: string; homeTeamId: string | null; awayTeamId: string | null }[] {
  const pairings = buildInternationalKnockoutPairings(
    groupCount,
    advancePerGroup,
    advancerIds,
  );
  const sorted = [...round1Matches].sort((a, b) => a.position - b.position);
  const result: {
    matchId: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
  }[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const pairing = pairings[i];
    if (pairing) {
      result.push({
        matchId: sorted[i].id,
        homeTeamId: pairing.homeTeamId,
        awayTeamId: pairing.awayTeamId,
      });
    } else {
      const home = advancerIds[i * 2] ?? null;
      const away = advancerIds[i * 2 + 1] ?? null;
      result.push({ matchId: sorted[i].id, homeTeamId: home, awayTeamId: away });
    }
  }
  return result;
}

/** FIDE Dutch-system style Swiss pairing within score groups. */
export function pairSwissRoundInternational(
  standings: StandingRow[],
  round: number,
  priorPairs: Set<string> = new Set(),
  options: {
    seeds?: Map<string, number>;
    colorBalance?: Map<string, number>;
    mode?: 'SIMPLE' | 'FIDE_DUTCH';
  } = {},
): GeneratedMatch[] {
  const seeds = options.seeds ?? new Map<string, number>();
  const colors = options.colorBalance ?? new Map<string, number>();
  const fideDutch = options.mode === 'FIDE_DUTCH';

  const sorted = [...standings].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return (seeds.get(a.teamId) ?? 999) - (seeds.get(b.teamId) ?? 999);
  });

  const scoreGroups = new Map<number, string[]>();
  for (const row of sorted) {
    const key = row.points;
    if (!scoreGroups.has(key)) scoreGroups.set(key, []);
    scoreGroups.get(key)!.push(row.teamId);
  }

  const orderedScores = [...scoreGroups.keys()].sort((a, b) => b - a);
  const matches: GeneratedMatch[] = [];
  const used = new Set<string>();
  let position = 0;
  let floater: string | null = null;

  const tryPair = (a: string, b: string): boolean => {
    if (a === '__BYE__' || b === '__BYE__') return true;
    const key = [a, b].sort().join(':');
    return !priorPairs.has(key);
  };

  const pairPool = (pool: string[]) => {
    const working = floater ? [floater, ...pool.filter((id) => id !== floater)] : [...pool];
    floater = null;
    const available = working.filter((id) => !used.has(id));
    const half = Math.ceil(available.length / 2);
    const top = available.slice(0, half);
    const bottom = available.slice(half);

    for (let i = 0; i < top.length; i++) {
      const home = top[i]!;
      if (used.has(home)) continue;
      let partner: string | undefined = bottom[i];
      if (!partner || used.has(partner) || !tryPair(home, partner)) {
        partner =
          bottom.find((p) => !used.has(p) && tryPair(home, p)) ??
          available.find((p) => p !== home && !used.has(p) && tryPair(home, p));
      }
      if (!partner) continue;

      used.add(home);
      used.add(partner);
      pushPair(home, partner);
    }

    const leftover = available.filter((id) => !used.has(id));
    if (fideDutch && leftover.length === 1) {
      floater = leftover[0]!;
    }
  };

  const pushPair = (home: string, partner: string) => {
    if (home === '__BYE__' || partner === '__BYE__') {
      const real = home === '__BYE__' ? partner : home;
      matches.push({
        key: `swiss-r${round}-p${position++}`,
        round,
        position: position - 1,
        bracketSide: BracketSideEnum.SWISS,
        homeTeamId: real,
        awayTeamId: null,
        isBye: true,
      });
      return;
    }

    const homeNeedsWhite =
      (colors.get(home) ?? 0) <= (colors.get(partner) ?? 0);
    const whiteId = homeNeedsWhite ? home : partner;
    const blackId = homeNeedsWhite ? partner : home;
    matches.push({
      key: `swiss-r${round}-p${position++}`,
      round,
      position: position - 1,
      bracketSide: BracketSideEnum.SWISS,
      homeTeamId: whiteId,
      awayTeamId: blackId,
    });
    colors.set(whiteId, (colors.get(whiteId) ?? 0) + 1);
    colors.set(blackId, (colors.get(blackId) ?? 0) - 1);
  };

  if (fideDutch) {
    for (const score of orderedScores) {
      const pool = scoreGroups.get(score) ?? [];
      pairPool(pool);
    }
  } else {
    for (const ids of scoreGroups.values()) {
      pairPool(ids);
    }
  }

  const unpaired = sorted.map((s) => s.teamId).filter((id) => !used.has(id));
  if (unpaired.length === 1) {
    matches.push({
      key: `swiss-r${round}-p${position}`,
      round,
      position,
      bracketSide: 'SWISS' as BracketSide,
      homeTeamId: unpaired[0],
      awayTeamId: null,
      isBye: true,
    });
  }

  return matches;
}

/** Traditional bracket seed order (1 vs N, etc.) */
function bracketSeedSlots(size: number): number[] {
  if (size === 1) return [1];
  const half = bracketSeedSlots(size / 2);
  const result: number[] = [];
  for (const s of half) {
    result.push(s);
    result.push(size + 1 - s);
  }
  return result;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function applySeedingOrderInternational(
  teamIds: string[],
  mode: 'TRADITIONAL' | 'LIST_ORDER',
): string[] {
  if (mode === 'LIST_ORDER') return [...teamIds];
  const n = teamIds.length;
  if (n <= 1) return [...teamIds];
  const bracketSize = nextPow2(Math.max(2, n));
  const slots = bracketSeedSlots(bracketSize);
  const ordered: string[] = [];
  const used = new Set<string>();
  for (const slot of slots) {
    const idx = slot - 1;
    if (idx < n && !used.has(teamIds[idx]!)) {
      ordered.push(teamIds[idx]!);
      used.add(teamIds[idx]!);
    }
  }
  for (const id of teamIds) {
    if (!used.has(id)) ordered.push(id);
  }
  return ordered;
}

export function addPlacementThirdMatch(
  matches: GeneratedMatch[],
  prefix: 'se' | 'de' | 'gk',
): GeneratedMatch[] {
  const semis = matches.filter(
    (m) =>
      m.bracketSide === 'WINNERS' &&
      m.nextMatchKey &&
      matches.some((f) => f.key === m.nextMatchKey && f.bracketSide === 'FINAL'),
  );
  if (semis.length !== 2) return matches;

  const thirdKey = `${prefix}-3rd`;
  if (matches.some((m) => m.key === thirdKey)) return matches;

  const third: GeneratedMatch = {
    key: thirdKey,
    round: Math.max(...semis.map((m) => m.round)),
    position: 99,
    bracketSide: 'FINAL',
    homeFromMatchKey: semis[0].key,
    awayFromMatchKey: semis[1].key,
    homeTeamId: null,
    awayTeamId: null,
  };

  semis[0].loserNextMatchKey = thirdKey;
  semis[0].loserNextMatchSlot = 'home';
  semis[1].loserNextMatchKey = thirdKey;
  semis[1].loserNextMatchSlot = 'away';

  return [...matches, third];
}

export function addGrandFinalReset(
  matches: GeneratedMatch[],
): GeneratedMatch[] {
  const gf = matches.find((m) => m.key === 'de-gf');
  if (!gf) return matches;
  if (matches.some((m) => m.key === 'de-gf-reset')) return matches;

  const reset: GeneratedMatch = {
    key: 'de-gf-reset',
    round: gf.round + 1,
    position: 0,
    bracketSide: 'GRAND_FINAL',
    homeFromMatchKey: gf.key,
    awayFromMatchKey: gf.key,
    homeTeamId: null,
    awayTeamId: null,
  };
  return [...matches, reset];
}

export function assignTeamsToGroupsInternational(
  teams: EngineTeam[],
  groupCount: number,
): { groups: EngineGroup[]; teams: EngineTeam[] } {
  const count = Math.max(2, Math.min(groupCount, Math.floor(teams.length / 2)));
  const groups: EngineGroup[] = Array.from({ length: count }, (_, i) => ({
    id: `group-${i + 1}`,
    name: `Group ${String.fromCharCode(65 + i)}`,
    order: i,
  }));

  const sorted = [...teams].sort(
    (a, b) => (a.seed ?? 999) - (b.seed ?? 999),
  );

  const assigned: EngineTeam[] = sorted.map((team) => ({ ...team }));
  for (let i = 0; i < assigned.length; i++) {
    const round = Math.floor(i / count);
    const pos = i % count;
    const groupIdx = round % 2 === 0 ? pos : count - 1 - pos;
    assigned[i] = { ...assigned[i], groupId: groups[groupIdx].id };
  }

  return { groups, teams: assigned };
}

export function planFreeForAll(teams: EngineTeam[]) {
  return [
    {
      eventKey: 'ffa-1',
      eventIndex: 1,
      eventLabel: 'Free for All',
      teamIds: teams.map((t) => t.id),
    },
  ];
}

export function computeFreeForAllStandings(
  teams: EngineTeam[],
  results: {
    teamId: string;
    value: number;
    points: number;
    position: number | null;
    status: string;
  }[],
): StandingRow[] {
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
      groupId: null,
    });
  }
  for (const r of results) {
    if (r.status !== 'COMPLETED') continue;
    const row = map.get(r.teamId);
    if (!row) continue;
    row.played += 1;
    row.points = r.points;
    row.pointsFor = r.value;
  }
  const rows = [...map.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.teamId.localeCompare(b.teamId);
  });
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}
