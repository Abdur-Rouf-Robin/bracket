import { z } from 'zod';

export const CricketExtraType = {
  NONE: 'NONE',
  WIDE: 'WIDE',
  NO_BALL: 'NO_BALL',
  BYE: 'BYE',
  LEG_BYE: 'LEG_BYE',
  PENALTY: 'PENALTY',
} as const;

export type CricketExtraType =
  (typeof CricketExtraType)[keyof typeof CricketExtraType];

export const CricketWicketType = {
  BOWLED: 'BOWLED',
  CAUGHT: 'CAUGHT',
  LBW: 'LBW',
  RUN_OUT: 'RUN_OUT',
  STUMPED: 'STUMPED',
  HIT_WICKET: 'HIT_WICKET',
  RETIRED: 'RETIRED',
  OBSTRUCTING: 'OBSTRUCTING',
  TIMED_OUT: 'TIMED_OUT',
  OTHER: 'OTHER',
} as const;

export type CricketWicketType =
  (typeof CricketWicketType)[keyof typeof CricketWicketType];

export const CricketInningsStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export type CricketInningsStatus =
  (typeof CricketInningsStatus)[keyof typeof CricketInningsStatus];

export const CricketInningsEndReason = {
  IN_PROGRESS: 'IN_PROGRESS',
  ALL_OUT: 'ALL_OUT',
  OVERS_COMPLETE: 'OVERS_COMPLETE',
  DECLARED: 'DECLARED',
  RAIN_DLS: 'RAIN_DLS',
  MANUAL: 'MANUAL',
  FORFEIT: 'FORFEIT',
  NO_RESULT: 'NO_RESULT',
  ABANDONED: 'ABANDONED',
} as const;

export type CricketInningsEndReason =
  (typeof CricketInningsEndReason)[keyof typeof CricketInningsEndReason];

export const CricketMatchMode = {
  TOURNAMENT: 'TOURNAMENT',
  STANDALONE: 'STANDALONE',
} as const;

export type CricketMatchMode =
  (typeof CricketMatchMode)[keyof typeof CricketMatchMode];

export const CricketFormat = {
  T20: 'T20',
  ODI: 'ODI',
  CUSTOM: 'CUSTOM',
} as const;

export type CricketFormat = (typeof CricketFormat)[keyof typeof CricketFormat];

export const CricketStrikeRotationMode = {
  AUTO: 'AUTO',
  MANUAL: 'MANUAL',
} as const;

export type CricketStrikeRotationMode =
  (typeof CricketStrikeRotationMode)[keyof typeof CricketStrikeRotationMode];

export const cricketSetupSchema = z.object({
  format: z.enum(['T20', 'ODI', 'CUSTOM']).default('T20'),
  maxOvers: z.number().int().min(1).max(300).optional(),
  maxWickets: z.number().int().min(1).max(29).optional(),
  ballsPerOver: z.number().int().min(4).max(10).default(6),
  inningsCount: z.number().int().min(1).max(2).default(2),
  strikeRotationMode: z.enum(['AUTO', 'MANUAL']).default('AUTO'),
  /** Max overs any single bowler may bowl in an innings. */
  maxOversPerBowler: z.number().int().min(1).max(50).optional(),
  /** How many bowlers may bowl that maximum (others capped at max − 1). */
  maxBowlersAtLimit: z.number().int().min(1).max(30).optional(),
});

export type CricketSetupInput = z.infer<typeof cricketSetupSchema>;

export const cricketStartInningsSchema = z.object({
  inningsNumber: z.number().int().min(1).max(2),
  battingTeamId: z.string().min(1),
  bowlingTeamId: z.string().min(1),
  strikerId: z.string().min(1),
  nonStrikerId: z.string().min(1),
  bowlerId: z.string().min(1),
});

export type CricketStartInningsInput = z.infer<typeof cricketStartInningsSchema>;

export const cricketBallSchema = z.object({
  runsOffBat: z.number().int().min(0).max(6).default(0),
  extraType: z
    .enum(['NONE', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY'])
    .default('NONE'),
  extraRuns: z.number().int().min(0).max(10).default(0),
  isWicket: z.boolean().default(false),
  wicketType: z
    .enum([
      'BOWLED',
      'CAUGHT',
      'LBW',
      'RUN_OUT',
      'STUMPED',
      'HIT_WICKET',
      'RETIRED',
      'OBSTRUCTING',
      'TIMED_OUT',
      'OTHER',
    ])
    .optional(),
  dismissedPlayerId: z.string().optional(),
  fielderId: z.string().optional(),
  commentary: z.string().max(200).optional(),
});

export type CricketBallInput = z.infer<typeof cricketBallSchema>;

export const cricketChangeBowlerSchema = z.object({
  bowlerId: z.string().min(1),
});

export type CricketChangeBowlerInput = z.infer<
  typeof cricketChangeBowlerSchema
>;

export const cricketSetBatsmenSchema = z
  .object({
    strikerId: z.string().min(1).optional(),
    nonStrikerId: z.string().min(1).optional(),
  })
  .refine((d) => d.strikerId || d.nonStrikerId, {
    message: 'Provide strikerId and/or nonStrikerId',
  });

export type CricketSetBatsmenInput = z.infer<typeof cricketSetBatsmenSchema>;

export const cricketRosterPlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
});

