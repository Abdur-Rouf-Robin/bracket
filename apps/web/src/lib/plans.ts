import {
  PLANS,
  PLAN_LIST,
  formatPlanPrice,
  planMonthlyEquivalentCents,
  type BillingInterval,
  type PlanDefinition,
  type PlanId,
} from '@bracket/shared';

export { PLANS, PLAN_LIST, formatPlanPrice, planMonthlyEquivalentCents };
export type { BillingInterval, PlanDefinition, PlanId };

/** A cell in the comparison table: boolean check, or a short text value. */
export type FeatureValue = boolean | string;

export type FeatureRow = {
  label: string;
  hint?: string;
  included: FeatureValue;
};

export type FeatureSection = {
  id: string;
  title: string;
  rows: FeatureRow[];
};

export const FEATURE_SECTIONS: FeatureSection[] = [
  {
    id: 'formats',
    title: 'Formats',
    rows: [
      { label: 'Single & double elimination', included: true },
      { label: 'Round robin & Swiss', included: true },
      { label: 'Groups → knockout (two-stage)', included: true },
      { label: 'Free-for-all, leaderboard & racing', included: true },
      { label: 'Third-place & placement matches', included: true },
      { label: 'Best-of series & bracket reset', included: true },
      {
        label: 'Participants per tournament',
        included: `${PLANS.FREE.limits.maxParticipants}`,
      },
    ],
  },
  {
    id: 'tournament-page',
    title: 'Tournament page',
    rows: [
      { label: 'Live bracket, matches & standings', included: true },
      { label: 'Announcements & rules', included: true },
      { label: 'Player stats & MVP leaderboard', included: true },
      { label: 'Predictions & match voting', included: true },
      { label: 'Ad-free for you and your viewers', included: true },
      { label: 'Custom branding colours & logo', included: true },
      { label: 'Hide "Powered by" footer', included: true },
    ],
  },
  {
    id: 'participants',
    title: 'Participants & registration',
    rows: [
      { label: 'Public sign-up pages', included: true },
      { label: 'Check-in & roster lock', included: true },
      { label: 'Waitlists & approvals', included: true },
      { label: 'Custom registration fields', included: true },
      { label: 'Paid registration (Stripe, optional)', included: 'Organizer keeps the fee' },
      { label: 'Match attachments', included: `Files up to ${PLANS.FREE.limits.fileAttachmentsMb} MB` },
    ],
  },
  {
    id: 'scheduling',
    title: 'Scheduling',
    rows: [
      { label: 'Manual match times & stations', included: true },
      { label: 'Station queue & TV display', included: true },
      { label: 'Auto-scheduler with venues & referees', included: true },
      { label: 'Referee assignments & availability', included: true },
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing & embed',
    rows: [
      { label: 'Share links, QR codes & social cards', included: true },
      { label: 'Embeddable bracket & standings', included: true },
      { label: 'Custom embed themes', included: true },
      { label: 'Private / password-protected pages', included: true },
      { label: 'Printable brackets', included: true },
      { label: 'CSV & PDF exports', included: true },
    ],
  },
  {
    id: 'communities',
    title: 'Communities & events',
    rows: [
      { label: 'Communities with roles & followers', included: true },
      { label: 'Events with multiple tournaments', included: true },
      { label: 'Tickets & orders', included: true },
      { label: 'Elo rankings', included: true },
      { label: 'Tournament templates', included: true },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    rows: [
      { label: 'REST API & API keys', included: true },
      { label: 'Webhooks', included: true },
      { label: 'Live updates over WebSockets', included: true },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    rows: [
      { label: 'Help center & community support', included: true },
    ],
  },
];

export const ANNUAL_SAVINGS_PERCENT = 0;

export function premierPriceLabel(_interval: BillingInterval): string {
  return '$0';
}
