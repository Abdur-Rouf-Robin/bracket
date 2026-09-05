import { BracketSide as BracketSideEnum } from '@bracket/shared';
import type { FinalPlacement, GeneratedMatch, SetScore } from './types';

type Feeder = { match: GeneratedMatch; via: 'winner' | 'loser' };

function attach(feeder: Feeder, key: string, slot: 'home' | 'away') {
  if (feeder.via === 'winner') {
    feeder.match.nextMatchKey = key;
    feeder.match.nextMatchSlot = slot;
  } else {
    feeder.match.loserNextMatchKey = key;
    feeder.match.loserNextMatchSlot = slot;
  }
}

/**
 * Build a classification ladder for `feeders.length` teams that will occupy
 * ranks `lo … lo + k - 1`. k must be a power of two ≥ 2. Winners of each stage
 * fight for the upper half of the range, losers for the lower half.
 */
function buildLadder(
  feeders: Feeder[],
  lo: number,
  prefix: string,
  round: number,
  out: GeneratedMatch[],
): void {
  const k = feeders.length;
  if (k < 2) return;
  if (k === 2) {
    const key = lo === 3 ? `${prefix}-3rd` : `${prefix}-pl-${lo}`;
    const match: GeneratedMatch = {
      key,
      round,
      position: 100 + lo,
      bracketSide: BracketSideEnum.FINAL,
      homeFromMatchKey: feeders[0]!.match.key,
      awayFromMatchKey: feeders[1]!.match.key,
      homeTeamId: null,
      awayTeamId: null,
      isPlacement: true,
      placementRank: lo,
      isThirdPlace: lo === 3,
    };
    attach(feeders[0]!, key, 'home');
    attach(feeders[1]!, key, 'away');
    out.push(match);
    return;
  }

  const hi = lo + k - 1;
  const stage: GeneratedMatch[] = [];
  for (let i = 0; i < k / 2; i++) {
    const key = `${prefix}-pl-${lo}-${hi}-p${i}`;
    const a = feeders[i * 2]!;
    const b = feeders[i * 2 + 1]!;
    const match: GeneratedMatch = {
      key,
      round,
      position: 100 + lo + i,
      bracketSide: BracketSideEnum.FINAL,
      homeFromMatchKey: a.match.key,
      awayFromMatchKey: b.match.key,
      homeTeamId: null,
      awayTeamId: null,
      isPlacement: true,
      placementRank: lo,
    };
    attach(a, key, 'home');
    attach(b, key, 'away');
    stage.push(match);
  }
  out.push(...stage);
  buildLadder(
    stage.map((m) => ({ match: m, via: 'winner' as const })),
    lo,
    prefix,
    round + 1,
    out,
  );
  buildLadder(
    stage.map((m) => ({ match: m, via: 'loser' as const })),
    lo + k / 2,
    prefix,
    round + 1,
    out,
  );
}

function isMainWinnersMatch(m: GeneratedMatch): boolean {
  return (
    (m.bracketSide === 'WINNERS' || m.bracketSide === 'FINAL') &&
    !m.isPlacement &&
    !m.isResetMatch &&
    !m.key.includes('cons-')
  );
}

/**
 * Add Challonge-style placement matches to a single-elimination tree.
 * `through` is the deepest rank to decide (3 → third place only, 8 → ranks
 * 3–8, 16 → ranks 3–16). When `skipRound1Losers` is set (consolation bracket
 * enabled) round-1 losers are left for the consolation bracket.
 */
export function addPlacementMatches(
  matches: GeneratedMatch[],
  prefix: string,
  through: number,
  options: { skipRound1Losers?: boolean } = {},
): GeneratedMatch[] {
  if (!through || through < 3) return matches;
  const main = matches.filter(isMainWinnersMatch);
  if (!main.length) return matches;
  const totalRounds = Math.max(...main.map((m) => m.round));
  if (totalRounds < 2) return matches;
  if (matches.some((m) => m.key === `${prefix}-3rd`)) {
    matches = matches.filter((m) => m.key !== `${prefix}-3rd`);
    for (const m of matches) {
      if (m.loserNextMatchKey === `${prefix}-3rd`) {
        m.loserNextMatchKey = null;
        m.loserNextMatchSlot = null;
      }
    }
  }

  const out = [...matches];
  const added: GeneratedMatch[] = [];
  for (let round = totalRounds - 1; round >= 1; round--) {
    if (round === 1 && options.skipRound1Losers) break;
    const roundMatches = main
      .filter((m) => m.round === round)
      .sort((a, b) => a.position - b.position);
    const k = roundMatches.length;
    if (k < 2) continue;
    // Losers of this round rank behind everyone who reached the next round.
    const lo = k + 1;
    if (lo > through) break;
    buildLadder(
      roundMatches.map((m) => ({ match: m, via: 'loser' as const })),
      lo,
      prefix,
      round + 1,
      added,
    );
  }
  return [...out, ...added];
}

