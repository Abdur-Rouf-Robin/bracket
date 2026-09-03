'use client';

import dynamic from 'next/dynamic';

const HeroSlider = dynamic(
  () => import('@/components/hero-slider').then((m) => m.HeroSlider),
  {
    ssr: false,
    loading: () => (
      <section className="border-b border-[var(--color-line)] bg-[var(--color-paper)]">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-5 lg:flex-row lg:items-stretch lg:gap-2 lg:px-8 lg:py-6">
          <div className="min-h-[320px] flex-[1_1_82%] animate-pulse rounded-lg bg-[var(--color-card)] lg:min-h-[560px] xl:min-h-[600px]" />
          <div className="hidden flex-col gap-0.5 lg:flex lg:w-[220px] xl:w-[240px]">
            <div className="animate-pulse rounded-md bg-[var(--color-surface-hover)] px-3 py-2.5">
              <div className="h-2.5 w-2/3 rounded bg-[var(--color-line)]" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-7 animate-pulse rounded bg-[var(--color-card)] px-2" />
            ))}
          </div>
        </div>
      </section>
    ),
  },
);

export function HeroSliderShell() {
  return <HeroSlider />;
}
