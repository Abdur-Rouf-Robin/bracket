import Link from 'next/link';
import { Check, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLANS, formatPlanPrice, planMonthlyEquivalentCents } from '@/lib/plans';

const HIGHLIGHTS = [
  'No ads on your tournament pages',
  'Up to 512 participants',
  'Auto-scheduler with venues & referees',
  'Custom branding & embed themes',
];

export function PremierUpsell({ className }: { className?: string }) {
  const premier = PLANS.PREMIER;
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[var(--color-premier)]/40 bg-gradient-to-br from-[var(--color-premier)]/15 via-[var(--color-card)] to-[var(--color-card)] p-5 ${className ?? ''}`}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--color-premier)]/20 text-[var(--color-premier)]">
          <Crown className="size-4" aria-hidden />
        </span>
        <p className="font-display text-base font-bold">Go Premier</p>
      </div>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        From {formatPlanPrice(planMonthlyEquivalentCents(premier, 'year'))}/mo billed yearly.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {HIGHLIGHTS.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-premier)]" aria-hidden />
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2">
        <Button variant="premier" size="sm" asChild>
          <Link href="/pricing">Upgrade</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/features">Compare plans</Link>
        </Button>
      </div>
    </div>
  );
}
