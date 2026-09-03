import type { MatchMeta } from '@bracket/shared';

export type TeamPlayer = {
  id: string;
  name: string;
  order: number;
  isSub: boolean;
  isCaptain?: boolean;
  poolColor?: string | null;
  photoUrl?: string | null;
  teamId: string;
};

export type MatchPlayerStat = {
  id: string;
  playerId: string;
  teamId: string;
  goals: number;
  assists: number;
  points: number;
  kills: number;
  deaths: number;
  rating: number | null;
  mvpScore: number;
  isMvp: boolean;
  player?: TeamPlayer;
  team?: Team;
};

export type Team = {
  id: string;
  name: string;
  seed: number | null;
  groupId: string | null;
  poolColor?: string | null;
  logoUrl?: string | null;
  teamPhotoUrl?: string | null;
  checkedIn?: boolean;
  checkedInAt?: string | null;
  fairPlayPoints?: number;
  registeredByUserId?: string | null;
  players?: TeamPlayer[];
};

export type Group = {
  id: string;
  name: string;
  order: number;
};

export type Match = {
  id: string;
  key: string;
  round: number;
  position: number;
  bracketSide: string;
  status: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePercent: number | null;
  awayPercent: number | null;
  winnerTeamId: string | null;
  isDraw: boolean;
  isBye: boolean;
  isForfeit?: boolean;
  bestOf?: number | null;
  groupId: string | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  winnerTeam?: Team | null;
  mvpPlayerId?: string | null;
  mvpPlayer?: TeamPlayer | null;
  playerStats?: MatchPlayerStat[];
  scheduledAt?: string | null;
  station?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  legNumber?: number | null;
  tieId?: string | null;
  etHomeScore?: number | null;
  etAwayScore?: number | null;
  penHomeScore?: number | null;
  penAwayScore?: number | null;
  matchMeta?: MatchMeta | null;
  nextMatchId?: string | null;
  nextMatchSlot?: string | null;
};

export type EventResult = {
  id: string;
  eventKey: string;
  eventIndex: number;
  eventLabel: string;
  teamId: string;
  value: number;
  position: number | null;
  points: number;
  status: string;
  team: Team;
};

export type Standing = {
  id: string;
  teamId: string;
  groupId: string | null;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  points: number;
  rank: number;
  netRunRate?: number | null;
  team: Team;
  group?: Group | null;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
};

export type Tournament = {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  status: string;
  format: string | null;
  isPublic: boolean;
  allowPercent: boolean;
  pointsWin: number;
  pointsDraw: number;
  advancePerGroup?: number;
  swissRounds?: number;
  raceCount?: number;
  eventCount?: number;
  startAt?: string | null;
  venueType?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  venueUrl?: string | null;
  backgroundImageUrl?: string | null;
  logoUrl?: string | null;
  settings?: Record<string, unknown>;
  previewHidden?: boolean;
  isOwner?: boolean;
  canManage?: boolean;
  game?: { id: string; name: string; category: string } | null;
  createdById: string;
  groups: Group[];
  teams: Team[];
  matches: Match[];
  standings: Standing[];
  eventResults?: EventResult[];
  announcements?: Announcement[];
  _count?: { teams: number; matches: number };
};

export type FormatSuggestion = {
  format: string;
  label: string;
  reason: string;
  recommended: boolean;
  category?: string;
};