export const cricketCreateStandaloneSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  homeTeamName: z.string().min(1).max(80),
  awayTeamName: z.string().min(1).max(80),
  homePlayers: z.array(cricketRosterPlayerSchema).min(1).max(30),
  awayPlayers: z.array(cricketRosterPlayerSchema).min(1).max(30),
  format: z.enum(['T20', 'ODI', 'CUSTOM']).default('T20'),
  maxOvers: z.number().int().min(1).max(300).optional(),
  maxWickets: z.number().int().min(1).max(29).optional(),
  ballsPerOver: z.number().int().min(4).max(10).default(6),
  inningsCount: z.number().int().min(1).max(2).default(2),
  strikeRotationMode: z.enum(['AUTO', 'MANUAL']).default('AUTO'),
  maxOversPerBowler: z.number().int().min(1).max(50).optional(),
  maxBowlersAtLimit: z.number().int().min(1).max(30).optional(),
  toss: z
    .object({
      winnerSide: z.enum(['home', 'away']),
      decision: z.enum(['BAT', 'BOWL']),
    })
    .optional(),
});

export type CricketCreateStandaloneInput = z.infer<
  typeof cricketCreateStandaloneSchema
>;

export const cricketStandaloneTossSchema = z.object({
  winnerSide: z.enum(['home', 'away']),
  decision: z.enum(['BAT', 'BOWL']),
});

export type CricketStandaloneTossInput = z.infer<typeof cricketStandaloneTossSchema>;

export const cricketStandaloneStartInningsSchema = z.object({
  inningsNumber: z.number().int().min(1).max(2),
  battingSide: z.enum(['home', 'away']),
  strikerId: z.string().min(1),
  nonStrikerId: z.string().min(1),
  bowlerId: z.string().min(1),
});

export type CricketStandaloneStartInningsInput = z.infer<
  typeof cricketStandaloneStartInningsSchema
>;

export const cricketEndInningsSchema = z.object({
  reason: z
    .enum([
      'ALL_OUT',
      'OVERS_COMPLETE',
      'DECLARED',
      'RAIN_DLS',
      'MANUAL',
      'FORFEIT',
      'NO_RESULT',
      'ABANDONED',
    ])
    .default('MANUAL'),
});

export type CricketEndInningsInput = z.infer<typeof cricketEndInningsSchema>;

export const cricketDlsSchema = z.object({
  revisedMaxOvers: z.number().int().min(1).max(300),
  applyToInnings: z.number().int().min(1).max(2).optional(),
});

export type CricketDlsInput = z.infer<typeof cricketDlsSchema>;

export const cricketDeclareSchema = z.object({
  inningsNumber: z.number().int().min(1).max(2),
});

export type CricketDeclareInput = z.infer<typeof cricketDeclareSchema>;

export const cricketStartSuperOverSchema = z.object({
  strikerId: z.string().min(1),
  nonStrikerId: z.string().min(1),
  bowlerId: z.string().min(1),
});

export type CricketStartSuperOverInput = z.infer<typeof cricketStartSuperOverSchema>;

export const cricketAbandonSchema = z.object({
  reason: z.enum(['NO_RESULT', 'ABANDONED']).default('NO_RESULT'),
});

export type CricketAbandonInput = z.infer<typeof cricketAbandonSchema>;

export const CricketTossDecision = {
  BAT: 'BAT',
  BOWL: 'BOWL',
} as const;

export type CricketTossDecision =
  (typeof CricketTossDecision)[keyof typeof CricketTossDecision];

export const cricketTossSchema = z.object({
  winnerTeamId: z.string().min(1),
  decision: z.enum(['BAT', 'BOWL']),
});

export type CricketTossInput = z.infer<typeof cricketTossSchema>;

