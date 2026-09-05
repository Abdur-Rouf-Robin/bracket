/**
 * Shared front-end types for the platform expansion (communities, events,
 * scheduling, registrations, billing, etc.). Feature workstreams may add
 * more specific types in their own files; keep the core shapes here in sync
 * with apps/api/prisma/schema.prisma.
 */
import type { Team, Tournament } from './types';

export type Plan = 'FREE' | 'PREMIER';
export type CommunityRole = 'OWNER' | 'ADMIN' | 'COLLABORATOR' | 'AFFILIATE';

export type PublicUser = {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  countryCode?: string | null;
  createdAt?: string;
};

export type AccountUser = PublicUser & {
  email: string;
  role: 'USER' | 'ADMIN';
  timezone: string;
  locale: string;
  plan: Plan;
  planExpiresAt?: string | null;
  emailVerified: boolean;
};

export type Community = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  websiteUrl?: string | null;
  location?: string | null;
  countryCode?: string | null;
  audience: string[];
  socials: Record<string, string>;
  isPro: boolean;
  isPublic: boolean;
  ownerId: string;
  owner?: PublicUser;
  games?: { id: string; name: string; category: string }[];
  viewerRole?: CommunityRole | null;
  isFollowing?: boolean;
  _count?: {
    members?: number;
    followers?: number;
    tournaments?: number;
    events?: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type CommunityMember = {
  id: string;
  role: CommunityRole;
  user: PublicUser & { email?: string };
  createdAt: string;
};

export type CommunityAnnouncement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  author?: PublicUser;
  createdAt: string;
};

export type Ranking = {
  id: string;
  communityId: string;
  name: string;
  description?: string | null;
  game?: { id: string; name: string } | null;
  startAt?: string | null;
  endAt?: string | null;
  startingRating: number;
  kFactorNew: number;
  kFactorNormal: number;
  kFactorPro: number;
  newPlayerMatches: number;
  proThreshold: number;
  isActive: boolean;
  _count?: { entries?: number; tournaments?: number };
};

export type RankingEntry = {
  id: string;
  displayName: string;
  user?: PublicUser | null;
  rating: number;
  peakRating: number;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  lastPlayedAt?: string | null;
  rank?: number;
};

export type TournamentTemplate = {
  id: string;
  name: string;
  description?: string | null;
  communityId?: string | null;
  payload: Record<string, unknown>;
  usageCount: number;
  createdAt: string;
};

export type PlatformEvent = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  timezone: string;
  venueType?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  venueUrl?: string | null;
  streamUrl?: string | null;
  isPublished: boolean;
  isPublic: boolean;
  ownerId: string;
  communityId?: string | null;
  community?: Pick<Community, 'id' | 'slug' | 'name' | 'logoUrl'> | null;
  tournaments?: Tournament[];
  tickets?: EventTicket[];
  canManage?: boolean;
  _count?: { tournaments?: number; orders?: number };
  createdAt: string;
};

export type EventTicket = {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  quantity?: number | null;
  salesStartAt?: string | null;
  salesEndAt?: string | null;
  isActive: boolean;
  sold?: number;
};

export type EventOrder = {
  id: string;
  code: string;
  ticket: Pick<EventTicket, 'id' | 'name'>;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  amountCents: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED';
  checkedInAt?: string | null;
  createdAt: string;
};

export type Station = {
  id: string;
  name: string;
  privateDetails?: string | null;
  status: 'OPEN' | 'IN_USE' | 'CLOSED';
  order: number;
  currentMatchId?: string | null;
};

export type Referee = {
  id: string;
  name: string;
  email?: string | null;
  userId?: string | null;
  availability: unknown[];
  order: number;
};

export type RegistrationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'WAITLISTED'
  | 'WITHDRAWN';

export type Registration = {
  id: string;
  tournamentId: string;
  userId?: string | null;
  user?: PublicUser | null;
  teamId?: string | null;
  team?: Team | null;
  teamName: string;
  players: { name: string; isCaptain?: boolean }[] | string[];
  email?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  skillLevel?: string | null;
  customFields: Record<string, string | number | boolean>;
  waiverAcceptedAt?: string | null;
  status: RegistrationStatus;
  waitlistPosition?: number | null;
  paymentStatus: 'FREE' | 'UNPAID' | 'PAID' | 'REFUNDED';
  amountCents: number;
  currency: string;
  notes?: string | null;
  createdAt: string;
};

export type MatchComment = {
  id: string;
  body: string;
  user: PublicUser;
  createdAt: string;
};

export type StandingAdjustment = {
  id: string;
  teamId: string;
  team?: Team;
  groupId?: string | null;
  points: number;
  reason: string;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  /** Only present right after creation. */
  secret?: string;
};

export type Webhook = {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  tournamentId?: string | null;
  communityId?: string | null;
  lastStatus?: number | null;
  lastSentAt?: string | null;
  failureCount: number;
  createdAt: string;
};

export type Subscription = {
  plan: Plan;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING';
  interval: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
};
