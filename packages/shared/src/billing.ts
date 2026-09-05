// Contracts for the billing feature area. Plans stay in the schema for
// compatibility; every organizer gets the full feature set at no charge.
import { z } from 'zod';

export const PlanId = {
  FREE: 'FREE',
  PREMIER: 'PREMIER',
} as const;
export type PlanId = (typeof PlanId)[keyof typeof PlanId];

export const BillingInterval = {
  MONTH: 'month',
  YEAR: 'year',
} as const;
export type BillingInterval =
  (typeof BillingInterval)[keyof typeof BillingInterval];

export type PlanLimits = {
  maxParticipants: number;
  fileAttachmentsMb: number;
  customEmbedThemes: boolean;
  adsFree: boolean;
  autoScheduler: boolean;
  prioritySupport: boolean;
  proCommunities: number;
  csvPdfExport: boolean;
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Price in cents when billed monthly. */
  priceMonthlyCents: number;
  /** Total price in cents when billed yearly (charged once per year). */
  priceYearlyCents: number;
  features: string[];
  limits: PlanLimits;
};

export const FREE_MAX_PARTICIPANTS_DEFAULT = 4096;
export const PREMIER_MAX_PARTICIPANTS_DEFAULT = 4096;

const UNLOCKED_LIMITS: PlanLimits = {
  maxParticipants: FREE_MAX_PARTICIPANTS_DEFAULT,
  fileAttachmentsMb: 25,
  customEmbedThemes: true,
  adsFree: true,
  autoScheduler: true,
  prioritySupport: true,
  proCommunities: 999,
  csvPdfExport: true,
};

const UNLOCKED_FEATURES = [
  'Unlimited tournaments, communities and events',
  `Up to ${FREE_MAX_PARTICIPANTS_DEFAULT} participants per tournament`,
  'All formats: round robin, Swiss, single/double elim, groups, leaderboard, racing',
  'Mobile, PC, console and sports catalogs',
  'Live cricket scoreboard with international playing conditions',
  'Auto-scheduler, referees, CSV/PDF, embeds, TV mode and custom branding',
  'No ads. No paywalls. Free forever.',
];

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    tagline: 'Every organizer feature, free forever.',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    features: UNLOCKED_FEATURES,
    limits: UNLOCKED_LIMITS,
  },
  PREMIER: {
    id: 'PREMIER',
    name: 'Free',
    tagline: 'Every organizer feature, free forever.',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    features: UNLOCKED_FEATURES,
    limits: UNLOCKED_LIMITS,
  },
};

export const PLAN_LIST: PlanDefinition[] = [PLANS.FREE];

/** Effective monthly price in cents for a given interval. */
export function planMonthlyEquivalentCents(
  plan: PlanDefinition,
  interval: BillingInterval,
): number {
  return interval === 'year'
    ? Math.round(plan.priceYearlyCents / 12)
    : plan.priceMonthlyCents;
}

export function formatPlanPrice(cents: number, currency = 'USD'): string {
  const value = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export const checkoutSchema = z.object({
  interval: z.enum(['month', 'year']).default('month'),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const adminGrantPlanSchema = z.object({
  userId: z.string().min(1),
  plan: z.enum(['FREE', 'PREMIER']),
  expiresAt: z.string().datetime().optional().nullable(),
});
export type AdminGrantPlanInput = z.infer<typeof adminGrantPlanSchema>;

export type BillingSubscriptionView = {
  plan: PlanId;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING';
  interval: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type BillingMeResponse = {
  plan: PlanId;
  planExpiresAt: string | null;
  subscription: BillingSubscriptionView | null;
  limits: PlanLimits;
  configured: boolean;
};

export type CheckoutResponse = { url: string } | { configured: false };
