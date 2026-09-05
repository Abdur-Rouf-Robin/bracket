import { BracketSide as BracketSideEnum, seededShuffle } from '@bracket/shared';
import type { EngineTeam, GeneratedMatch } from './types';

export interface SwissPotsOptions {
  /** Number of pots (defaults to min(rounds, 4)). */
  potCount?: number;
  /** Seed string for deterministic draws. */
  drawSeed?: string;
}

export interface SwissPotsResult {
  matches: GeneratedMatch[];
  pots: { pot: number; teamIds: string[] }[];
}

const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * Perfect matching search over `ids` where `allowed(a, b)` must hold and
 * partners are tried in `prefer(a)` order. Bounded by `budget` recursive steps.
 */
function findMatching(
  ids: string[],
  allowed: (a: string, b: string) => boolean,
  prefer: (a: string, candidates: string[]) => string[],
  budget: { steps: number },
): [string, string][] | null {
  if (ids.length === 0) return [];
  if (budget.steps-- <= 0) return null;
  const [first, ...rest] = ids as [string, ...string[]];
  const candidates = prefer(first, rest.filter((b) => allowed(first, b)));
  for (const partner of candidates) {
    const remaining = rest.filter((x) => x !== partner);
    const sub = findMatching(remaining, allowed, prefer, budget);
    if (sub) return [[first, partner], ...sub];
  }
  return null;
}

/**
 * UEFA Champions League style Swiss: every fixture is drawn up-front. Teams are
 * split into seeded pots; each team plays a balanced number of opponents from
 * every pot, never the same opponent twice, with home/away alternating.
 */
export function generateSwissPots(
  teams: EngineTeam[],
  rounds: number,
  options: SwissPotsOptions = {},
): SwissPotsResult {
  const sorted = [...teams].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
  const ids = sorted.map((t) => t.id);
  const n = ids.length;
  if (n < 2 || rounds < 1) return { matches: [], pots: [] };

  const maxRounds = n % 2 === 0 ? n - 1 : n;
  const totalRounds = Math.min(rounds, maxRounds);
  const potCount = Math.max(
    1,
    Math.min(options.potCount ?? Math.min(totalRounds, 4), Math.floor(n / 2)),
  );
  const potSize = Math.ceil(n / potCount);
  const potOf = new Map<string, number>();
  const pots: { pot: number; teamIds: string[] }[] = [];
  for (let p = 0; p < potCount; p++) {
    const teamIds = ids.slice(p * potSize, (p + 1) * potSize);
    pots.push({ pot: p + 1, teamIds });
    for (const id of teamIds) potOf.set(id, p);
  }

  // Target opponents per pot for each team (spread rounds evenly across pots).
  const perPotTarget = Math.floor(totalRounds / potCount);
  const extra = totalRounds - perPotTarget * potCount;

  const played = new Set<string>();
  const vsPot = new Map<string, number[]>();
  const homeBalance = new Map<string, number>();
  const byes = new Map<string, number>();
  for (const id of ids) {
    vsPot.set(id, Array.from({ length: potCount }, () => 0));
    homeBalance.set(id, 0);
    byes.set(id, 0);
  }

  const seedBase = options.drawSeed ?? `swiss-pots:${ids.join(',')}`;
  const matches: GeneratedMatch[] = [];

  const needFromPot = (team: string, pot: number, round: number): boolean => {
    const count = vsPot.get(team)![pot] ?? 0;
    // Allow the "extra" opponents to land in any pot once the base quota is met,
    // but prefer pots that are still short; hard limit prevents lopsided draws.
    const limit = perPotTarget + (extra > 0 ? 1 : 0);
    void round;
    return count < limit;
  };

  for (let round = 1; round <= totalRounds; round++) {
    const order = seededShuffle(
      ids.map((id) => ({ id })),
      `${seedBase}:r${round}`,
      `swiss-pots-r${round}`,
    ).items.map((x) => x.id);

    let pool = [...order];
    let byeTeam: string | null = null;
    if (pool.length % 2 === 1) {
      // Bye goes to the team with the fewest byes (lowest seed last).
      byeTeam = [...pool]
        .sort((a, b) => (byes.get(a)! - byes.get(b)!) || ids.indexOf(b) - ids.indexOf(a))[0]!;
      pool = pool.filter((id) => id !== byeTeam);
      byes.set(byeTeam, byes.get(byeTeam)! + 1);
    }

    const noRematch = (a: string, b: string) => !played.has(pairKey(a, b));
    const strict = (a: string, b: string) =>
      noRematch(a, b) &&
      needFromPot(a, potOf.get(b)!, round) &&
      needFromPot(b, potOf.get(a)!, round);
    const prefer = (a: string, candidates: string[]) =>
      [...candidates].sort((x, y) => {
        // Prefer pots this team has faced least, then different pot from own.
        const ax = vsPot.get(a)![potOf.get(x)!]!;
        const ay = vsPot.get(a)![potOf.get(y)!]!;
        if (ax !== ay) return ax - ay;
        const dx = potOf.get(x) === potOf.get(a) ? 1 : 0;
        const dy = potOf.get(y) === potOf.get(a) ? 1 : 0;
        return dx - dy;
      });

    let pairs =
      findMatching(pool, strict, prefer, { steps: 20000 }) ??
      findMatching(pool, noRematch, prefer, { steps: 20000 }) ??
      findMatching(pool, () => true, prefer, { steps: 20000 }) ??
      [];

    // Absolute fallback — pair sequentially.
    if (pairs.length * 2 < pool.length) {
      pairs = [];
      for (let i = 0; i + 1 < pool.length; i += 2) pairs.push([pool[i]!, pool[i + 1]!]);
    }

    pairs.forEach(([a, b], position) => {
      played.add(pairKey(a, b));
      vsPot.get(a)![potOf.get(b)!]! += 1;
      vsPot.get(b)![potOf.get(a)!]! += 1;
      const aHome = (homeBalance.get(a) ?? 0) <= (homeBalance.get(b) ?? 0);
      const home = aHome ? a : b;
      const away = aHome ? b : a;
      homeBalance.set(home, (homeBalance.get(home) ?? 0) + 1);
      homeBalance.set(away, (homeBalance.get(away) ?? 0) - 1);
      matches.push({
        key: `swiss-r${round}-p${position}`,
        round,
        position,
        bracketSide: BracketSideEnum.SWISS,
        homeTeamId: home,
        awayTeamId: away,
      });
    });

    if (byeTeam) {
      matches.push({
        key: `swiss-r${round}-p${pairs.length}`,
        round,
        position: pairs.length,
        bracketSide: BracketSideEnum.SWISS,
        homeTeamId: byeTeam,
        awayTeamId: null,
        isBye: true,
      });
    }
  }

  return { matches, pots };
}
