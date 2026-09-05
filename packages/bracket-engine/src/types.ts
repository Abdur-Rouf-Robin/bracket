import type { BracketSide } from '@bracket/shared';

export interface EngineTeam {
  id: string;
  name: string;
  seed?: number;
  groupId?: string | null;
  fairPlayPoints?: number;
}

export interface EngineGroup {
  id: string;
  name: string;
  order: number;
}

export interface GeneratedMatch {
  key: string;
  round: number;
  position: number;
  bracketSide: BracketSide;
  groupId?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeFromMatchKey?: string | null;
  awayFromMatchKey?: string | null;
  nextMatchKey?: string | null;
  nextMatchSlot?: 'home' | 'away' | null;
  loserNextMatchKey?: string | null;
  loserNextMatchSlot?: 'home' | 'away' | null;
  isBye?: boolean;
  bestOf?: number;
  isResetMatch?: boolean;
  isThirdPlace?: boolean;
  tieId?: string | null;
  legNumber?: number | null;
  /** Placement / classification match (3rd place, 5th–8th ladder, …). */
  isPlacement?: boolean;
  /** Best rank this match decides (3 → 3rd/4th, 5 → 5th/6th, …). */
  placementRank?: number | null;
}

export type FormResult = 'W' | 'D' | 'L';

export interface StandingRow {
  teamId: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  points: number;
  rank: number;
  groupId?: string | null;
  fairPlayPoints?: number;
  netRunRate?: number;
  setsWon?: number;
  setsLost?: number;
  /** Sum of manual point adjustments already included in `points`. */
  adjustments?: number;
  buchholz?: number;
  medianBuchholz?: number;
  sonnebornBerger?: number;
  /** Last five results, oldest first. */
  form?: FormResult[];
}

export interface MatchResultLike {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  isDraw: boolean;
  status: string;
  groupId?: string | null;
  isNoResult?: boolean;
  homeSetsWon?: number | null;
  awaySetsWon?: number | null;
}

export interface SetScore {
  home: number;
  away: number;
}

export interface FinalPlacement {
  teamId: string;
  rank: number;
}

export interface PlannedEvent {
  eventKey: string;
  eventIndex: number;
  eventLabel: string;
  teamIds: string[];
}

export type PoolColor =
  | 'YELLOW'
  | 'BLUE'
  | 'RED'
  | 'GREEN'
  | 'PURPLE'
  | 'ORANGE';

export interface Shuffleable {
  id: string;
  name: string;
  seed?: number | null;
  poolColor?: string | null;
}

export interface GenerateOptions {
  breakTiesWithPlacement?: boolean;
  doubleElimBracketReset?: boolean;
  knockoutBestOf?: number;
  /** 0 = none, 3 = third place only, 8 = ranks 3–8, 16 = ranks 3–16. */
  placementMatchesThrough?: number;
  /** Route round-1 losers into a separate consolation bracket. */
  consolationBracket?: boolean;
  /** Double elimination: teams seeded straight into the losers bracket. */
  losersStartTeamIds?: string[];
  /** Force a minimum bracket size (power of two); used for split participants. */
  minBracketSize?: number;
}
