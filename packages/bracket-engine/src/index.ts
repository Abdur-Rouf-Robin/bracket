import {
  BracketSide,
  FormatSuggestion,
  TournamentFormat,
  seededShuffle,
} from '@bracket/shared';
import {
  addGrandFinalReset,
  addPlacementThirdMatch,
  applySeedingOrderInternational,
  assignTeamsToGroupsInternational,
  computeFreeForAllStandings,
  pairSwissRoundInternational,
  planFreeForAll,
  seedKnockoutRound1International,
} from './pairing-rules';
import {
  buildEuroSixGroupKnockoutPairingsDynamic,
  pickGroupAdvancersWithBestThirdsDetailed,
} from './euro-third-place';
import { buildInternationalKnockoutPairings } from './pairing-rules';
import { computeStandingsInternational, type StandingsOptions } from './standings-rules';
import {
  addConsolationBracket,
  addDoubleElimPlacementMatches,
  addPlacementMatches,
} from './knockout-extras';
import type {
  EngineGroup,
  EngineTeam,
  FinalPlacement,
  FormResult,
  GeneratedMatch,
  GenerateOptions,
  MatchResultLike,
  PlannedEvent,
  PoolColor,
  SetScore,
  Shuffleable,
  StandingRow,
} from './types';

export type {
  EngineGroup,
  EngineTeam,
  FinalPlacement,
  FormResult,
  GeneratedMatch,
  GenerateOptions,
  MatchResultLike,
  PlannedEvent,
  PoolColor,
  SetScore,
  Shuffleable,
  StandingRow,
};
export type { StandingsOptions, Criterion } from './standings-rules';
export {
  buchholzScore,
  computeForm,
  drawLotsOrder,
  headToHeadPoints,
  headToHeadTable,
  medianBuchholzScore,
  sonnebornBergerScore,
} from './standings-rules';
export {
  addConsolationBracket,
  addDoubleElimPlacementMatches,
  addPlacementMatches,
  computeFinalPlacements,
  formatSets,
  isConsolationKey,
  resolveSetsResult,
} from './knockout-extras';
export type {
  FinalPlacementsResult,
  PlacementMatchLike,
  SetsResolution,
} from './knockout-extras';
export { generateSwissPots } from './swiss-pots';
export type { SwissPotsOptions, SwissPotsResult } from './swiss-pots';

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** Circle method round-robin pairs */
export function generateRoundRobin(
  teams: EngineTeam[],
  groupId?: string | null,
): GeneratedMatch[] {
  if (teams.length < 2) return [];

  const list = [...teams];
  if (list.length % 2 === 1) {
    list.push({ id: '__BYE__', name: 'BYE' });
  }

  const n = list.length;
  const rounds = n - 1;
  const half = n / 2;
  const matches: GeneratedMatch[] = [];
  const rotating = list.slice(1);

  for (let round = 1; round <= rounds; round++) {
    const roundTeams = [list[0], ...rotating];
    for (let i = 0; i < half; i++) {
      const home = roundTeams[i];
      const away = roundTeams[n - 1 - i];
      if (home.id === '__BYE__' || away.id === '__BYE__') continue;
      matches.push({
        key: `rr-g${groupId ?? 'all'}-r${round}-p${i}`,
        round,
        position: i,
        bracketSide: BracketSide.GROUP,
        groupId: groupId ?? null,
        homeTeamId: home.id,
        awayTeamId: away.id,
      });
    }
    rotating.unshift(rotating.pop()!);
  }

  return matches;
}

function seedSlots(size: number): number[] {
  if (size === 1) return [1];
  const half = seedSlots(size / 2);
  const result: number[] = [];
  for (const s of half) {
    result.push(s);
    result.push(size + 1 - s);
  }
  return result;
}

export function generateSingleElimination(
  teams: EngineTeam[],
  options: GenerateOptions = {},
): GeneratedMatch[] {
  const sorted = [...teams].sort(
    (a, b) => (a.seed ?? 999) - (b.seed ?? 999),
  );
  const bracketSize = nextPowerOfTwo(
    Math.max(2, sorted.length, options.minBracketSize ?? 0),
  );
  const slots = seedSlots(bracketSize);
  const seeded: (EngineTeam | null)[] = slots.map((seed) => {
    const team = sorted[seed - 1];
    return team ?? null;
  });

  const matches: GeneratedMatch[] = [];
  const totalRounds = Math.log2(bracketSize);

  // Round 1
  for (let i = 0; i < bracketSize / 2; i++) {
    const home = seeded[i * 2];
    const away = seeded[i * 2 + 1];
    const key = `se-r1-p${i}`;
    const isBye = !home || !away;
    matches.push({
      key,
      round: 1,
      position: i,
      bracketSide: BracketSide.WINNERS,
      homeTeamId: home?.id ?? null,
      awayTeamId: away?.id ?? null,
      isBye,
    });
  }

  for (let round = 2; round <= totalRounds; round++) {
    const prevCount = bracketSize / 2 ** (round - 1);
    const count = prevCount / 2;
    for (let i = 0; i < count; i++) {
      const key = `se-r${round}-p${i}`;
      const homeFrom = `se-r${round - 1}-p${i * 2}`;
      const awayFrom = `se-r${round - 1}-p${i * 2 + 1}`;
      matches.push({
        key,
        round,
        position: i,
        bracketSide: round === totalRounds ? BracketSide.FINAL : BracketSide.WINNERS,
        homeFromMatchKey: homeFrom,
        awayFromMatchKey: awayFrom,
        homeTeamId: null,
        awayTeamId: null,
      });
      const homePrev = matches.find((m) => m.key === homeFrom)!;
      const awayPrev = matches.find((m) => m.key === awayFrom)!;
      homePrev.nextMatchKey = key;
      homePrev.nextMatchSlot = 'home';
      awayPrev.nextMatchKey = key;
      awayPrev.nextMatchSlot = 'away';
    }
  }

  // Auto-resolve byes into next match pointers conceptually (engine marks isBye)
  let result = matches;
  const placementThrough = Math.max(
    options.placementMatchesThrough ?? 0,
    options.breakTiesWithPlacement ? 3 : 0,
  );
  if (options.consolationBracket) {
    result = addConsolationBracket(result, 'se');
  }
  if (placementThrough >= 3) {
    result = addPlacementMatches(result, 'se', placementThrough, {
      skipRound1Losers: !!options.consolationBracket,
    });
  }
  if (options.knockoutBestOf && options.knockoutBestOf > 1) {
    result = result.map((m) => ({
      ...m,
      bestOf: options.knockoutBestOf,
    }));
  }
  return result;
}

