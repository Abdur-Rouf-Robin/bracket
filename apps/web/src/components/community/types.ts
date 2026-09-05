import type {
  Community,
  CommunityAnnouncement,
  CommunityRole,
  PlatformEvent,
  PublicUser,
  Ranking,
  RankingEntry,
  TournamentTemplate,
} from '@/lib/types-platform';

export type CommunityTournamentCard = {
  id: string;
  name: string;
  slug: string;
  status: string;
  format: string | null;
  startAt: string | null;
  isPublic: boolean;
  logoUrl?: string | null;
  createdAt: string;
  completedAt?: string | null;
  game?: { id: string; name: string } | null;
  _count?: { teams: number; matches: number };
};

export type CommunityListItem = Community & {
  _count: { members: number; followers: number; tournaments: number; events: number };
};

export type CommunityListResponse = {
  items: CommunityListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type MyCommunity = CommunityListItem & {
  viewerRole: CommunityRole | null;
  isFollowing: boolean;
};

export type CommunityTemplate = TournamentTemplate & {
  ownerId?: string;
  owner?: PublicUser;
  community?: { id: string; slug: string; name: string; logoUrl?: string | null } | null;
  updatedAt?: string;
};

export type CommunityPagePayload = {
  community: Community;
  owner: PublicUser;
  games: { id: string; name: string; category: string }[];
  viewerRole: CommunityRole | null;
  isFollowing: boolean;
  _count: { members: number; followers: number; tournaments: number; events: number };
  announcements: CommunityAnnouncement[];
  tournaments: {
    upcoming: CommunityTournamentCard[];
    inProgress: CommunityTournamentCard[];
    completed: CommunityTournamentCard[];
  };
  events: (PlatformEvent & { _count?: { tournaments: number } })[];
  rankings: (Ranking & { _count: { entries: number; tournaments: number } })[];
  templates: CommunityTemplate[];
};

export type RankingPagePayload = {
  ranking: Ranking & { _count: { entries: number; tournaments: number } };
  community: { id: string; slug: string; name: string; isPublic: boolean; logoUrl?: string | null };
  viewerRole: CommunityRole | null;
  entries: RankingEntry[];
  total: number;
  page: number;
  pageSize: number;
  tournaments: { id: string; name: string; slug: string; status: string; startAt: string | null }[];
};

export type RatingHistoryPoint = {
  id: string;
  matchId?: string | null;
  tournamentId?: string | null;
  tournament?: { id: string; name: string; slug: string } | null;
  opponentName?: string | null;
  result: 'W' | 'L' | 'D' | string;
  delta: number;
  ratingAfter: number;
  createdAt: string;
};

export type RankingEntryDetail = RankingEntry & {
  rank: number;
  history: RatingHistoryPoint[];
};

export type Game = { id: string; name: string; category: string };

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
