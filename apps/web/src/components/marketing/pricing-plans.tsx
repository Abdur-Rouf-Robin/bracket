'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Crown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { BillingMeResponse, CheckoutResponse } from '@bracket/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  ANNUAL_SAVINGS_PERCENT,
  PLANS,
  formatPlanPrice,
  planMonthlyEquivalentCents,
  type BillingInterval,
} from '@/lib/plans';
import { cn } from '@/lib/utils';

export function useBillingMe() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['billing', 'me'],
    enabled: !!token,
    retry: 0,
    queryFn: async () => {
      try {
        return await api<BillingMeResponse>('/billing/me', { token });
      } catch {
        return null;
      }
    },
  });
}

export function useCheckout() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [notConfigured, setNotConfigured] = useState(false);

  const mutation = useMutation({
    mutationFn: async (interval: BillingInterval) => {
      if (!token) {
        router.push(`/register?next=${encodeURIComponent('/pricing')}`);
        return null;
      }
      return api<CheckoutResponse>('/billing/checkout', {
        method: 'POST',
        token,
        body: JSON.stringify({ interval }),
      });
    },
    onSuccess: (res) => {
      if (!res) return;
      if ('url' in res && res.url) {
        window.location.assign(res.url);
        return;
      }
      setNotConfigured(true);
    },
    onError: (err: Error) => toast.error(err.message || 'Could not start checkout'),
  });

  return { ...mutation, notConfigured, setNotConfigured, loggedIn: !!user };
}

export function NotConfiguredDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Payments not configured yet</DialogTitle>
          <DialogDescription>
            Online checkout is not enabled on this deployment. Contact us and we will set up
            Premier for your account manually.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild>
            <Link href="/contact?topic=premier">Contact us</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IntervalToggle({
  value,
  onChange,
  className,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex flex-col items-center gap-2', className)}>
      <SegmentedControl<BillingInterval>
        aria-label="Billing interval"
        value={value}
        onChange={onChange}
        options={[
          { value: 'month', label: 'Monthly' },
          {
            value: 'year',
            label: (
              <span className="inline-flex items-center gap-1.5">
                Yearly
                <span className="badge badge-ok normal-case tracking-normal">Save {ANNUAL_SAVINGS_PERCENT}%</span>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

export function PricingPlans() {
  const searchParams = useSearchParams();
  const [interval, setInterval] = useState<BillingInterval>('year');
  const { data: me } = useBillingMe();
  const checkout = useCheckout();

  useEffect(() => {
    if (searchParams.get('cancelled') === '1') {
      toast('Checkout cancelled — no changes were made.');
    }
  }, [searchParams]);

  const currentPlan = me?.plan;
  const premierMonthly = planMonthlyEquivalentCents(PLANS.PREMIER, interval);

  return (
    <div>
      <div className="flex justify-center">
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
        {/* Standard */}
        <div className={cn('card flex flex-col p-7', currentPlan === 'FREE' && 'ring-2 ring-[var(--color-accent)]/40')}>
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-bold uppercase tracking-widest text-[var(--color-muted)]">
              {PLANS.FREE.name}
            </p>
            {currentPlan === 'FREE' && <Badge variant="accent">Current plan</Badge>}
          </div>
          <p className="font-display mt-3 text-5xl font-bold">$0</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{PLANS.FREE.tagline}</p>
          <ul className="mt-6 flex-1 space-y-2.5 text-sm">
            {PLANS.FREE.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-ok)]" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[var(--color-muted)]">
            Paid registrations via Stripe carry a small platform fee on both plans.
          </p>
          <Button variant="secondary" size="lg" className="mt-6 w-full" asChild>
            <Link href={checkout.loggedIn ? '/dashboard' : '/register'}>
              {checkout.loggedIn ? 'Go to dashboard' : 'Get started free'}
            </Link>
          </Button>
        </div>

        {/* Premier */}
        <div
          className={cn(
            'card relative flex flex-col overflow-hidden border-[var(--color-premier)]/50 p-7',
            currentPlan === 'PREMIER' && 'ring-2 ring-[var(--color-premier)]/50',
          )}
        >
          <div className="absolute -right-16 -top-16 size-48 rounded-full bg-[var(--color-premier)]/15 blur-3xl" aria-hidden />
          <div className="relative flex items-center justify-between">
            <p className="font-display inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-[var(--color-premier)]">
              <Crown className="size-4" aria-hidden /> {PLANS.PREMIER.name}
            </p>
            {currentPlan === 'PREMIER' ? (
              <Badge variant="premier">Current plan</Badge>
            ) : (
              <Badge variant="premier">Most popular</Badge>
            )}
          </div>
          <p className="font-display relative mt-3 text-5xl font-bold">
            {formatPlanPrice(premierMonthly)}
            <span className="text-base font-semibold text-[var(--color-muted)]">/mo</span>
          </p>
          <p className="relative mt-1 text-sm text-[var(--color-muted)]">
            {interval === 'year'
              ? `${formatPlanPrice(PLANS.PREMIER.priceYearlyCents)} billed yearly`
              : 'Billed monthly · cancel anytime'}
          </p>
          <ul className="relative mt-6 flex-1 space-y-2.5 text-sm">
            {PLANS.PREMIER.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-premier)]" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          {currentPlan === 'PREMIER' ? (
            <Button variant="secondary" size="lg" className="relative mt-6 w-full" asChild>
              <Link href="/settings/billing">Manage subscription</Link>
            </Button>
          ) : (
            <Button
              variant="premier"
              size="lg"
              className="relative mt-6 w-full"
              loading={checkout.isPending}
              onClick={() => checkout.mutate(interval)}
            >
              <Sparkles /> Upgrade to Premier
            </Button>
          )}
        </div>
      </div>

      <NotConfiguredDialog open={checkout.notConfigured} onOpenChange={checkout.setNotConfigured} />
    </div>
  );
}
