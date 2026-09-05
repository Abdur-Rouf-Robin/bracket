'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Crown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { CheckoutResponse } from '@bracket/shared';
import { SettingsShell } from '@/components/account/settings-shell';
import {
  IntervalToggle,
  NotConfiguredDialog,
  useBillingMe,
  useCheckout,
} from '@/components/marketing/pricing-plans';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  PLANS,
  formatPlanPrice,
  planMonthlyEquivalentCents,
  type BillingInterval,
} from '@/lib/plans';
import { cn } from '@/lib/utils';

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function BillingPanel() {
  const { token, refreshUser } = useAuth();
  const { data: me, isLoading, refetch } = useBillingMe();
  const checkout = useCheckout();
  const [interval, setInterval] = useState<BillingInterval>('year');
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') !== '1') return;
    toast.success('Premier is now active on your account.');
    void refetch();
    void refreshUser();
    window.history.replaceState({}, '', '/settings/billing');
  }, [refetch, refreshUser]);

  const portal = useMutation({
    mutationFn: () =>
      api<CheckoutResponse>('/billing/portal', { method: 'POST', token }),
    onSuccess: (res) => {
      if ('url' in res && res.url) {
        window.location.assign(res.url);
        return;
      }
      setNotConfigured(true);
    },
    onError: (err: Error) => toast.error(err.message || 'Could not open billing portal'),
  });

  if (isLoading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading billing…</p>;
  }
  if (!me) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Could not load billing. Refresh the page or try again later.
      </p>
    );
  }

  const isPremier = me.plan === 'PREMIER';
  const planName = isPremier ? PLANS.PREMIER.name : PLANS.FREE.name;
  const renewal =
    formatDate(me.subscription?.currentPeriodEnd) ?? formatDate(me.planExpiresAt);
  const premierMonthly = planMonthlyEquivalentCents(PLANS.PREMIER, interval);

  return (
    <div className="space-y-6">
      <section className="gaming-card rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Current plan
            </p>
            <h2 className="font-display mt-1 inline-flex items-center gap-2 text-2xl font-bold">
              {isPremier && (
                <Crown className="size-5 text-[var(--color-premier)]" aria-hidden />
              )}
              {planName}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {isPremier ? PLANS.PREMIER.tagline : PLANS.FREE.tagline}
            </p>
          </div>
          <Badge variant={isPremier ? 'premier' : 'accent'}>
            {isPremier ? 'Premier' : 'Standard'}
          </Badge>
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-muted)]">Participants per tournament</dt>
            <dd className="font-semibold">{me.limits.maxParticipants}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">
              {me.subscription?.cancelAtPeriodEnd ? 'Access through' : 'Renews'}
            </dt>
            <dd className="font-semibold">{renewal ?? (isPremier ? '—' : 'Free forever')}</dd>
          </div>
        </dl>

        {me.subscription?.cancelAtPeriodEnd && isPremier && (
          <p className="mt-4 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-sm">
            Cancellation is scheduled. You keep Premier until{' '}
            {renewal ?? 'the end of the current period'}, then you return to Standard.
          </p>
        )}

        {me.subscription && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Status: {me.subscription.status.replaceAll('_', ' ').toLowerCase()}
            {me.subscription.interval ? ` · billed ${me.subscription.interval}ly` : ''}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {isPremier ? (
            <Button
              type="button"
              variant="secondary"
              loading={portal.isPending}
              onClick={() => portal.mutate()}
            >
              Manage subscription
            </Button>
          ) : (
            <>
              <IntervalToggle value={interval} onChange={setInterval} />
              <Button
                type="button"
                variant="premier"
                loading={checkout.isPending}
                onClick={() => checkout.mutate(interval)}
              >
                <Sparkles />
                Upgrade — {formatPlanPrice(premierMonthly)}/mo
              </Button>
            </>
          )}
          <Button variant="ghost" asChild>
            <Link href="/pricing">View full pricing</Link>
          </Button>
        </div>
      </section>

      <section className="gaming-card rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">Compare plans</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Standard is free forever. Premier removes ads and unlocks organizer tools.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {([PLANS.FREE, PLANS.PREMIER] as const).map((plan) => {
            const current = plan.id === me.plan;
            return (
              <div
                key={plan.id}
                className={cn(
                  'rounded-xl border p-4',
                  current
                    ? plan.id === 'PREMIER'
                      ? 'border-[var(--color-premier)]/50 bg-[var(--color-premier)]/5'
                      : 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5'
                    : 'border-[var(--color-line)]',
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-display font-bold">{plan.name}</p>
                  {current && <Badge variant={plan.id === 'PREMIER' ? 'premier' : 'accent'}>Current</Badge>}
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {plan.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check
                        className={cn(
                          'mt-0.5 size-4 shrink-0',
                          plan.id === 'PREMIER'
                            ? 'text-[var(--color-premier)]'
                            : 'text-[var(--color-ok)]',
                        )}
                        aria-hidden
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <NotConfiguredDialog
        open={checkout.notConfigured || notConfigured}
        onOpenChange={(open) => {
          checkout.setNotConfigured(open);
          if (!open) setNotConfigured(false);
        }}
      />
    </div>
  );
}

export default function SettingsBillingPage() {
  return (
    <SettingsShell
      title="Billing"
      description="Your plan, renewal date, and invoices."
    >
      <BillingPanel />
    </SettingsShell>
  );
}
