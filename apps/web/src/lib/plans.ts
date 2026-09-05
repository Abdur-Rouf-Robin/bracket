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
  standard: FeatureValue;
  premier: FeatureValue;
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
      { label: 'Single & double elimination', standard: true, premier: true },
      { label: 'Round robin & Swiss', standard: true, premier: true },
      { label: 'Groups → knockout (two-stage)', standard: true, premier: true },
      { label: 'Free-for-all, leaderboard & racing', standard: true, premier: true },
      { label: 'Third-place & placement matches', standard: true, premier: true },
      { label: 'Best-of series & bracket reset', standard: true, premier: true },
      {
        label: 'Participants per tournament',
        standard: `${PLANS.FREE.limits.maxParticipants}`,
        premier: `${PLANS.PREMIER.limits.maxParticipants}`,
      },
    ],
  },
  {
    id: 'tournament-page',
    title: 'Tournament page',
    rows: [
      { label: 'Live bracket, matches & standings', standard: true, premier: true },
      { label: 'Announcements & rules', standard: true, premier: true },
      { label: 'Player stats & MVP leaderboard', standard: true, premier: true },
      { label: 'Predictions & match voting', standard: true, premier: true },
      { label: 'Ad-free for you and your viewers', standard: false, premier: true },
      { label: 'Custom branding colours & logo', standard: 'Logo only', premier: true },
      { label: 'Hide "Powered by" footer', standard: false, premier: true },
    ],
  },
  {
    id: 'participants',
    title: 'Participants & registration',
    rows: [
      { label: 'Public sign-up pages', standard: true, premier: true },
      { label: 'Check-in & roster lock', standard: true, premier: true },
      { label: 'Waitlists & approvals', standard: true, premier: true },
      { label: 'Custom registration fields', standard: true, premier: true },
      { label: 'Paid registration (Stripe)', standard: 'Platform fee', premier: 'Platform fee' },
      { label: 'Match attachments', standard: 'Links', premier: `Files up to ${PLANS.PREMIER.limits.fileAttachmentsMb} MB` },
    ],
  },
  {
    id: 'scheduling',
    title: 'Scheduling',
    rows: [
      { label: 'Manual match times & stations', standard: true, premier: true },
      { label: 'Station queue & TV display', standard: true, premier: true },
      { label: 'Auto-scheduler with venues & referees', standard: false, premier: true },
      { label: 'Referee assignments & availability', standard: false, premier: true },
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing & embed',
    rows: [
      { label: 'Share links, QR codes & social cards', standard: true, premier: true },
      { label: 'Embeddable bracket & standings', standard: true, premier: true },
      { label: 'Custom embed themes', standard: false, premier: true },
      { label: 'Private / password-protected pages', standard: true, premier: true },
      { label: 'Printable brackets', standard: true, premier: true },
      { label: 'CSV & PDF exports', standard: false, premier: true },
    ],
  },
  {
    id: 'communities',
    title: 'Communities & events',
    rows: [
      { label: 'Communities with roles & followers', standard: true, premier: true },
      { label: 'Events with multiple tournaments', standard: true, premier: true },
      { label: 'Tickets & orders', standard: true, premier: true },
      { label: 'Pro community with Elo rankings', standard: false, premier: `${PLANS.PREMIER.limits.proCommunities} included` },
      { label: 'Tournament templates', standard: true, premier: true },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    rows: [
      { label: 'REST API & API keys', standard: true, premier: true },
      { label: 'Webhooks', standard: true, premier: true },
      { label: 'Live updates over WebSockets', standard: true, premier: true },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    rows: [
      { label: 'Help center & community support', standard: true, premier: true },
      { label: 'Priority email support', standard: false, premier: true },
    ],
  },
];

export const ANNUAL_SAVINGS_PERCENT = Math.round(
  (1 -
    PLANS.PREMIER.priceYearlyCents /
      (PLANS.PREMIER.priceMonthlyCents * 12)) *
    100,
);

export function premierPriceLabel(interval: BillingInterval): string {
  const monthly = planMonthlyEquivalentCents(PLANS.PREMIER, interval);
  return `${formatPlanPrice(monthly)}/mo`;
}
