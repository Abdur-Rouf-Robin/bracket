/** Simplified ICC-style resource % remaining (0–100 scale). */

const WICKET_FACTORS = [1, 0.94, 0.87, 0.79, 0.7, 0.6, 0.49, 0.37, 0.25, 0.13, 0.05];

export function resourceRemaining(
  oversRemaining: number,
  wicketsLost: number,
  maxOvers: number,
): number {
  if (maxOvers <= 0) return 0;
  const oversPct = Math.max(0, Math.min(1, oversRemaining / maxOvers));
  const w = Math.max(0, Math.min(9, wicketsLost));
  return 100 * oversPct * (WICKET_FACTORS[w] ?? 0.05);
}

export function oversToDecimal(oversDisplay: number, balls: number, ballsPerOver: number): number {
  return oversDisplay + balls / ballsPerOver;
}

export function legalBallsToOversDecimal(legalBalls: number, ballsPerOver: number): number {
  return legalBalls / ballsPerOver;
}

/** Current run rate (runs per over). */
export function computeRunRate(
  runs: number,
  legalBalls: number,
  ballsPerOver = 6,
): number {
  const overs = legalBallsToOversDecimal(legalBalls, ballsPerOver);
  if (overs <= 0) return 0;
  return Math.round((runs / overs) * 100) / 100;
}

/** Required run rate to reach target in remaining overs. */
export function computeRequiredRunRate(
  runs: number,
  target: number,
  legalBalls: number,
  maxOvers: number,
  ballsPerOver = 6,
): number | null {
  if (target == null) return null;
  const maxLegal = maxOvers * ballsPerOver;
  const remainingBalls = Math.max(0, maxLegal - legalBalls);
  const remainingOvers = remainingBalls / ballsPerOver;
  const need = target - runs;
  if (need <= 0) return 0;
  if (remainingOvers <= 0) return null;
  return Math.round((need / remainingOvers) * 100) / 100;
}

/** Projected total at current run rate for remaining overs. */
export function computeProjectedScore(
  runs: number,
  legalBalls: number,
  maxOvers: number,
  ballsPerOver = 6,
): number {
  const rr = computeRunRate(runs, legalBalls, ballsPerOver);
  const remaining =
    legalBallsToOversDecimal(maxOvers * ballsPerOver - legalBalls, ballsPerOver);
  return Math.round(runs + rr * Math.max(0, remaining));
}

/** Net run rate for league tables: (RF/OF) − (RA/OA). */
export function computeNetRunRate(
  runsFor: number,
  oversFaced: number,
  runsAgainst: number,
  oversBowled: number,
): number {
  if (oversFaced <= 0 || oversBowled <= 0) return 0;
  const nrr = runsFor / oversFaced - runsAgainst / oversBowled;
  return Math.round(nrr * 1000) / 1000;
}

/** League points: win 2, tie/no-result 1, loss 0. */
export function computeLeaguePoints(
  result: 'win' | 'loss' | 'tie' | 'nr',
): number {
  switch (result) {
    case 'win':
      return 2;
    case 'tie':
    case 'nr':
      return 1;
    default:
      return 0;
  }
}

/** Fantasy-style batting points (runs + boundary bonuses − duck penalty). */
export function computeBattingPoints(row: {
  runs: number;
  fours: number;
  sixes: number;
  isDuck: boolean;
}): number {
  let pts = row.runs;
  pts += row.fours;
  pts += row.sixes * 2;
  if (row.isDuck) pts -= 2;
  return pts;
}

/** Bowling points: wickets + maiden bonuses. */
export function computeBowlingPoints(row: {
  wickets: number;
  maidens: number;
}): number {
  return row.wickets * 25 + row.maidens * 4;
}

export type DlsInput = {
  firstInningsRuns: number;
  firstInningsLegalBalls: number;
  firstInningsWickets: number;
  originalMaxOvers: number;
  revisedMaxOvers: number;
  ballsPerOver?: number;
  /** Second innings state when rain hits during chase (optional). */
  chaseRuns?: number;
  chaseLegalBalls?: number;
  chaseWickets?: number;
};

export type DlsResult = {
  parScore: number;
  revisedTarget: number;
  resourceFirstPct: number;
  resourceSecondPct: number;
  explanation: string;
};

/**
 * Simplified DLS par-score revision for rain-affected limited-overs matches.
 * Uses resource remaining approximation (not full ICC table).
 */
export function computeDlsRevisedTarget(input: DlsInput): DlsResult {
  const bpo = input.ballsPerOver ?? 6;
  const origMax = input.originalMaxOvers;
  const revMax = input.revisedMaxOvers;

  const firstOversBowled = input.firstInningsLegalBalls / bpo;
  const firstOversLeft = Math.max(0, origMax - firstOversBowled);
  const r1Used = resourceRemaining(firstOversLeft, input.firstInningsWickets, origMax);
  const r1End = resourceRemaining(revMax, 0, revMax);

  let effectiveFirst = input.firstInningsRuns;
  if (firstOversBowled < origMax - 0.01) {
    const r1Start = resourceRemaining(origMax, 0, origMax);
    const pctUsed = (r1Start - r1Used) / r1Start;
    effectiveFirst = Math.round(
      input.firstInningsRuns * (r1End / Math.max(1, r1Used)) * (pctUsed > 0 ? 1 : 1),
    );
    if (r1Used > 0) {
      effectiveFirst = Math.round(input.firstInningsRuns * (r1End / r1Used));
    }
  }

  const r2Full = resourceRemaining(revMax, 0, revMax);

  if (
    input.chaseRuns != null &&
    input.chaseLegalBalls != null &&
    input.chaseWickets != null
  ) {
    const chaseOversBowled = input.chaseLegalBalls / bpo;
    const chaseOversLeft = Math.max(0, revMax - chaseOversBowled);
    const r2Used = resourceRemaining(chaseOversLeft, input.chaseWickets, revMax);
    const r2Lost = r2Full - r2Used;
    const parScore = Math.round(effectiveFirst * (r2Used / r2Full) + 1);
    return {
      parScore,
      revisedTarget: parScore,
      resourceFirstPct: r1Used,
      resourceSecondPct: r2Used,
      explanation: `DLS (rain during chase): par score ${parScore} from ${effectiveFirst} at ${revMax} overs.`,
    };
  }

  const revisedTarget = Math.max(effectiveFirst + 1, Math.round(effectiveFirst * (r2Full / r1End) + 1));
  return {
    parScore: revisedTarget,
    revisedTarget,
    resourceFirstPct: r1Used,
    resourceSecondPct: r2Full,
    explanation: `DLS revised target ${revisedTarget} (${revMax} overs per side, 1st innings effective ${effectiveFirst}).`,
  };
}

export function isDuck(runs: number, isOut: boolean): boolean {
  return isOut && runs === 0;
}

export function isGoldenDuck(runs: number, balls: number, isOut: boolean): boolean {
  return isOut && runs === 0 && balls <= 1;
}
