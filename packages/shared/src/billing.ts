// Contracts for the billing feature area. Owned by its workstream.
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

export const FREE_MAX_PARTICIPANTS_DEFAULT = 256;
export const PREMIER_MAX_PARTICIPANTS_DEFAULT = 512;

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Standard',
    tagline: 'Everything you need to run a tournament. Free forever.',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    features: [
      'Unlimited tournaments, communities and events',
      `Up to ${FREE_MAX_PARTICIPANTS_DEFAULT} participants per tournament`,
      'All bracket formats and live results',
      'Public pages, embeds, QR codes and TV mode',
      'Sign-up pages, check-in and waitlists',
      'Attachments as links',
      'Ad-supported',
    ],
    limits: {
      maxParticipants: FREE_MAX_PARTICIPANTS_DEFAULT,
      fileAttachmentsMb: 0,
      customEmbedThemes: false,
      adsFree: false,
      autoScheduler: false,
      prioritySupport: false,
      proCommunities: 0,
      csvPdfExport: false,
    },
  },
  PREMIER: {
    id: 'PREMIER',
    name: 'Premier',
    tagline: 'For organizers who run serious events.',
    priceMonthlyCents: 1200,
    priceYearlyCents: 8388, // $6.99 × 12
    features: [
      'No ads for you and your viewers',
      `Up to ${PREMIER_MAX_PARTICIPANTS_DEFAULT} participants per tournament`,
      'Custom embed themes and branding',
      'File attachments up to 25 MB',
      'Auto-scheduler with venues and referees',
      'CSV and PDF exports',
      '1 Pro community with Elo rankings',
      'Priority support',
    ],
    limits: {
      maxParticipants: PREMIER_MAX_PARTICIPANTS_DEFAULT,
      fileAttachmentsMb: 25,
      customEmbedThemes: true,
      adsFree: true,
      autoScheduler: true,
      prioritySupport: true,
      proCommunities: 1,
      csvPdfExport: true,
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