/**
 * Double elimination with standard drop-down losers bracket:
 * WB R1 losers → LB, then LB winners meet next WB round losers each round.
 * Grand final + optional bracket reset when enabled.
 */
export function generateDoubleElimination(
  teams: EngineTeam[],
  options: GenerateOptions = {},
): GeneratedMatch[] {
  const losersStartSet = new Set(options.losersStartTeamIds ?? []);
  const losersStart = [...teams]
    .filter((t) => losersStartSet.has(t.id))
    .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
  const winnersTeams = losersStart.length
    ? teams.filter((t) => !losersStartSet.has(t.id))
    : teams;
  // Split participants: size the winners bracket for everyone so that the
  // byes' empty loser slots in LB round 1 can host the losers-start teams.
  const minBracketSize = losersStart.length
    ? nextPowerOfTwo(Math.max(2, teams.length))
    : undefined;

  const winners = generateSingleElimination(winnersTeams, {
    ...options,
    breakTiesWithPlacement: false,
    placementMatchesThrough: 0,
    consolationBracket: false,
    minBracketSize,
  }).map((m) => ({
    ...m,
    key: m.key.replace(/^se-/, 'de-w-'),
    homeFromMatchKey: m.homeFromMatchKey?.replace(/^se-/, 'de-w-') ?? null,
    awayFromMatchKey: m.awayFromMatchKey?.replace(/^se-/, 'de-w-') ?? null,
    nextMatchKey: m.nextMatchKey?.replace(/^se-/, 'de-w-') ?? null,
    bracketSide:
      m.bracketSide === BracketSide.FINAL
        ? BracketSide.WINNERS
        : m.bracketSide,
  }));

  // Fix next pointers after key rewrite
  for (const m of winners) {
    if (m.nextMatchKey) {
      // already rewritten
    }
  }
  // Rebuild next pointers from from-keys
  const byKey = new Map(winners.map((m) => [m.key, m]));
  for (const m of winners) {
    m.nextMatchKey = null;
    m.nextMatchSlot = null;
  }
  for (const m of winners) {
    if (m.homeFromMatchKey) {
      const src = byKey.get(m.homeFromMatchKey);
      if (src) {
        src.nextMatchKey = m.key;
        src.nextMatchSlot = 'home';
      }
    }
    if (m.awayFromMatchKey) {
      const src = byKey.get(m.awayFromMatchKey);
      if (src) {
        src.nextMatchKey = m.key;
        src.nextMatchSlot = 'away';
      }
    }
  }

  const wbRounds = Math.max(...winners.map((m) => m.round));
  const r1 = winners.filter((m) => m.round === 1);
  const losers: GeneratedMatch[] = [];

  // Losers round 1: losers of WB R1
  for (let i = 0; i < r1.length / 2; i++) {
    const key = `de-l-r1-p${i}`;
    const a = r1[i * 2];
    const b = r1[i * 2 + 1];
    losers.push({
      key,
      round: 1,
      position: i,
      bracketSide: BracketSide.LOSERS,
      homeFromMatchKey: a.key,
      awayFromMatchKey: b.key,
      homeTeamId: null,
      awayTeamId: null,
    });
    a.loserNextMatchKey = key;
    a.loserNextMatchSlot = 'home';
    b.loserNextMatchKey = key;
    b.loserNextMatchSlot = 'away';
  }

  // Split participants: losers-start teams take the LB R1 slots whose feeding
  // WB match is a bye (a bye never produces a loser).
  if (losersStart.length) {
    const queue = [...losersStart];
    for (const lb of losers) {
      if (!queue.length) break;
      const homeFeeder = r1.find((m) => m.key === lb.homeFromMatchKey);
      const awayFeeder = r1.find((m) => m.key === lb.awayFromMatchKey);
      if (homeFeeder?.isBye && queue.length) {
        lb.homeTeamId = queue.shift()!.id;
      }
      if (awayFeeder?.isBye && queue.length) {
        lb.awayTeamId = queue.shift()!.id;
      }
    }
  }

  // Subsequent losers rounds: winner of previous LB vs loser of next WB round
  let lbRound = 1;
  for (let wbRound = 2; wbRound <= wbRounds; wbRound++) {
    const prevLb = losers.filter((m) => m.round === lbRound);
    const wbMatches = winners.filter((m) => m.round === wbRound);
    lbRound += 1;
    const roundMatches: GeneratedMatch[] = [];
    for (let i = 0; i < wbMatches.length; i++) {
      const key = `de-l-r${lbRound}-p${i}`;
      const lbPrev = prevLb[i];
      const wb = wbMatches[i];
      roundMatches.push({
        key,
        round: lbRound,
        position: i,
        bracketSide: BracketSide.LOSERS,
        homeFromMatchKey: lbPrev?.key ?? null,
        awayFromMatchKey: wb.key,
        homeTeamId: null,
        awayTeamId: null,
      });
      if (lbPrev) {
        lbPrev.nextMatchKey = key;
        lbPrev.nextMatchSlot = 'home';
      }
      wb.loserNextMatchKey = key;
      wb.loserNextMatchSlot = 'away';
    }
    losers.push(...roundMatches);

    // If more than one LB match this round, need consolidation round
    if (roundMatches.length > 1) {
      lbRound += 1;
      const consolidation: GeneratedMatch[] = [];
      for (let i = 0; i < roundMatches.length / 2; i++) {
        const key = `de-l-r${lbRound}-p${i}`;
        const a = roundMatches[i * 2];
        const b = roundMatches[i * 2 + 1];
        consolidation.push({
          key,
          round: lbRound,
          position: i,
          bracketSide: BracketSide.LOSERS,
          homeFromMatchKey: a.key,
          awayFromMatchKey: b.key,
          homeTeamId: null,
          awayTeamId: null,
        });
        a.nextMatchKey = key;
        a.nextMatchSlot = 'home';
        b.nextMatchKey = key;
        b.nextMatchSlot = 'away';
      }
      losers.push(...consolidation);
    }
  }

  const wbFinal = winners.find(
    (m) => m.round === wbRounds && !winners.some((x) => x.homeFromMatchKey === m.key || x.awayFromMatchKey === m.key && x.round > m.round),
  ) ?? winners.find((m) => m.round === wbRounds)!;

  // clearer: winners final is highest round with no nextMatchKey
  const wbChampionMatch =
    winners.find((m) => !m.nextMatchKey) ?? winners[winners.length - 1];
  const lbChampionMatch =
    losers.find((m) => !m.nextMatchKey) ?? losers[losers.length - 1];

  const gfKey = 'de-gf';
  const grandFinal: GeneratedMatch = {
    key: gfKey,
    round: wbRounds + 1,
    position: 0,
    bracketSide: BracketSide.GRAND_FINAL,
    homeFromMatchKey: wbChampionMatch.key,
    awayFromMatchKey: lbChampionMatch.key,
    homeTeamId: null,
    awayTeamId: null,
  };
  wbChampionMatch.nextMatchKey = gfKey;
  wbChampionMatch.nextMatchSlot = 'home';
  lbChampionMatch.nextMatchKey = gfKey;
  lbChampionMatch.nextMatchSlot = 'away';

  // silence unused
  void wbFinal;

  let all = [...winners, ...losers, grandFinal];
  if (options.doubleElimBracketReset !== false) {
    all = addGrandFinalReset(all);
  }
  if (options.breakTiesWithPlacement) {
    all = addPlacementThirdMatch(all, 'de');
  }
  if ((options.placementMatchesThrough ?? 0) >= 5) {
    all = addDoubleElimPlacementMatches(all, 'de', options.placementMatchesThrough!);
  }
  if (options.knockoutBestOf && options.knockoutBestOf > 1) {
    all = all.map((m) => ({
      ...m,
      bestOf: m.bracketSide === BracketSide.GROUP ? undefined : options.knockoutBestOf,
    }));
  }
  return all;
}

