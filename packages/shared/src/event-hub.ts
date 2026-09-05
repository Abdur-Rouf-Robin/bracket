// Contracts for the event-hub feature area (multi-tournament events, tickets,
// orders, check-in). Owned by its workstream.
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EVENT_VENUE_TYPES = ['ONLINE', 'PHYSICAL'] as const;
export type EventVenueType = (typeof EVENT_VENUE_TYPES)[number];

export const EVENT_ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'REFUNDED',
  'CANCELLED',
] as const;
export type EventOrderStatus = (typeof EVENT_ORDER_STATUSES)[number];

export const EVENT_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'INR',
  'BDT',
  'JPY',
  'BRL',
  'MXN',
] as const;

/** Zero-decimal currencies per Stripe. */
export const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP']);

/** Common IANA zones offered in the event timezone picker. */
export const COMMON_TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Manila',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

/** Uppercase alphanumerics without ambiguous glyphs (0/O, 1/I/L). */
export const ORDER_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ORDER_CODE_LENGTH = 8;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const optionalUrl = z.string().url().max(2048).optional().nullable();
const optionalDate = z.string().datetime().optional().nullable();
const slugSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes');

export const createEventSchema = z.object({
  name: z.string().min(2).max(120),
  slug: slugSchema.optional(),
  description: z.string().max(10000).optional().nullable(),
  startAt: optionalDate,
  endAt: optionalDate,
  timezone: z.string().min(1).max(64).optional(),
  venueType: z.enum(EVENT_VENUE_TYPES).optional().nullable(),
  venueName: z.string().max(160).optional().nullable(),
  venueAddress: z.string().max(400).optional().nullable(),
  venueUrl: optionalUrl,
  streamUrl: optionalUrl,
  logoUrl: optionalUrl,
  bannerUrl: optionalUrl,
  isPublic: z.boolean().optional(),
  communityId: z.string().cuid().optional().nullable(),
});

export const updateEventSchema = createEventSchema.partial();

export const listEventsQuerySchema = z.object({
  q: z.string().max(120).optional(),
  upcoming: z
    .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
    .optional(),
  communityId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});

export const eventAdminSchema = z.object({
  email: z.string().email(),
});

export const eventQuickTournamentSchema = z.object({
  name: z.string().min(2).max(120),
  gameId: z.string().cuid().optional().nullable(),
  format: z
    .enum([
      'ROUND_ROBIN',
      'SINGLE_ELIMINATION',
      'DOUBLE_ELIMINATION',
      'GROUPS_KNOCKOUT',
      'SWISS',
      'LEADERBOARD',
      'FREE_FOR_ALL',
      'TIME_TRIAL',
      'SINGLE_RACE',
      'GRAND_PRIX',
    ])
    .optional(),
  startAt: optionalDate,
  isPublic: z.boolean().optional(),
});

export const createEventTicketSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  priceCents: z.number().int().min(0).max(10_000_000).default(0),
  currency: z.string().length(3).transform((s) => s.toUpperCase()).default('USD'),
  quantity: z.number().int().min(1).max(1_000_000).optional().nullable(),
  salesStartAt: optionalDate,
  salesEndAt: optionalDate,
  isActive: z.boolean().default(true),
  order: z.number().int().min(0).optional(),
});

export const updateEventTicketSchema = createEventTicketSchema.partial();

export const createEventOrderSchema = z.object({
  ticketId: z.string().cuid(),
  quantity: z.number().int().min(1).max(10).default(1),
  buyerName: z.string().min(1).max(120),
  buyerEmail: z.string().email().max(200),
});

