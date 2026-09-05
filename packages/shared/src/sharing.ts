// Contracts for the sharing / exports / discovery / developer-platform feature area.
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Embed
// ---------------------------------------------------------------------------

export const EMBED_TABS = [
  'bracket',
  'standings',
  'matches',
  'schedule',
  'participants',
] as const;
export type EmbedTab = (typeof EMBED_TABS)[number];

export const EMBED_THEMES = ['dark', 'light', 'auto'] as const;
export type EmbedTheme = (typeof EMBED_THEMES)[number];

export const embedOptionsSchema = z.object({
  tab: z.enum(EMBED_TABS).default('bracket'),
  theme: z.enum(EMBED_THEMES).default('auto'),
  lang: z.string().max(8).default('en'),
  hideHeader: z.boolean().default(false),
  showTabs: z.boolean().default(false),
  autoRefresh: z.number().int().min(0).max(3600).default(0),
});
export type EmbedOptions = z.infer<typeof embedOptionsSchema>;

/** Build the `/embed/:slug` query string from embed options. */
export function embedQueryString(opts: Partial<EmbedOptions>): string {
  const params = new URLSearchParams();
  if (opts.tab && opts.tab !== 'bracket') params.set('tab', opts.tab);
  if (opts.theme && opts.theme !== 'auto') params.set('theme', opts.theme);
  if (opts.lang && opts.lang !== 'en') params.set('lang', opts.lang);
  if (opts.hideHeader) params.set('hideHeader', '1');
  if (opts.showTabs) params.set('showTabs', '1');
  if (opts.autoRefresh) params.set('autoRefresh', String(opts.autoRefresh));
  const s = params.toString();
  return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// TV display
// ---------------------------------------------------------------------------

export const TV_SLIDES = [
  'standings',
  'bracket',
  'upcoming',
  'results',
  'stations',
] as const;
export type TvSlide = (typeof TV_SLIDES)[number];

// ---------------------------------------------------------------------------
// View password
// ---------------------------------------------------------------------------

export const setViewPasswordSchema = z.object({
  password: z.string().min(4).max(72).nullable(),
});
export type SetViewPasswordInput = z.infer<typeof setViewPasswordSchema>;

export const unlockTournamentSchema = z.object({
  password: z.string().min(1).max(72),
});
export type UnlockTournamentInput = z.infer<typeof unlockTournamentSchema>;

export const VIEW_TOKEN_HEADER = 'x-view-token';

// ---------------------------------------------------------------------------
// Exports / imports
// ---------------------------------------------------------------------------

export const CSV_EXPORT_KINDS = [
  'participants',
  'registrations',
  'matches',
  'standings',
  'player-stats',
] as const;
export type CsvExportKind = (typeof CSV_EXPORT_KINDS)[number];

export const PUBLIC_CSV_EXPORT_KINDS = [
  'participants',
  'matches',
  'standings',
] as const;

export const PDF_EXPORT_KINDS = [
  'standings',
  'matches',
  'participants',
  'bracket',
  'schedule',
] as const;
export type PdfExportKind = (typeof PDF_EXPORT_KINDS)[number];

export const importParticipantsSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
  mode: z.enum(['replace', 'append']).default('append'),
  hasHeader: z.boolean().optional(),
  dryRun: z.boolean().optional().default(false),
});
export type ImportParticipantsInput = z.infer<typeof importParticipantsSchema>;

export type ImportParticipantRow = {
  name: string;
  seed?: number | null;
  group?: string | null;
  players: string[];
  logoUrl?: string | null;
  email?: string | null;
};

export type ImportPreview = {
  rows: ImportParticipantRow[];
  columns: Record<string, string | null>;
  errors: { line: number; message: string }[];
  warnings: string[];
  willCreate: number;
  willReplace: number;
};

export const IMPORT_TEMPLATE_CSV =
  'name,seed,group,players,logoUrl,email\n' +
  'Team Alpha,1,A,"Alice;Bob",https://example.com/alpha.png,alpha@example.com\n' +
  'Team Beta,2,A,"Carol;Dan",,beta@example.com\n' +
  'Team Gamma,3,B,"Eve",,\n';

// ---------------------------------------------------------------------------
// Clone / copy / reopen
// ---------------------------------------------------------------------------

export const cloneTournamentSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  includeParticipants: z.boolean().optional().default(false),
});
export type CloneTournamentInput = z.infer<typeof cloneTournamentSchema>;

export const copyParticipantsSchema = z.object({
  mode: z.enum(['replace', 'append']).default('append'),
});
export type CopyParticipantsInput = z.infer<typeof copyParticipantsSchema>;

// ---------------------------------------------------------------------------
// Discovery / search
// ---------------------------------------------------------------------------

