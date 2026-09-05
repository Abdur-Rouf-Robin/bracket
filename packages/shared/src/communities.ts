// Contracts for the communities feature area (communities, rankings, templates).
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const COMMUNITY_ROLES = ['OWNER', 'ADMIN', 'COLLABORATOR', 'AFFILIATE'] as const;
export type CommunityRoleValue = (typeof COMMUNITY_ROLES)[number];

export const COMMUNITY_ROLE_RANK: Record<CommunityRoleValue, number> = {
  OWNER: 4,
  ADMIN: 3,
  COLLABORATOR: 2,
  AFFILIATE: 1,
};

/** Human-readable role descriptions (Challonge parity). */
export const COMMUNITY_ROLE_DESCRIPTIONS: Record<CommunityRoleValue, string> = {
  OWNER: 'Full control, including deleting the community and transferring ownership.',
  ADMIN: 'Manage settings, members, games and rankings; delete tournaments.',
  COLLABORATOR: 'Post announcements, manage templates and events, and manage any community tournament.',
  AFFILIATE: 'Create tournaments inside the community and use its templates.',
};

export function communityRoleAtLeast(
  role: CommunityRoleValue | null | undefined,
  min: CommunityRoleValue,
): boolean {
  if (!role) return false;
  return COMMUNITY_ROLE_RANK[role] >= COMMUNITY_ROLE_RANK[min];
}

export const COMMUNITY_AUDIENCE_OPTIONS = [
  'Esports',
  'Sports',
  'School',
  'Business',
  'Club',
  'Friends',
] as const;
export type CommunityAudience = (typeof COMMUNITY_AUDIENCE_OPTIONS)[number];

export const COMMUNITY_SOCIAL_KEYS = [
  'twitter',
  'discord',
  'youtube',
  'twitch',
  'instagram',
  'facebook',
  'website',
] as const;
export type CommunitySocialKey = (typeof COMMUNITY_SOCIAL_KEYS)[number];

export const COMMUNITY_SOCIAL_LABELS: Record<CommunitySocialKey, string> = {
  twitter: 'X / Twitter',
  discord: 'Discord',
  youtube: 'YouTube',
  twitch: 'Twitch',
  instagram: 'Instagram',
  facebook: 'Facebook',
  website: 'Website',
};

export const COMMUNITY_SORT_OPTIONS = ['popular', 'newest', 'active'] as const;
export type CommunitySort = (typeof COMMUNITY_SORT_OPTIONS)[number];

/** Recommended banner size for community pages. */
export const COMMUNITY_BANNER_SPEC = { width: 1920, height: 820 } as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const communitySlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyCommunityName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Community schemas
// ---------------------------------------------------------------------------

const socialsSchema = z.record(z.string().max(500)).optional();
const optionalUrl = z.string().url().max(2048).optional().nullable();

export const createCommunitySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(communitySlugRegex, 'Use lowercase letters, numbers and hyphens')
    .optional(),
  description: z.string().max(4000).optional().nullable(),
  audience: z.array(z.string().max(40)).max(10).optional(),
  location: z.string().max(120).optional().nullable(),
  countryCode: z.string().max(8).optional().nullable(),
  websiteUrl: optionalUrl,
  socials: socialsSchema,
  logoUrl: optionalUrl,
  bannerUrl: optionalUrl,
  isPublic: z.boolean().optional(),
});
export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;

export const updateCommunitySchema = createCommunitySchema.partial();
export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;

export const communityListQuerySchema = z.object({
  q: z.string().max(120).optional(),
  game: z.string().optional(),
  country: z.string().max(8).optional(),
  sort: z.enum(COMMUNITY_SORT_OPTIONS).optional().default('popular'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(60).optional().default(24),
});
export type CommunityListQuery = z.infer<typeof communityListQuerySchema>;

export const communityRoleSchema = z.enum(COMMUNITY_ROLES);

export const addCommunityMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'COLLABORATOR', 'AFFILIATE']).optional().default('AFFILIATE'),
});
export type AddCommunityMemberInput = z.infer<typeof addCommunityMemberSchema>;

