'use client';

import dynamic from 'next/dynamic';

export type { CoinSide, CoinTossResult, TossDecision } from '@/components/cricket-coin-toss';

export const CricketCoinToss = dynamic(
  () =>
    import('@/components/cricket-coin-toss').then((m) => ({
      default: m.CricketCoinToss,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]/40 p-6 text-center text-sm text-[var(--color-muted)]">
        Loading coin toss…
      </div>
    ),
  },
);
