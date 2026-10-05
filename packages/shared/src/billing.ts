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
  /** Null means unlimited. A tournament is active after a result in the last 30 days. */
  maxActiveTournaments: number | null;
  fileAttachmentsMb: number;
  customEmbedThemes: boolean;
  adsFree: boolean;
  autoScheduler: boolean;
  prioritySupport: boolean;
  proCommunities: number;
  csvPdfExport: boolean;
  /** Co-admins and score-only editors. */
  coAdmins: boolean;
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

const SHARED_FEATURES = [
  `Up to ${FREE_MAX_PARTICIPANTS_DEFAULT} participants per tournament`,
  'All formats, including home-and-away round robin',
  'Auto-scheduler, blackouts, referees, CSV/PDF, embeds and TV mode',
  'Live cricket scoreboard',
  'No ads on public pages',
];

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Starter',
    tagline: 'One active tournament. Every format.',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    features: [
      '1 active tournament (a result in the last 30 days)',
      'You are the only organizer',
      ...SHARED_FEATURES,
    ],
    limits: {
      maxParticipants: FREE_MAX_PARTICIPANTS_DEFAULT,
      maxActiveTournaments: 1,
      fileAttachmentsMb: 25,
      customEmbedThemes: true,
      adsFree: true,
      autoScheduler: true,
      prioritySupport: false,
      proCommunities: 1,
      csvPdfExport: true,
      coAdmins: false,
    },
  },
  PREMIER: {
    id: 'PREMIER',
    name: 'Premier',
    tagline: 'Unlimited active tournaments, co-admins and score editors.',
    priceMonthlyCents: 900,
    priceYearlyCents: 9000,
    features: [
      'Unlimited active tournaments',
      'Co-admins and score-only editors',
      ...SHARED_FEATURES,
    ],
    limits: {
      maxParticipants: PREMIER_MAX_PARTICIPANTS_DEFAULT,
      maxActiveTournaments: null,
      fileAttachmentsMb: 25,
      customEmbedThemes: true,
      adsFree: true,
      autoScheduler: true,
      prioritySupport: true,
      proCommunities: 999,
      csvPdfExport: true,
      coAdmins: true,
    },
  },
};

export const PLAN_LIST: PlanDefinition[] = [PLANS.FREE, PLANS.PREMIER];

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