export function assignTeamsToGroups(
  teams: EngineTeam[],
  groupCount: number,
): { groups: EngineGroup[]; teams: EngineTeam[] } {
  return assignTeamsToGroupsInternational(teams, groupCount);
}

export type GroupDrawMode = 'SERPENTINE' | 'POT' | 'BALANCED' | 'RANDOM';

/** Assign teams to groups using FIFA/UEFA-style draw methods. */
export function assignTeamsToGroupsWithMode(
  teams: EngineTeam[],
  groupCount: number,
  mode: GroupDrawMode = 'SERPENTINE',
  drawSeed?: string,
): { groups: EngineGroup[]; teams: EngineTeam[] } {
  if (mode === 'SERPENTINE') {
    if (drawSeed) {
      const shuffled = seededShuffle(
        teams.map((t) => ({ id: t.id, name: t.name, seed: t.seed ?? null })),
        drawSeed,
        'group-serpentine',
      ).items;
      const byId = new Map(teams.map((t) => [t.id, t]));
      const ordered = shuffled.map((s, i) => ({
        ...byId.get(s.id)!,
        seed: i + 1,
      }));
      return assignTeamsToGroupsInternational(ordered, groupCount);
    }
    return assignTeamsToGroupsInternational(teams, groupCount);
  }

  const count = Math.max(2, Math.min(groupCount, Math.floor(teams.length / 2)));
  const groups: EngineGroup[] = Array.from({ length: count }, (_, i) => ({
    id: `group-${i + 1}`,
    name: `Group ${String.fromCharCode(65 + i)}`,
    order: i,
  }));

  const shuffleMode: GroupShuffleMode =
    mode === 'POT' ? 'POT' : mode === 'RANDOM' ? 'RANDOM' : 'BALANCED';

  const assignments = shuffleIntoGroups(
    teams.map((t) => ({ id: t.id, name: t.name, seed: t.seed ?? null })),
    count,
    shuffleMode,
    drawSeed,
  );

  const groupIdByIndex = new Map(groups.map((g, i) => [i, g.id]));
  const assignedMap = new Map(
    teams.map((t) => [t.id, { ...t, groupId: null as string | null }]),
  );

  for (const { groupIndex, itemIds } of assignments) {
    const gid = groupIdByIndex.get(groupIndex)!;
    for (const id of itemIds) {
      const team = assignedMap.get(id);
      if (team) team.groupId = gid;
    }
  }

  return { groups, teams: [...assignedMap.values()] };
}