/** Resolve 1st-innings batting/bowling from toss result. */
export function teamsFromCricketToss(
  toss: CricketTossInput,
  homeTeamId: string,
  awayTeamId: string,
): { battingTeamId: string; bowlingTeamId: string } {
  const loserTeamId =
    toss.winnerTeamId === homeTeamId ? awayTeamId : homeTeamId;
  if (toss.decision === 'BAT') {
    return { battingTeamId: toss.winnerTeamId, bowlingTeamId: loserTeamId };
  }
  return { battingTeamId: loserTeamId, bowlingTeamId: toss.winnerTeamId };
}

export type BowlerLimitSettings = {
  maxOversPerBowler: number;
  maxBowlersAtLimit: number;
  ballsPerOver: number;
};

export function defaultBowlerLimits(
  maxOvers: number,
  format: CricketFormat,
): { maxOversPerBowler: number; maxBowlersAtLimit: number } {
  if (format === 'ODI') {
    return { maxOversPerBowler: 10, maxBowlersAtLimit: 5 };
  }
  const maxOversPerBowler = format === 'T20' ? 4 : Math.max(1, Math.ceil(maxOvers / 5));
  const maxBowlersAtLimit = Math.max(1, Math.ceil(maxOvers / maxOversPerBowler));
  return { maxOversPerBowler, maxBowlersAtLimit };
}

export function resolveBowlerLimits(
  maxOvers: number,
  format: CricketFormat,
  input?: { maxOversPerBowler?: number; maxBowlersAtLimit?: number },
): { maxOversPerBowler: number; maxBowlersAtLimit: number } {
  const defaults = defaultBowlerLimits(maxOvers, format);
  return {
    maxOversPerBowler: input?.maxOversPerBowler ?? defaults.maxOversPerBowler,
    maxBowlersAtLimit: input?.maxBowlersAtLimit ?? defaults.maxBowlersAtLimit,
  };
}

export function bowlingLegalBallsByBowler(
  balls: Array<{ bowlerId: string; isLegalDelivery: boolean }>,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const ball of balls) {
    if (!ball.isLegalDelivery) continue;
    map[ball.bowlerId] = (map[ball.bowlerId] ?? 0) + 1;
  }
  return map;
}

export function bowlingLegalBallsFromRows(
  bowling: Array<{ playerId: string; legalBalls: number }>,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of bowling) {
    map[row.playerId] = row.legalBalls;
  }
  return map;
}

/** Max overs this bowler is allowed in the current innings. */
export function maxLegalOversForBowler(
  bowlerId: string,
  bowlingLegalBalls: Record<string, number>,
  settings: BowlerLimitSettings,
): number {
  const { maxOversPerBowler, maxBowlersAtLimit, ballsPerOver } = settings;
  const fullQuotaBalls = maxOversPerBowler * ballsPerOver;
  const othersAtFull = Object.entries(bowlingLegalBalls).filter(
    ([id, balls]) => id !== bowlerId && balls >= fullQuotaBalls,
  ).length;
  const thisBalls = bowlingLegalBalls[bowlerId] ?? 0;
  if (thisBalls >= fullQuotaBalls) return maxOversPerBowler;
  if (othersAtFull >= maxBowlersAtLimit) {
    return Math.max(1, maxOversPerBowler - 1);
  }
  return maxOversPerBowler;
}

export function canSelectBowler(
  bowlerId: string,
  bowlingLegalBalls: Record<string, number>,
  settings: BowlerLimitSettings,
): boolean {
  const thisBalls = bowlingLegalBalls[bowlerId] ?? 0;
  const maxOvers = maxLegalOversForBowler(bowlerId, bowlingLegalBalls, settings);
  return thisBalls < maxOvers * settings.ballsPerOver;
}

export const cricketInningsReportSchema = z.object({
  runs: z.number().int().min(0).max(999),
  wickets: z.number().int().min(0).max(29),
  /** Overs in cricket notation, e.g. `20`, `19.4`, `50.0`. */
  overs: z.string().min(1).max(12),
  extras: z.number().int().min(0).max(999).optional().default(0),
  allOut: z.boolean().optional().default(false),
});

export type CricketInningsReportInput = z.infer<typeof cricketInningsReportSchema>;

export const cricketManualReportSchema = z.object({
  firstBattingTeamId: z.string().min(1),
  firstInnings: cricketInningsReportSchema,
  secondInnings: cricketInningsReportSchema,
});

export type CricketManualReportInput = z.infer<typeof cricketManualReportSchema>;

