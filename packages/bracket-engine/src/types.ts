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
}

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
}