export function generateGroupsKnockout(
  teams: EngineTeam[],
  groupCount: number,
  advancePerGroup: number,
): { groups: EngineGroup[]; teams: EngineTeam[]; matches: GeneratedMatch[] } {
  const { groups, teams: assigned } = assignTeamsToGroups(teams, groupCount);
  const groupMatches: GeneratedMatch[] = [];

  for (const g of groups) {
    const gTeams = assigned.filter((t) => t.groupId === g.id);
    groupMatches.push(...generateRoundRobin(gTeams, g.id));
  }

  const advancingSlots = groups.length * advancePerGroup;
  const koSize = nextPowerOfTwo(Math.max(2, advancingSlots));
  // Placeholder KO bracket with TBD teams (filled after group stage)
  const placeholderTeams: EngineTeam[] = Array.from(
    { length: koSize },
    (_, i) => ({
      id: `tbd-advancer-${i}`,
      name: `Qualifier ${i + 1}`,
      seed: i + 1,
    }),
  );
  // Only create KO structure keys; actual team ids stay null until advancement
  const ko = generateSingleElimination(
    placeholderTeams.slice(0, Math.max(2, advancingSlots)),
  ).map((m) => ({
    ...m,
    key: m.key.replace(/^se-/, 'gk-'),
    homeFromMatchKey: m.homeFromMatchKey?.replace(/^se-/, 'gk-') ?? null,
    awayFromMatchKey: m.awayFromMatchKey?.replace(/^se-/, 'gk-') ?? null,
    nextMatchKey: m.nextMatchKey?.replace(/^se-/, 'gk-') ?? null,
    homeTeamId: null,
    awayTeamId: null,
    isBye: false,
    bracketSide:
      m.bracketSide === BracketSide.FINAL
        ? BracketSide.FINAL
        : BracketSide.WINNERS,
  }));

  // Rebuild next pointers
  const byKey = new Map(ko.map((m) => [m.key, m]));
  for (const m of ko) {
    m.nextMatchKey = null;
    m.nextMatchSlot = null;
  }
  for (const m of ko) {
    if (m.homeFromMatchKey) {
      const src = byKey.get(m.homeFromMatchKey);
      if (src) {
        src.nextMatchKey = m.key;
        src.nextMatchSlot = 'home';
      }
    }
    if (m.awayFromMatchKey) {
      const src = byKey.get(m.awayFromMatchKey);
      if (src) {
        src.nextMatchKey = m.key;
        src.nextMatchSlot = 'away';
      }
    }
  }

  return {
    groups,
    teams: assigned,
    matches: [...groupMatches, ...ko],
  };
}

/**
 * Pick top N teams per group for knockout seeding.
 * Returns a flat ordered list: G0#1, G1#1, ... then G0#2, G1#2, ...
 */
export function pickGroupAdvancers(
  standings: StandingRow[],
  groups: EngineGroup[],
  advancePerGroup: number,
): string[] {
  const orderedGroups = [...groups].sort((a, b) => a.order - b.order);
  const advancers: string[] = [];
  for (let rank = 1; rank <= advancePerGroup; rank++) {
    for (const g of orderedGroups) {
      const row = standings.find(
        (s) => s.groupId === g.id && s.rank === rank,
      );
      if (row) advancers.push(row.teamId);
    }
  }
  return advancers;
}

/** Pick top N per group plus best third-place teams (UEFA Euro 24-team style). */
export function pickGroupAdvancersWithBestThirds(
  standings: StandingRow[],
  groups: EngineGroup[],
  advancePerGroup: number,
  bestThirdsCount = 0,
): string[] {
  const base = pickGroupAdvancers(standings, groups, advancePerGroup);
  if (bestThirdsCount <= 0) return base;

  const orderedGroups = [...groups].sort((a, b) => a.order - b.order);
  const thirds: StandingRow[] = [];
  for (const g of orderedGroups) {
    const row = standings.find((s) => s.groupId === g.id && s.rank === 3);
    if (row) thirds.push(row);
  }

  thirds.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.pointsFor - a.pointsAgainst;
    const gdB = b.pointsFor - b.pointsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (a.fairPlayPoints ?? 0) - (b.fairPlayPoints ?? 0);
  });

  return [...base, ...thirds.slice(0, bestThirdsCount).map((r) => r.teamId)];
}