export const updateEventOrderSchema = z.object({
  status: z.enum(['REFUNDED', 'CANCELLED', 'PAID']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const listEventOrdersQuerySchema = z.object({
  status: z.enum(EVENT_ORDER_STATUSES).optional(),
  q: z.string().max(120).optional(),
});

export const eventCheckInSchema = z.object({
  code: z
    .string()
    .min(4)
    .max(16)
    .transform((s) => s.trim().toUpperCase()),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type EventAdminInput = z.infer<typeof eventAdminSchema>;
export type EventQuickTournamentInput = z.infer<typeof eventQuickTournamentSchema>;
export type CreateEventTicketInput = z.infer<typeof createEventTicketSchema>;
export type UpdateEventTicketInput = z.infer<typeof updateEventTicketSchema>;
export type CreateEventOrderInput = z.infer<typeof createEventOrderSchema>;
export type UpdateEventOrderInput = z.infer<typeof updateEventOrderSchema>;
export type ListEventOrdersQuery = z.infer<typeof listEventOrdersQuerySchema>;
export type EventCheckInInput = z.infer<typeof eventCheckInSchema>;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Convert a YouTube / Twitch URL into an embeddable iframe `src`.
 * Returns null when the URL isn't a recognised stream provider.
 *
 * Supported:
 *  - youtube.com/watch?v=ID, youtu.be/ID, youtube.com/live/ID,
 *    youtube.com/shorts/ID, youtube.com/embed/ID
 *  - twitch.tv/CHANNEL, twitch.tv/videos/ID, player.twitch.tv/?channel=…
 */
export function toStreamEmbedUrl(
  url: string | null | undefined,
  opts: { parentHost?: string } = {},
): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\.|^m\./, '').toLowerCase();
  const parent = opts.parentHost ?? 'localhost';

  const youtubeId = (id: string | null | undefined) => {
    if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
    return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`;
  };

  if (host === 'youtu.be') {
    return youtubeId(parsed.pathname.split('/').filter(Boolean)[0]);
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') return youtubeId(parsed.searchParams.get('v'));
    if (
      parts[0] === 'live' ||
      parts[0] === 'shorts' ||
      parts[0] === 'embed' ||
      parts[0] === 'v'
    ) {
      return youtubeId(parts[1]);
    }
    if (parts[0] === 'channel' && parts[1]) {
      return `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(parts[1])}`;
    }
    return null;
  }

  if (host === 'player.twitch.tv') {
    const channel = parsed.searchParams.get('channel');
    const video = parsed.searchParams.get('video');
    if (channel) {
      return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&autoplay=false`;
    }
    if (video) {
      return `https://player.twitch.tv/?video=${encodeURIComponent(video)}&parent=${parent}&autoplay=false`;
    }
    return null;
  }
  if (host === 'twitch.tv') {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] === 'videos' && parts[1]) {
      return `https://player.twitch.tv/?video=${encodeURIComponent(parts[1])}&parent=${parent}&autoplay=false`;
    }
    if (parts[0] && /^[A-Za-z0-9_]{3,30}$/.test(parts[0])) {
      return `https://player.twitch.tv/?channel=${encodeURIComponent(parts[0].toLowerCase())}&parent=${parent}&autoplay=false`;
    }
    return null;
  }

  return null;
}

/** Best-effort provider label for a stream URL. */
export function streamProvider(
  url: string | null | undefined,
): 'youtube' | 'twitch' | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      return 'youtube';
    }
    if (host.endsWith('twitch.tv')) return 'twitch';
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Generate an order code from the unambiguous alphabet. `random` returns a
 * float in [0, 1); pass a seeded RNG for deterministic tests.
 */
export function generateOrderCode(
  random: () => number = Math.random,
  length: number = ORDER_CODE_LENGTH,
): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(random() * ORDER_CODE_ALPHABET.length);
    out += ORDER_CODE_ALPHABET[Math.min(idx, ORDER_CODE_ALPHABET.length - 1)];
  }
  return out;
}

/** Normalise user-typed order codes (strip separators/whitespace, upper-case). */
export function normalizeOrderCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);
}

/** `j***e@example.com` — keeps first and last char of the local part. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/** Format minor-unit amounts. Zero → "Free". */
export function formatMoney(
  amountCents: number,
  currency: string,
  locale: string = 'en-US',
): string {
  if (amountCents === 0) return 'Free';
  const zeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
  const value = zeroDecimal ? amountCents : amountCents / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: zeroDecimal ? 0 : 2,
    }).format(value);
  } catch {
    return `${value.toFixed(zeroDecimal ? 0 : 2)} ${currency.toUpperCase()}`;
  }
}

/** URL-safe slug from a free-text name (ASCII only). */
export function slugifyEventName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Whether a ticket can be bought right now. */
export function ticketSaleState(
  ticket: {
    isActive: boolean;
    salesStartAt?: string | Date | null;
    salesEndAt?: string | Date | null;
    quantity?: number | null;
    sold?: number;
  },
  now: Date = new Date(),
): 'inactive' | 'not_started' | 'ended' | 'sold_out' | 'on_sale' {
  if (!ticket.isActive) return 'inactive';
  if (ticket.salesStartAt && new Date(ticket.salesStartAt) > now) return 'not_started';
  if (ticket.salesEndAt && new Date(ticket.salesEndAt) < now) return 'ended';
  if (
    ticket.quantity != null &&
    ticket.sold != null &&
    ticket.quantity - ticket.sold <= 0
  ) {
    return 'sold_out';
  }
  return 'on_sale';
}

/** Google Maps search link for a physical venue. */
export function venueMapsUrl(
  venueName?: string | null,
  venueAddress?: string | null,
): string | null {
  const q = [venueName, venueAddress].filter(Boolean).join(', ').trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Group tournaments into Challonge-style lanes. */
export function bucketTournamentStatus(
  status: string,
): 'upcoming' | 'in_progress' | 'completed' {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'ACTIVE') return 'in_progress';
  return 'upcoming';
}
