'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import type { BillingMeResponse, CheckoutResponse } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PLAN_LIST, formatPlanPrice } from '@/lib/plans';

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

export function PricingPlans() {
  const { user, token } = useAuth();
  const checkout = useMutation({
    mutationFn: (interval: 'month' | 'year') =>
      api<CheckoutResponse>('/billing/checkout', {
        method: 'POST',
        token,
        body: JSON.stringify({ interval }),
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

  return (
    <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
      {PLAN_LIST.map((plan) => (
        <div key={plan.id} className="card flex flex-col p-7">
          <p className="font-display text-sm font-bold uppercase tracking-widest text-[var(--color-muted)]">
            {plan.name}
          </p>
          <p className="font-display mt-3 text-5xl font-bold">
            {formatPlanPrice(plan.priceMonthlyCents)}
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {plan.priceMonthlyCents === 0
              ? plan.tagline
              : `${plan.tagline} ${formatPlanPrice(plan.priceYearlyCents)} billed yearly.`}
          </p>
          <ul className="mt-6 flex-1 space-y-2.5 text-sm">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-ok)]" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          {plan.id === 'FREE' ? (
            <Button variant="secondary" size="lg" className="mt-6 w-full" asChild>
              <Link href={user ? '/dashboard' : '/register'}>
                {user ? 'Go to dashboard' : 'Get started free'}
              </Link>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              className="mt-6 w-full"
              disabled={!token || checkout.isPending}
              onClick={() => checkout.mutate('month')}
            >
              {token ? 'Upgrade to Premier' : 'Sign in to upgrade'}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