export const updateCommunityMemberSchema = z.object({
  role: z.enum(['ADMIN', 'COLLABORATOR', 'AFFILIATE']),
});
export type UpdateCommunityMemberInput = z.infer<typeof updateCommunityMemberSchema>;

export const transferCommunityOwnershipSchema = z.object({
  userId: z.string().min(1),
});

export const setCommunityGamesSchema = z.object({
  gameIds: z.array(z.string().min(1)).max(50),
});

export const communityAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(8000),
  pinned: z.boolean().optional().default(false),
});
export type CommunityAnnouncementInput = z.infer<typeof communityAnnouncementSchema>;

export const updateCommunityAnnouncementSchema = communityAnnouncementSchema.partial();

export const communityTournamentStatusSchema = z.enum([
  'upcoming',
  'inProgress',
  'completed',
]);
export type CommunityTournamentStatus = z.infer<typeof communityTournamentStatusSchema>;

// ---------------------------------------------------------------------------
// Ranking schemas
// ---------------------------------------------------------------------------

export const RANKING_DEFAULTS = {
  startingRating: 1500,
  kFactorNew: 40,
  kFactorNormal: 20,
  kFactorPro: 10,
  newPlayerMatches: 10,
  proThreshold: 2000,
} as const;

export const RANKING_K_FACTOR_HELP = {
  kFactorNew:
    'Applied while a player has fewer than the "new player matches" count. A high value lets newcomers move quickly toward their true skill.',
  kFactorNormal:
    'Applied to established players. Moderate values keep ratings responsive without wild swings.',
  kFactorPro:
    'Applied once a rating reaches the pro threshold. A low value keeps top ratings stable and hard-earned.',
  newPlayerMatches: 'How many matches a player is considered "new" for.',
  proThreshold: 'Rating at which the pro K-factor kicks in.',
  startingRating: 'Rating every new player starts with.',
} as const;

const kFactor = z.number().int().min(1).max(200);

export const createRankingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  gameId: z.string().optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  startingRating: z.number().int().min(0).max(5000).optional(),
  kFactorNew: kFactor.optional(),
  kFactorNormal: kFactor.optional(),
  kFactorPro: kFactor.optional(),
  newPlayerMatches: z.number().int().min(0).max(500).optional(),
  proThreshold: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});
export type CreateRankingInput = z.infer<typeof createRankingSchema>;

export const updateRankingSchema = createRankingSchema.partial();
export type UpdateRankingInput = z.infer<typeof updateRankingSchema>;

export const rankingEntriesQuerySchema = z.object({
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
});

// ---------------------------------------------------------------------------
// Template schemas
// ---------------------------------------------------------------------------

export const templatePayloadSchema = z
  .object({
    name: z.string().max(120).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    gameId: z.string().optional().nullable(),
    gameName: z.string().optional().nullable(),
    isPublic: z.boolean().optional(),
    pointsWin: z.number().int().min(0).optional(),
    pointsDraw: z.number().int().min(0).optional(),
    allowPercent: z.boolean().optional(),
    settings: z.record(z.unknown()).optional(),
    venueType: z.string().optional().nullable(),
    venueName: z.string().optional().nullable(),
    venueAddress: z.string().optional().nullable(),
    venueUrl: z.string().optional().nullable(),
    format: z.string().optional().nullable(),
    logoUrl: z.string().optional().nullable(),
    backgroundImageUrl: z.string().optional().nullable(),
    teamCount: z.number().int().min(2).max(512).optional(),
  })
  .passthrough();
export type TemplatePayload = z.infer<typeof templatePayloadSchema>;

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  communityId: z.string().optional().nullable(),
  payload: templatePayloadSchema,
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const templateFromTournamentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  communityId: z.string().optional().nullable(),
});
export type TemplateFromTournamentInput = z.infer<typeof templateFromTournamentSchema>;