export type TwoLeggedTieInput = {
  leg1HomeScore: number;
  leg1AwayScore: number;
  leg2HomeScore: number;
  leg2AwayScore: number;
  leg1HomeTeamId: string;
  leg1AwayTeamId: string;
  etHomeScore?: number | null;
  etAwayScore?: number | null;
  penHomeScore?: number | null;
  penAwayScore?: number | null;
  awayGoalsRule?: boolean;
  allowExtraTime?: boolean;
  allowPenalties?: boolean;
};

/** Resolve a single-leg knockout tie after regulation (ET, then penalties). */
export function resolveSingleLegKnockoutTie(input: {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  etHomeScore?: number | null;
  etAwayScore?: number | null;
  penHomeScore?: number | null;
  penAwayScore?: number | null;
  allowExtraTime?: boolean;
  allowPenalties?: boolean;
}): {
  winnerTeamId: string | null;
  decidedBy: 'regulation' | 'extra_time' | 'penalties' | null;
} {
  if (input.homeScore !== input.awayScore) {
    return {
      winnerTeamId:
        input.homeScore > input.awayScore
          ? input.homeTeamId
          : input.awayTeamId,
      decidedBy: 'regulation',
    };
  }

  const etH = input.etHomeScore ?? 0;
  const etA = input.etAwayScore ?? 0;
  if (input.allowExtraTime && (etH > 0 || etA > 0)) {
    const totalH = input.homeScore + etH;
    const totalA = input.awayScore + etA;
    if (totalH !== totalA) {
      return {
        winnerTeamId:
          totalH > totalA ? input.homeTeamId : input.awayTeamId,
        decidedBy: 'extra_time',
      };
    }
  }

  const penH = input.penHomeScore ?? 0;
  const penA = input.penAwayScore ?? 0;
  if (
    input.allowPenalties &&
    penH !== penA &&
    (input.penHomeScore != null || input.penAwayScore != null)
  ) {
    return {
      winnerTeamId:
        penH > penA ? input.homeTeamId : input.awayTeamId,
      decidedBy: 'penalties',
    };
  }

  return { winnerTeamId: null, decidedBy: null };
}

/** Resolve a two-legged knockout tie (aggregate, away goals, ET, penalties). */
export function resolveTwoLeggedTie(input: TwoLeggedTieInput): {
  winnerTeamId: string;
  aggregateHome: number;
  aggregateAway: number;
  decidedBy: 'aggregate' | 'away_goals' | 'extra_time' | 'penalties';
} {
  const teamA = input.leg1HomeTeamId;
  const teamB = input.leg1AwayTeamId;
  const aggA = input.leg1HomeScore + input.leg2AwayScore;
  const aggB = input.leg1AwayScore + input.leg2HomeScore;
  const awayA = input.leg2AwayScore;
  const awayB = input.leg2HomeScore;

  if (aggA !== aggB) {
    return {
      winnerTeamId: aggA > aggB ? teamA : teamB,
      aggregateHome: aggA,
      aggregateAway: aggB,
      decidedBy: 'aggregate',
    };
  }

  if (input.awayGoalsRule && awayA !== awayB) {
    return {
      winnerTeamId: awayA > awayB ? teamA : teamB,
      aggregateHome: aggA,
      aggregateAway: aggB,
      decidedBy: 'away_goals',
    };
  }

  const etA = (input.etHomeScore ?? 0);
  const etB = (input.etAwayScore ?? 0);
  if (input.allowExtraTime && (etA > 0 || etB > 0)) {
    const totalA = aggA + etA;
    const totalB = aggB + etB;
    if (totalA !== totalB) {
      return {
        winnerTeamId: totalA > totalB ? teamA : teamB,
        aggregateHome: totalA,
        aggregateAway: totalB,
        decidedBy: 'extra_time',
      };
    }
  }

  const penA = input.penHomeScore ?? 0;
  const penB = input.penAwayScore ?? 0;
  if (input.allowPenalties && penA !== penB) {
    return {
      winnerTeamId: penA > penB ? teamA : teamB,
      aggregateHome: aggA,
      aggregateAway: aggB,
      decidedBy: 'penalties',
    };
  }

  return {
    winnerTeamId: teamA,
    aggregateHome: aggA,
    aggregateAway: aggB,
    decidedBy: 'aggregate',
  };
}

/** Expand group-stage matches into home/away two-legged ties. */
export function expandTwoLeggedGroup(matches: GeneratedMatch[]): GeneratedMatch[] {
  const result: GeneratedMatch[] = [];
  const leg2: GeneratedMatch[] = [];

  for (const m of matches) {
    if (m.bracketSide !== BracketSide.GROUP || m.isBye) {
      result.push(m);
      continue;
    }

    const tieId = m.tieId ?? m.key;
    result.push({
      ...m,
      tieId,
      legNumber: 1,
    });

    leg2.push({
      ...m,
      key: `${m.key}-leg2`,
      tieId,
      legNumber: 2,
      position: m.position + 500,
      homeTeamId: m.awayTeamId,
      awayTeamId: m.homeTeamId,
    });
  }

  return [...result, ...leg2];
}

