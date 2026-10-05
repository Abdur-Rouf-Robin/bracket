'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { SettingsShell } from '@/components/account/settings-shell';
import { useBillingMe } from '@/components/marketing/pricing-plans';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PLANS, formatPlanPrice } from '@/lib/plans';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CheckoutResponse } from '@bracket/shared';

function BillingPanel() {
  const { token } = useAuth();
  const { data: me, isLoading } = useBillingMe();
  const plan = me?.plan === 'PREMIER' ? PLANS.PREMIER : PLANS.FREE;
  const checkout = useMutation({
    mutationFn: () =>
      api<CheckoutResponse>('/billing/checkout', {
        method: 'POST',
        token,
        body: JSON.stringify({ interval: 'month' }),
      }),
    onSuccess: (res) => {
      if ('url' in res && res.url) {
        window.location.href = res.url;
        return;
      }
      toast.message('Premier checkout needs Stripe price IDs in the API environment.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
            <h2 className="font-display mt-1 text-2xl font-bold">{plan.name}</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{plan.tagline}</p>
          </div>
          <Badge variant="accent">{formatPlanPrice(plan.priceMonthlyCents)}/mo</Badge>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-muted)]">Active tournaments</dt>
            <dd className="font-semibold">
              {plan.limits.maxActiveTournaments == null ? 'Unlimited' : plan.limits.maxActiveTournaments}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Editors and co-admins</dt>
            <dd className="font-semibold">{plan.limits.coAdmins ? 'Yes' : 'Owner only'}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          {me?.plan !== 'PREMIER' && (
            <Button disabled={checkout.isPending} onClick={() => checkout.mutate()}>
              Upgrade to Premier
            </Button>
          )}
          <Button variant="secondary" asChild>
            <Link href="/pricing">Compare plans</Link>
          </Button>
        </div>
      </section>

      <section className="gaming-card rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">On your plan</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {plan.features.map((f) => (
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
      description="Starter is one active tournament. Premier removes the cap and adds editors."
    >
      <BillingPanel />
    </SettingsShell>
  );
}