/** Parse overs string (e.g. `19.4`) to legal ball count. */
export function parseCricketOvers(input: string, ballsPerOver = 6): number {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Overs are required');
  }
  const match = trimmed.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error('Use overs like 20 or 19.4');
  }
  const whole = Number(match[1]);
  const balls = match[2] !== undefined ? Number(match[2]) : 0;
  if (!Number.isFinite(whole) || !Number.isFinite(balls)) {
    throw new Error('Invalid overs value');
  }
  if (balls < 0 || balls >= ballsPerOver) {
    throw new Error(`Balls in over must be 0–${ballsPerOver - 1}`);
  }
  return whole * ballsPerOver + balls;
}

export function formatCricketOvers(
  legalBalls: number,
  ballsPerOver = 6,
): string {
  const overs = Math.floor(legalBalls / ballsPerOver);
  const balls = legalBalls % ballsPerOver;
  return `${overs}.${balls}`;
}

/** Bowler on the last legal delivery of the most recently completed over. */
export function lastCompletedOverBowlerId(
  balls: Array<{ bowlerId: string; isLegalDelivery: boolean }>,
  legalBalls: number,
  ballsPerOver = 6,
): string | null {
  if (legalBalls <= 0 || legalBalls % ballsPerOver !== 0) return null;
  let legalCount = 0;
  let lastBowler: string | null = null;
  for (const ball of balls) {
    if (!ball.isLegalDelivery) continue;
    legalCount += 1;
    lastBowler = ball.bowlerId;
    if (legalCount >= legalBalls) break;
  }
  return lastBowler;
}

export function detectSport(
  gameName?: string | null,
): 'cricket' | 'football' | 'general' {
  const n = (gameName ?? '').toLowerCase();
  if (n.includes('cricket')) return 'cricket';
  if (
    n.includes('football') ||
    n.includes('soccer') ||
    n.includes('fifa') ||
    n.includes('fc 26') ||
    n.includes('ea fc')
  ) {
    return 'football';
  }
  return 'general';
}

export type CricketBattingRow = {
  playerId: string;
  playerName: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  isDuck: boolean;
  isGoldenDuck: boolean;
  points: number;
  dismissal: string | null;
};

export type CricketBowlingRow = {
  playerId: string;
  playerName: string;
  overs: string;
  legalBalls: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  points: number;
};

export type CricketFallOfWicket = {
  wicket: number;
  score: number;
  over: string;
  batsmanName: string;
  dismissal: string;
};

export type CricketBallEvent = {
  id: string;
  sequence: number;
  overNumber: number;
  ballInOver: number;
  display: string;
  totalRuns: number;
  isWicket: boolean;
  commentary: string | null;
  batsmanName: string;
  bowlerName: string;
};

export type CricketInningsView = {
  id: string;
  inningsNumber: number;
  battingTeamId: string;
  battingTeamName: string;
  bowlingTeamId: string;
  bowlingTeamName: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  oversDisplay: string;
  extras: number;
  targetRuns: number | null;
  status: CricketInningsStatus;
  endReason: CricketInningsEndReason | null;
  isAllOut: boolean;
  isSuperOver: boolean;
  declared: boolean;
  revisedMaxOvers: number | null;
  dlsParScore: number | null;
  runRate: number;
  requiredRunRate: number | null;
  projectedScore: number | null;
  strikerId: string | null;
  nonStrikerId: string | null;
  currentBowlerId: string | null;
  batting: CricketBattingRow[];
  bowling: CricketBowlingRow[];
  fallOfWickets: CricketFallOfWicket[];
  recentBalls: CricketBallEvent[];
  currentOverBalls: CricketBallEvent[];
  maxWicketsForInnings: number;
  overCompletePending: boolean;
  /** Bowler who finished the last completed over — cannot bowl the next over. */
  lastOverBowlerId: string | null;
};

export type CricketScoreboard = {
  id: string;
  mode: CricketMatchMode;
  matchId: string | null;
  slug: string | null;
  title: string | null;
  configured: boolean;
  format: CricketFormat | null;
  maxOvers: number;
  maxWickets: number;
  ballsPerOver: number;
  maxOversPerBowler: number;
  maxBowlersAtLimit: number;
  inningsCount: number;
  strikeRotationMode: CricketStrikeRotationMode;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeRoster?: Array<{ id: string; name: string }>;
  awayRoster?: Array<{ id: string; name: string }>;
  innings: CricketInningsView[];
  superOverPending: boolean;
  toss?: {
    winnerTeamId: string;
    winnerTeamName: string;
    decision: CricketTossDecision;
  } | null;
  matchSummary: {
    homeRuns: number | null;
    awayRuns: number | null;
    homeWickets: number | null;
    awayWickets: number | null;
    homePoints: number | null;
    awayPoints: number | null;
    homeNetRunRate: number | null;
    awayNetRunRate: number | null;
    result: string | null;
  };
};
