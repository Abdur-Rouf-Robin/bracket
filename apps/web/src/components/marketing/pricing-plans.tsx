'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import type { BillingMeResponse } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PLANS } from '@/lib/plans';

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
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-xl">
      <div className="card flex flex-col p-7">
        <p className="font-display text-sm font-bold uppercase tracking-widest text-[var(--color-muted)]">
          {PLANS.FREE.name}
        </p>
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
          Optional Stripe is only for your own entry fees and event tickets. We never charge
          you a platform subscription.
        </p>
        <Button variant="primary" size="lg" className="mt-6 w-full" asChild>
          <Link href={user ? '/dashboard' : '/register'}>
            {user ? 'Go to dashboard' : 'Get started free'}
          </Link>
        </Button>
      </div>
    </div>
  );
}
