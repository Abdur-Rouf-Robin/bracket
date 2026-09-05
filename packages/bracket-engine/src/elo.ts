/**
 * Elo rating helpers used by community rankings.
 * Pure functions — no I/O, no rounding side effects beyond what is documented.
 */

export type EloConfig = {
  kFactorNew: number;
  kFactorNormal: number;
  kFactorPro: number;
  /** Number of matches during which a player is considered "new". */
  newPlayerMatches: number;
  /** Rating at or above which the pro K-factor applies. */
  proThreshold: number;
};

export type EloEntryLike = {
  matchesPlayed: number;
  rating: number;
};

export type EloScore = 1 | 0.5 | 0;

export type EloResultInput = {
  ratingA: number;
  ratingB: number;
  kA: number;
  kB: number;
  /** Score for A: 1 = A wins, 0.5 = draw, 0 = B wins. */
  scoreA: EloScore;
};

export type EloResult = {
  newA: number;
  newB: number;
  deltaA: number;
  deltaB: number;
};

/** Probability that A beats B under the standard logistic Elo curve. */
export function expectedScore(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

/**
 * Pick the K-factor for a player. Order of precedence mirrors Challonge:
 * new players (few matches) → new K; high rated players → pro K; otherwise normal K.
 */
export function kFactorFor(entry: EloEntryLike, cfg: EloConfig): number {
  if (entry.matchesPlayed < cfg.newPlayerMatches) return cfg.kFactorNew;
  if (entry.rating >= cfg.proThreshold) return cfg.kFactorPro;
  return cfg.kFactorNormal;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Apply one result and return new ratings plus per-side deltas (rounded to 2dp). */
export function applyEloResult(input: EloResultInput): EloResult {
  const expA = expectedScore(input.ratingA, input.ratingB);
  const expB = 1 - expA;
  const scoreB = (1 - input.scoreA) as EloScore;

  const deltaA = round2(input.kA * (input.scoreA - expA));
  const deltaB = round2(input.kB * (scoreB - expB));

  return {
    newA: round2(input.ratingA + deltaA),
    newB: round2(input.ratingB + deltaB),
    deltaA,
    deltaB,
  };
}