/** Duplicate knockout matches into home/away legs for two-legged ties. */
export function expandTwoLeggedKnockout(
  matches: GeneratedMatch[],
): GeneratedMatch[] {
  const result: GeneratedMatch[] = [];
  const leg2: GeneratedMatch[] = [];

  for (const m of matches) {
    const isKnockout =
      m.bracketSide !== 'GROUP' &&
      m.bracketSide !== 'SWISS' &&
      !m.isThirdPlace &&
      !m.isPlacement &&
      !m.isResetMatch;

    if (!isKnockout) {
      result.push(m);
      continue;
    }

    const tieId = m.tieId ?? m.key;
    const savedNext = {
      nextMatchKey: m.nextMatchKey,
      nextMatchSlot: m.nextMatchSlot,
      loserNextMatchKey: m.loserNextMatchKey,
      loserNextMatchSlot: m.loserNextMatchSlot,
    };

    result.push({
      ...m,
      tieId,
      legNumber: 1,
      nextMatchKey: null,
      nextMatchSlot: null,
      loserNextMatchKey: null,
      loserNextMatchSlot: null,
    });

    leg2.push({
      ...m,
      key: `${m.key}-leg2`,
      tieId,
      legNumber: 2,
      position: m.position + 1000,
      homeTeamId: m.awayTeamId,
      awayTeamId: m.homeTeamId,
      homeFromMatchKey: m.awayFromMatchKey,
      awayFromMatchKey: m.homeFromMatchKey,
      nextMatchKey: savedNext.nextMatchKey,
      nextMatchSlot: savedNext.nextMatchSlot,
      loserNextMatchKey: savedNext.loserNextMatchKey,
      loserNextMatchSlot: savedNext.loserNextMatchSlot,
    });
  }

  return [...result, ...leg2];
}

/** Assign advancer team IDs into first-round KO matches (FIFA / UEFA cross-group seeding). */
export function seedKnockoutRound1(
  round1Matches: { id: string; position: number; homeTeamId?: string | null; awayTeamId?: string | null }[],
  advancerIds: string[],
  groupCount = Math.max(2, Math.ceil(advancerIds.length / 2)),
  advancePerGroup = 2,
  thirdGroupIndices?: number[],
): { matchId: string; homeTeamId: string | null; awayTeamId: string | null }[] {
  const pairings =
    groupCount === 6 &&
    advancePerGroup === 2 &&
    advancerIds.length >= 16 &&
    thirdGroupIndices?.length === 4
      ? buildEuroSixGroupKnockoutPairingsDynamic(advancerIds, thirdGroupIndices)
      : buildInternationalKnockoutPairings(
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
        matchId: sorted[i]!.id,
        homeTeamId: pairing.homeTeamId,
        awayTeamId: pairing.awayTeamId,
      });
    } else {
      const home = advancerIds[i * 2] ?? null;
      const away = advancerIds[i * 2 + 1] ?? null;
      result.push({ matchId: sorted[i]!.id, homeTeamId: home, awayTeamId: away });
    }
  }
  return result;
}

export function computeStandings(
  teams: EngineTeam[],
  matches: MatchResultLike[],
  pointsWin = 3,
  pointsDraw = 1,
  options: StandingsOptions = {},
): StandingRow[] {
  return computeStandingsInternational(teams, matches, {
    pointsWin,
    pointsDraw,
    ...options,
  });
}

export function suggestFormats(
  teamCount: number,
  hasGroups: boolean,
): FormatSuggestion[] {
  const suggestions: FormatSuggestion[] = [
    {
      format: TournamentFormat.SINGLE_ELIMINATION,
      label: 'Single Elimination',
      category: 'Bracket',
      reason: 'Fast knockout — lose once and you are out.',
      recommended: teamCount >= 4 && teamCount <= 16 && !hasGroups,
    },
    {
      format: TournamentFormat.DOUBLE_ELIMINATION,
      label: 'Double Elimination',
      category: 'Bracket',
      reason: 'Must lose twice. Winners + losers brackets.',
      recommended: teamCount >= 6 && teamCount <= 16,
    },
    {
      format: TournamentFormat.ROUND_ROBIN,
      label: 'Round Robin',
      category: 'League',
      reason: 'Everyone plays everyone — fairest small league.',
      recommended: teamCount >= 3 && teamCount <= 8 && !hasGroups,
    },
    {
      format: TournamentFormat.SWISS,
      label: 'Swiss System',
      category: 'League',
      reason: 'Pair similar records each round — great for large fields.',
      recommended: teamCount >= 8 && !hasGroups,
    },
    {
      format: TournamentFormat.GROUPS_KNOCKOUT,
      label: 'Two-Stage (Groups + KO)',
      category: 'Hybrid',
      reason: 'Groups first, then knockout with advancers.',
      recommended: teamCount >= 8 || hasGroups,
    },
    {
      format: TournamentFormat.LEADERBOARD,
      label: 'Leaderboard',
      category: 'Ranking',
      reason: 'Multiple scoring events, cumulative board.',
      recommended: false,
    },
    {
      format: TournamentFormat.TIME_TRIAL,
      label: 'Time Trial',
      category: 'Racing',
      reason: 'Each team posts a time — fastest ranks first.',
      recommended: false,
    },
    {
      format: TournamentFormat.SINGLE_RACE,
      label: 'Single Race',
      category: 'Racing',
      reason: 'One race for everyone — finish order is the result.',
      recommended: teamCount >= 4 && teamCount <= 24,
    },
    {
      format: TournamentFormat.GRAND_PRIX,
      label: 'Grand Prix',
      category: 'Racing',
      reason: 'Multi-race series with championship points.',
      recommended: teamCount >= 6,
    },
  ];

  if (teamCount >= 4) {
    suggestions.push({
      format: TournamentFormat.FREE_FOR_ALL,
      label: 'Free for All',
      category: 'Ranking',
      reason: 'Open placement board — everyone fights for rank.',
      recommended: false,
    });
  }

  if (!suggestions.some((s) => s.recommended)) {
    suggestions[0].recommended = true;
  }

  return suggestions;
}