export const SEARCH_SORTS = ['startAt', 'newest', 'popular', 'name'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const SEARCH_STATUSES = ['upcoming', 'live', 'completed'] as const;
export type SearchStatus = (typeof SEARCH_STATUSES)[number];

export const SEARCH_PAGE_SIZE_MAX = 48;

export const tournamentSearchQuerySchema = z.object({
  q: z.string().max(120).optional(),
  game: z.string().max(120).optional(),
  format: z.string().max(40).optional(),
  status: z.enum(SEARCH_STATUSES).optional(),
  country: z.string().max(8).optional(),
  community: z.string().max(80).optional(),
  sort: z.enum(SEARCH_SORTS).default('startAt'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(SEARCH_PAGE_SIZE_MAX).default(24),
});
export type TournamentSearchQuery = z.infer<typeof tournamentSearchQuerySchema>;

export type SearchResultItem = {
  id: string;
  slug: string;
  name: string;
  format: string | null;
  status: string;
  startAt: string | null;
  game: { id: string; name: string; category: string; slug?: string | null } | null;
  logoUrl: string | null;
  backgroundImageUrl: string | null;
  _count: { teams: number; matches: number };
  community: { slug: string; name: string } | null;
  venueName: string | null;
  venueType: string | null;
  isLive?: boolean;
};

export type SearchFacets = {
  games: { id: string; name: string; count: number }[];
  formats: { format: string; count: number }[];
  statuses: { status: SearchStatus; count: number }[];
};

export type TournamentSearchResponse = {
  items: SearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacets;
};

// ---------------------------------------------------------------------------
// Developer platform: API keys, public API v1, webhooks
// ---------------------------------------------------------------------------

export const API_KEY_SCOPES = ['read', 'write'] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const API_KEY_PREFIX = 'brk_live_';

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1).optional().default(['read']),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const WEBHOOK_EVENTS = [
  'tournament.started',
  'tournament.completed',
  'match.ready',
  'match.completed',
  'participant.registered',
  'registration.approved',
  'schedule.updated',
  'announcement.posted',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  'tournament.started': 'Tournament started (bracket generated)',
  'tournament.completed': 'Tournament completed (final results)',
  'match.ready': 'Match ready to play',
  'match.completed': 'Match result reported',
  'participant.registered': 'Participant registered',
  'registration.approved': 'Registration approved',
  'schedule.updated': 'Schedule updated',
  'announcement.posted': 'Announcement posted',
};

const httpsUrl = z
  .string()
  .url()
  .max(2048)
  .refine(
    (u) => /^https:\/\//i.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)/i.test(u),
    'Webhook URL must use https://',
  );

export const createWebhookSchema = z.object({
  url: httpsUrl,
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  tournamentId: z.string().cuid().optional().nullable(),
  communityId: z.string().cuid().optional().nullable(),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  isActive: z.boolean().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  url: httpsUrl.optional(),
});
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

export const WEBHOOK_AUTO_DISABLE_FAILURES = 20;

/** Payload shape delivered to webhook endpoints. */
export type WebhookDelivery<T = Record<string, unknown>> = {
  id: string;
  event: WebhookEvent;
  createdAt: string;
  tournamentId: string | null;
  data: T;
};

export const publicApiParticipantSchema = z.object({
  name: z.string().min(1).max(80),
  seed: z.number().int().min(1).max(4096).optional().nullable(),
  players: z.array(z.string().min(1).max(80)).max(20).optional(),
});
export type PublicApiParticipantInput = z.infer<typeof publicApiParticipantSchema>;

export const publicApiMatchResultSchema = z.object({
  homeScore: z.number().min(0),
  awayScore: z.number().min(0),
  winnerId: z.string().cuid().optional().nullable(),
  sets: z
    .array(z.object({ home: z.number().min(0), away: z.number().min(0) }))
    .max(9)
    .optional(),
  force: z.boolean().optional(),
});
export type PublicApiMatchResultInput = z.infer<typeof publicApiMatchResultSchema>;

export const PUBLIC_API_RATE_LIMIT_PER_MINUTE = 120;

// ---------------------------------------------------------------------------
// Participant access pages
// ---------------------------------------------------------------------------

export type ParticipantAccessMatch = {
  id: string;
  round: number;
  roundLabel: string;
  bracketSide: string;
  groupName: string | null;
  status: string;
  scheduledAt: string | null;
  station: string | null;
  isHome: boolean;
  opponent: { id: string; name: string; logoUrl: string | null } | null;
  myScore: number | null;
  opponentScore: number | null;
  result: 'win' | 'loss' | 'draw' | null;
};

export type ParticipantAccessPayload = {
  team: { id: string; name: string; seed: number | null; logoUrl: string | null; players: string[] };
  tournament: {
    id: string;
    slug: string;
    name: string;
    timezone: string;
    logoUrl: string | null;
    status: string;
    format: string | null;
  };
  matches: ParticipantAccessMatch[];
  nextMatch: ParticipantAccessMatch | null;
  standing: {
    rank: number;
    played: number;
    wins: number;
    losses: number;
    draws: number;
    points: number;
    groupName: string | null;
    groupSize: number;
  } | null;
  record: { wins: number; losses: number; draws: number };
};

// ---------------------------------------------------------------------------
// Social share helpers (pure)
// ---------------------------------------------------------------------------

export function socialShareLinks(url: string, text: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return {
    x: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    telegram: `https://t.me/share/url?url=${u}&text=${t}`,
    email: `mailto:?subject=${t}&body=${t}%0A%0A${u}`,
  };
}

/** Minimal safe hex color check for brand settings. */
export function isHexColor(value: string | null | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}