/**
 * Placement ladders for a double-elimination bracket: losers of each losers-
 * bracket round are eliminated together and can be ranked with a ladder.
 * 3rd/4th are already decided by the losers final so nothing is added for
 * `through` < 5.
 */
export function addDoubleElimPlacementMatches(
  matches: GeneratedMatch[],
  prefix: string,
  through: number,
): GeneratedMatch[] {
  if (!through || through < 5) return matches;
  const lb = matches.filter(
    (m) => m.bracketSide === 'LOSERS' && !m.isPlacement && !m.key.includes('cons-'),
  );
  if (!lb.length) return matches;
  const rounds = [...new Set(lb.map((m) => m.round))].sort((a, b) => b - a);
  const added: GeneratedMatch[] = [];
  let nextRank = 3;
  for (const round of rounds) {
    const roundMatches = lb
      .filter((m) => m.round === round)
      .sort((a, b) => a.position - b.position);
    const k = roundMatches.length;
    const lo = nextRank;
    nextRank += k;
    if (k < 2) continue;
    if (lo > through) break;
    if ((k & (k - 1)) !== 0) continue;
    buildLadder(
      roundMatches.map((m) => ({ match: m, via: 'loser' as const })),
      lo,
      prefix,
      round + 1,
      added,
    );
  }
  return [...matches, ...added];
}

/**
 * Score7 "cup & consolation": losers of round 1 drop into a separate single
 * elimination bracket with its own champion. Keys are `${prefix}-cons-r{n}-p{i}`
 * and bracketSide is LOSERS.
 */
