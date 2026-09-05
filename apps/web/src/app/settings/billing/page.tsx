'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { SettingsShell } from '@/components/account/settings-shell';
import { useBillingMe } from '@/components/marketing/pricing-plans';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PLANS } from '@/lib/plans';

function BillingPanel() {
  const { data: me, isLoading } = useBillingMe();

  if (isLoading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <section className="gaming-card rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Platform plan
            </p>
            <h2 className="font-display mt-1 text-2xl font-bold">Free forever</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{PLANS.FREE.tagline}</p>
          </div>
          <Badge variant="accent">Included</Badge>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-muted)]">Participants per tournament</dt>
            <dd className="font-semibold">{me?.limits.maxParticipants ?? PLANS.FREE.limits.maxParticipants}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Ads / subscriptions</dt>
            <dd className="font-semibold">None</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Stripe is only for your own entry fees and event tickets. Bracket does not sell a
          platform subscription.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" asChild>
            <Link href="/pricing">See what is included</Link>
          </Button>
        </div>
      </section>

      <section className="gaming-card rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">Included for every organizer</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {PLANS.FREE.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-ok)]" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function SettingsBillingPage() {
  return (
    <SettingsShell
      title="Billing"
      description="The platform is free. Optional Stripe is only for your own tickets and entry fees."
    >
      <BillingPanel />
    </SettingsShell>
  );
}