/** Pair teams for Swiss round using FIDE Dutch-style score groups. */
export function pairSwissRound(
  orderedTeamIds: string[] | StandingRow[],
  round: number,
  priorPairs: Set<string> = new Set(),
  options: {
    seeds?: Map<string, number>;
    colorBalance?: Map<string, number>;
    mode?: 'SIMPLE' | 'FIDE_DUTCH';
  } = {},
): GeneratedMatch[] {
  const standings: StandingRow[] =
    orderedTeamIds.length > 0 && typeof orderedTeamIds[0] === 'object'
      ? (orderedTeamIds as StandingRow[])
      : (orderedTeamIds as string[]).map((id, i) => ({
          teamId: id,
          played: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          points: 0,
          rank: i + 1,
          groupId: null,
        }));

  return pairSwissRoundInternational(standings, round, priorPairs, options);
}

export {
  assignEuroThirdPlaceSlots,
  buildEuroSixGroupKnockoutPairingsDynamic,
  pickGroupAdvancersWithBestThirdsDetailed,
} from './euro-third-place';

export function generateSwiss(
  teams: EngineTeam[],
  _rounds: number,
): GeneratedMatch[] {
  const sorted = [...teams].sort(
    (a, b) => (a.seed ?? 999) - (b.seed ?? 999),
  );
  return pairSwissRound(
    sorted.map((t) => t.id),
    1,
  );
}

export function planTimeTrial(teams: EngineTeam[]): PlannedEvent[] {
  return [
    {
      eventKey: 'time-trial',
      eventIndex: 1,
      eventLabel: 'Time Trial',
      teamIds: teams.map((t) => t.id),
    },
  ];
}

export function planSingleRace(teams: EngineTeam[]): PlannedEvent[] {
  return [
    {
      eventKey: 'race-1',
      eventIndex: 1,
      eventLabel: 'Main Race',
      teamIds: teams.map((t) => t.id),
    },
  ];
}

export function planGrandPrix(
  teams: EngineTeam[],
  raceCount: number,
): PlannedEvent[] {
  return Array.from({ length: raceCount }, (_, i) => ({
    eventKey: `gp-race-${i + 1}`,
    eventIndex: i + 1,
    eventLabel: `Race ${i + 1}`,
    teamIds: teams.map((t) => t.id),
  }));
}

export function planLeaderboard(
  teams: EngineTeam[],
  eventCount: number,
): PlannedEvent[] {
  return Array.from({ length: eventCount }, (_, i) => ({
    eventKey: `lb-event-${i + 1}`,
    eventIndex: i + 1,
    eventLabel: `Event ${i + 1}`,
    teamIds: teams.map((t) => t.id),
  }));
}

export { planFreeForAll, computeFreeForAllStandings, buildInternationalKnockoutPairings } from './pairing-rules';

/** Convert finish positions to F1-style points */
export function pointsFromPosition(position: number): number {
  const table = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  return table[position - 1] ?? 0;
}

/** Rank by lowest time (time trial) or by points */
export function computeEventStandings(
  teams: EngineTeam[],
  results: {
    teamId: string;
    value: number;
    points: number;
    position: number | null;
    status: string;
  }[],
  mode: 'points' | 'time',
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
      groupId: t.groupId ?? null,
    });
  }

  for (const r of results) {
    if (r.status !== 'COMPLETED') continue;
    const row = map.get(r.teamId);
    if (!row) continue;
    row.played += 1;
    row.points += r.points;
    row.pointsFor += mode === 'time' ? r.value : r.points;
  }

  const rows = [...map.values()];
  if (mode === 'time') {
    // Lower time is better among those with results
    rows.sort((a, b) => {
      if (a.played === 0 && b.played === 0) return 0;
      if (a.played === 0) return 1;
      if (b.played === 0) return -1;
      if (a.pointsFor !== b.pointsFor) return a.pointsFor - b.pointsFor;
      return b.points - a.points;
    });
  } else {
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.pointsFor - a.pointsFor;
    });
  }

  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