export function addConsolationBracket(
  matches: GeneratedMatch[],
  prefix: string,
): GeneratedMatch[] {
  const r1 = matches
    .filter((m) => isMainWinnersMatch(m) && m.round === 1)
    .sort((a, b) => a.position - b.position);
  if (r1.length < 2) return matches;
  if (matches.some((m) => m.key.startsWith(`${prefix}-cons-`))) return matches;

  const cons: GeneratedMatch[] = [];
  const first: GeneratedMatch[] = [];
  for (let i = 0; i < r1.length / 2; i++) {
    const a = r1[i * 2]!;
    const b = r1[i * 2 + 1]!;
    const key = `${prefix}-cons-r1-p${i}`;
    first.push({
      key,
      round: 1,
      position: i,
      bracketSide: BracketSideEnum.LOSERS,
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
  cons.push(...first);

  let prev = first;
  let round = 1;
  while (prev.length > 1) {
    round += 1;
    const next: GeneratedMatch[] = [];
    for (let i = 0; i < prev.length / 2; i++) {
      const a = prev[i * 2]!;
      const b = prev[i * 2 + 1]!;
      const key = `${prefix}-cons-r${round}-p${i}`;
      next.push({
        key,
        round,
        position: i,
        bracketSide: BracketSideEnum.LOSERS,
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
    cons.push(...next);
    prev = next;
  }
  return [...matches, ...cons];
}

export function isConsolationKey(key: string): boolean {
  return key.includes('cons-');
}

// ---------------------------------------------------------------------------
// Set-based scoring
// ---------------------------------------------------------------------------

export interface SetsResolution {
  valid: boolean;
  message?: string;
  homeSetsWon: number;
  awaySetsWon: number;
  winner: 'home' | 'away' | null;
}

/**
 * Validate a list of per-set scores against a best-of. The series must end the
 * moment a side reaches ceil(bestOf / 2) set wins, and no set may be tied.
 */
export function resolveSetsResult(
  sets: SetScore[],
  bestOf?: number | null,
): SetsResolution {
  let home = 0;
  let away = 0;
  const needed = bestOf && bestOf > 0 ? Math.ceil(bestOf / 2) : null;
  if (!sets.length) {
    return { valid: false, message: 'Enter at least one set', homeSetsWon: 0, awaySetsWon: 0, winner: null };
  }
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]!;
    if (s.home < 0 || s.away < 0) {
      return { valid: false, message: `Set ${i + 1}: scores cannot be negative`, homeSetsWon: home, awaySetsWon: away, winner: null };
    }
    if (s.home === s.away) {
      return { valid: false, message: `Set ${i + 1} cannot be tied`, homeSetsWon: home, awaySetsWon: away, winner: null };
    }
    if (needed != null && (home >= needed || away >= needed)) {
      return {
        valid: false,
        message: `Series was already decided after set ${i} — remove the extra set(s)`,
        homeSetsWon: home,
        awaySetsWon: away,
        winner: null,
      };
    }
    if (s.home > s.away) home += 1;
    else away += 1;
  }
  if (needed != null) {
    if (sets.length > (bestOf ?? 0)) {
      return { valid: false, message: `Best of ${bestOf} allows at most ${bestOf} sets`, homeSetsWon: home, awaySetsWon: away, winner: null };
    }
    if (home !== needed && away !== needed) {
      return {
        valid: false,
        message: `One side must win ${needed} set${needed === 1 ? '' : 's'} (best of ${bestOf})`,
        homeSetsWon: home,
        awaySetsWon: away,
        winner: null,
      };
    }
  } else if (home === away) {
    return { valid: false, message: 'Sets cannot end level', homeSetsWon: home, awaySetsWon: away, winner: null };
  }
  return {
    valid: true,
    homeSetsWon: home,
    awaySetsWon: away,
    winner: home > away ? 'home' : 'away',
  };
}

export function formatSets(sets: SetScore[] | null | undefined): string {
  if (!sets?.length) return '';
  return sets.map((s) => `${s.home}-${s.away}`).join(' ');
}

// ---------------------------------------------------------------------------
// Final placements
// ---------------------------------------------------------------------------

export interface PlacementMatchLike {
  key: string;
  round: number;
  bracketSide: string;
  status: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  winnerTeamId: string | null;
  isBye?: boolean | null;
  isDraw?: boolean | null;
  isPlacement?: boolean | null;
  placementRank?: number | null;
  legNumber?: number | null;
}

export interface FinalPlacementsResult {
  placements: FinalPlacement[];
  /** True once the champion is known (and every placement match is decided). */
  complete: boolean;
  championTeamId: string | null;
}

const TERMINAL_PLACEMENT_KEY = /(?:^|-)(3rd|pl-\d+)$/;

function loserOf(m: PlacementMatchLike): string | null {
  if (!m.winnerTeamId) return null;
  if (m.homeTeamId && m.homeTeamId !== m.winnerTeamId) return m.homeTeamId;
  if (m.awayTeamId && m.awayTeamId !== m.winnerTeamId) return m.awayTeamId;
  return null;
}

function isDecided(m: PlacementMatchLike): boolean {
  return m.status === 'COMPLETED' && !!m.winnerTeamId;
}

function decisiveLeg(matches: PlacementMatchLike[]): PlacementMatchLike[] {
  // Two-legged ties carry the progression on leg 2; ignore leg 1 for rankings.
  const tieKeys = new Set(
    matches.filter((m) => m.legNumber === 2).map((m) => m.key.replace(/-leg2$/, '')),
  );
  return matches.filter((m) => !(m.legNumber === 1 && tieKeys.has(m.key)));
}

/**
 * Derive final placements for a knockout tournament from its matches.
 * Works for single elimination (incl. groups → knockout, `gk-` keys), double
 * elimination (grand final + optional reset), placement ladders and the
 * consolation bracket. Teams still alive share the best undecided rank.
 */
export function computeFinalPlacements(input: {
  format: string;
  teamIds: string[];
  matches: PlacementMatchLike[];
}): FinalPlacementsResult {
  const all = decisiveLeg(
    input.matches.filter(
      (m) => m.bracketSide !== 'GROUP' && m.bracketSide !== 'SWISS' && !m.isBye,
    ),
  );
  const isDE = input.format === 'DOUBLE_ELIMINATION' || all.some((m) => m.bracketSide === 'GRAND_FINAL');
  const placement = all.filter((m) => m.isPlacement || TERMINAL_PLACEMENT_KEY.test(m.key));
  const cons = all.filter((m) => isConsolationKey(m.key) && !m.isPlacement);
  const main = all.filter((m) => !placement.includes(m) && !cons.includes(m));

  const rank = new Map<string, number>();
  let championTeamId: string | null = null;
  let complete = true;

  const grandFinals = main
    .filter((m) => m.bracketSide === 'GRAND_FINAL')
    .sort((a, b) => a.round - b.round);
  if (isDE && grandFinals.length) {
    const gf = grandFinals[0]!;
    const reset = grandFinals[1];
    const resetPlayed = reset && isDecided(reset) && !!reset.homeTeamId && !!reset.awayTeamId;
    const decisive = resetPlayed ? reset! : gf;
    if (isDecided(decisive)) {
      championTeamId = decisive.winnerTeamId;
      rank.set(decisive.winnerTeamId!, 1);
      const runnerUp = loserOf(decisive);
      if (runnerUp) rank.set(runnerUp, 2);
    } else {
      complete = false;
    }
    // Losers bracket eliminations: last LB round loser is 3rd, and so on.
    const lb = main.filter((m) => m.bracketSide === 'LOSERS');
    const rounds = [...new Set(lb.map((m) => m.round))].sort((a, b) => b - a);
    let base = 3;
    for (const r of rounds) {
      const roundMatches = lb.filter((m) => m.round === r);
      for (const m of roundMatches) {
        const loser = isDecided(m) ? loserOf(m) : null;
        if (loser && !rank.has(loser)) rank.set(loser, base);
      }
      base += roundMatches.length;
    }
  } else {
    const winners = main.filter(
      (m) => m.bracketSide === 'WINNERS' || m.bracketSide === 'FINAL',
    );
    const totalRounds = winners.length ? Math.max(...winners.map((m) => m.round)) : 0;
    const finals = winners.filter((m) => m.round === totalRounds);
    const final = finals.find((m) => isDecided(m)) ?? finals[0];
    if (final && isDecided(final)) {
      championTeamId = final.winnerTeamId;
      rank.set(final.winnerTeamId!, 1);
      const runnerUp = loserOf(final);
      if (runnerUp) rank.set(runnerUp, 2);
    } else {
      complete = false;
    }
    for (let r = totalRounds - 1; r >= 1; r--) {
      const roundMatches = winners.filter((m) => m.round === r);
      const base = roundMatches.length + 1;
      for (const m of roundMatches) {
        const loser = isDecided(m) ? loserOf(m) : null;
        if (loser && !rank.has(loser)) rank.set(loser, base);
      }
    }
  }

  // Placement ladders override the shared elimination rank.
  for (const m of placement) {
    if (!TERMINAL_PLACEMENT_KEY.test(m.key)) continue;
    const p = m.placementRank ?? Number(m.key.match(/(\d+)$/)?.[1] ?? 0);
    if (!p) continue;
    if (!m.homeTeamId && !m.awayTeamId) continue;
    if (!isDecided(m)) {
      if (m.homeTeamId && m.awayTeamId) complete = false;
      continue;
    }
    rank.set(m.winnerTeamId!, p);
    const loser = loserOf(m);
    if (loser) rank.set(loser, p + 1);
  }

  // Consolation bracket: order the round-1 losers by how far they got.
  if (cons.length) {
    const depth = new Map<string, number>();
    for (const m of cons) {
      for (const id of [m.homeTeamId, m.awayTeamId]) {
        if (!id) continue;
        const reached = m.round + (isDecided(m) && m.winnerTeamId === id ? 1 : 0);
        depth.set(id, Math.max(depth.get(id) ?? 0, reached));
      }
    }
    const tier = [...depth.keys()].filter((id) => rank.has(id));
    if (tier.length) {
      const base = Math.min(...tier.map((id) => rank.get(id)!));
      const sorted = tier.sort((a, b) => (depth.get(b) ?? 0) - (depth.get(a) ?? 0));
      let offset = 0;
      let i = 0;
      while (i < sorted.length) {
        const d = depth.get(sorted[i]!) ?? 0;
        let j = i;
        while (j < sorted.length && (depth.get(sorted[j]!) ?? 0) === d) {
          rank.set(sorted[j]!, base + offset);
          j++;
        }
        offset += j - i;
        i = j;
      }
    }
    if (cons.some((m) => m.homeTeamId && m.awayTeamId && !isDecided(m))) complete = false;
  }

  // Anyone still unranked is alive (or never played): share the best open rank.
  const taken = new Set(rank.values());
  let open = 1;
  while (taken.has(open)) open++;
  for (const id of input.teamIds) {
    if (!rank.has(id)) rank.set(id, open);
  }

  const placements = input.teamIds
    .map((teamId) => ({ teamId, rank: rank.get(teamId) ?? open }))
    .sort((a, b) => a.rank - b.rank || a.teamId.localeCompare(b.teamId));
  return { placements, complete, championTeamId };
}