export function resolveWinnerTeamId(input: {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  isDraw?: boolean;
  winnerTeamId?: string | null;
}): { winnerTeamId: string | null; isDraw: boolean } {
  if (input.isDraw) {
    return { winnerTeamId: null, isDraw: true };
  }
  if (input.winnerTeamId) {
    return { winnerTeamId: input.winnerTeamId, isDraw: false };
  }
  if (input.homeScore === input.awayScore) {
    return { winnerTeamId: null, isDraw: true };
  }
  return {
    winnerTeamId:
      input.homeScore > input.awayScore ? input.homeTeamId : input.awayTeamId,
    isDraw: false,
  };
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export type GroupShuffleMode = 'BALANCED' | 'RANDOM' | 'POT';

function balancedSerpentineAssign(
  items: Shuffleable[],
  groupCount: number,
): { groupIndex: number; itemIds: string[] }[] {
  const count = Math.max(2, groupCount);
  const groups = Array.from({ length: count }, (_, groupIndex) => ({
    groupIndex,
    itemIds: [] as string[],
  }));
  for (let i = 0; i < items.length; i++) {
    const round = Math.floor(i / count);
    const posInRound = i % count;
    const groupIndex =
      round % 2 === 0 ? posInRound : count - 1 - posInRound;
    groups[groupIndex]!.itemIds.push(items[i]!.id);
  }
  return groups;
}

/**
 * FIFA / UEFA style pot draw: split by seed into pots of size groupCount,
 * shuffle within each pot, assign one per pot to each group.
 */
export function potDrawIntoGroups(
  items: Shuffleable[],
  groupCount: number,
  drawSeed?: string,
): { groupIndex: number; itemIds: string[] }[] {
  const g = Math.max(2, groupCount);
  const sorted = [...items].sort(
    (a, b) => (a.seed ?? 999) - (b.seed ?? 999),
  );
  const numPots = Math.ceil(sorted.length / g);
  const groups = Array.from({ length: g }, (_, groupIndex) => ({
    groupIndex,
    itemIds: [] as string[],
  }));

  for (let p = 0; p < numPots; p++) {
    const pot = sorted.slice(p * g, (p + 1) * g);
    const shuffled = drawSeed
      ? seededShuffle(pot, `${drawSeed}:pot${p}`, `pot-${p}`).items
      : shuffleInPlace([...pot]);
    shuffled.forEach((item, groupIdx) => {
      groups[groupIdx]!.itemIds.push(item.id);
    });
  }
  return groups;
}

/** Assign teams into N groups. Default BALANCED uses serpentine for even group sizes. */
export function shuffleIntoGroups(
  items: Shuffleable[],
  groupCount: number,
  mode: GroupShuffleMode = 'BALANCED',
  drawSeed?: string,
): { groupIndex: number; itemIds: string[] }[] {
  const count = Math.max(2, groupCount);
  if (mode === 'POT') {
    return potDrawIntoGroups(items, count, drawSeed);
  }
  if (mode === 'BALANCED') {
    const ordered = drawSeed
      ? seededShuffle([...items], drawSeed, 'group-balanced').items
      : shuffleInPlace([...items]);
    return balancedSerpentineAssign(ordered, count);
  }
  const ordered = drawSeed
    ? seededShuffle([...items], drawSeed, 'group-random').items
    : shuffleInPlace([...items]);
  const groups = Array.from({ length: count }, (_, groupIndex) => ({
    groupIndex,
    itemIds: [] as string[],
  }));
  ordered.forEach((item, i) => {
    groups[i % count]!.itemIds.push(item.id);
  });
  return groups;
}

export function expectedGroupSizes(
  itemCount: number,
  groupCount: number,
): number[] {
  const g = Math.max(2, groupCount);
  const base = Math.floor(itemCount / g);
  const remainder = itemCount % g;
  return Array.from({ length: g }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Color-pool draft: for each team slot, pick one from each marked color pool
 * (or randomly within color), then assign leftover neutrals.
 */
export function colorPoolDraft(input: {
  pools: { color: string; itemIds: string[] }[];
  teamCount: number;
}): { teamIndex: number; memberIds: string[] }[] {
  const teamCount = Math.max(2, input.teamCount);
  const teams = Array.from({ length: teamCount }, (_, teamIndex) => ({
    teamIndex,
    memberIds: [] as string[],
  }));

  for (const pool of input.pools) {
    const ids = shuffleInPlace([...pool.itemIds]);
    ids.forEach((id, i) => {
      const round = Math.floor(i / teamCount);
      const posInRound = i % teamCount;
      const teamIndex =
        round % 2 === 0 ? posInRound : teamCount - 1 - posInRound;
      teams[teamIndex]!.memberIds.push(id);
    });
  }

  return teams;
}

/** Apply traditional seeding order (1 vs N bracket positions). */
export function applySeedingOrder(
  teamIds: string[],
  mode: 'TRADITIONAL' | 'LIST_ORDER',
): string[] {
  return applySeedingOrderInternational(teamIds, mode);
}

export function requiredSeriesWins(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

export function validateSeriesResult(input: {
  homeScore: number;
  awayScore: number;
  bestOf: number;
}): { valid: boolean; message?: string } {
  const needed = requiredSeriesWins(input.bestOf);
  const { homeScore, awayScore } = input;
  if (homeScore < 0 || awayScore < 0) {
    return { valid: false, message: 'Scores cannot be negative' };
  }
  if (homeScore > needed || awayScore > needed) {
    return {
      valid: false,
      message: `Series is best of ${input.bestOf} — max ${needed} wins per side`,
    };
  }
  if (homeScore !== needed && awayScore !== needed) {
    return {
      valid: false,
      message: `One side must reach ${needed} wins to complete the series`,
    };
  }
  if (homeScore + awayScore > input.bestOf) {
    return { valid: false, message: 'Total games exceed best-of limit' };
  }
  return { valid: true };
}

export function formatsSupportShareImage(format: string | null | undefined): boolean {
  return (
    format === 'SINGLE_ELIMINATION' ||
    format === 'DOUBLE_ELIMINATION' ||
    format === 'ROUND_ROBIN' ||
    format === 'SWISS'
  );
}
export * from './elo';
export * from './scheduler';
