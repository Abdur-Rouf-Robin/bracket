'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';

const SLIDE_DURATION_MS = 6000;

type HeroSlide = {
  id: string;
  shortLabel: string;
  title: string;
  subtitle: string;
  badge?: string;
  cta: { label: string; href: string };
  gradient: string;
};

const SLIDES: HeroSlide[] = [
  {
    id: 'brackets',
    shortLabel: 'Elimination Brackets',
    title: 'Single & double elimination',
    subtitle: 'Seed teams, run knockouts, and share match cards when results land.',
    badge: 'Knockout',
    cta: { label: 'Start a tournament', href: '/tournaments/new' },
    gradient:
      'linear-gradient(135deg, #0d1b2a 0%, #1b263b 35%, #415a77 70%, #26bbff 120%)',
  },
  {
    id: 'formats',
    shortLabel: 'Swiss & Groups',
    title: 'Swiss, round robin & groups',
    subtitle: 'Pick your format, shuffle pools by color, and auto-advance to finals.',
    badge: 'Formats',
    cta: { label: 'Explore formats', href: '/tournaments/new' },
    gradient:
      'linear-gradient(135deg, #1a0a2e 0%, #3d1f5c 40%, #7c5cff 85%, #c084fc 120%)',
  },
  {
    id: 'live',
    shortLabel: 'Live Standings',
    title: 'Live standings & announcements',
    subtitle: 'Real-time bracket updates, standings tabs, and host tools in one place.',
    badge: 'Live',
    cta: { label: 'Open dashboard', href: '/dashboard' },
    gradient:
      'linear-gradient(135deg, #0a1628 0%, #134e4a 45%, #34d399 95%, #6ee7b7 120%)',
  },
  {
    id: 'share',
    shortLabel: 'Share Results',
    title: 'Shareable match results',
    subtitle: 'Generate share cards for SE, DE, RR, and Swiss — built for streams and social.',
    badge: 'Share',
    cta: { label: 'Open dashboard', href: '/dashboard' },
    gradient:
      'linear-gradient(135deg, #1c1917 0%, #44403c 40%, #f97316 90%, #fbbf24 120%)',
  },
];

function SlideTimerFill({ progressKey }: { progressKey: number }) {
  return (
    <div
      key={progressKey}
      className="hero-progress-bar absolute inset-y-0 left-0 w-full origin-left"
      style={
        {
          '--hero-duration': `${SLIDE_DURATION_MS}ms`,
        } as CSSProperties
      }
    />
  );
}

export function HeroSlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progressKey, setProgressKey] = useState(0);
  const [ready, setReady] = useState(false);

  const active = SLIDES[activeIndex]!;

  const restartProgress = useCallback(() => {
    setProgressKey((k) => k + 1);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const nextIndex = (index + SLIDES.length) % SLIDES.length;
      setActiveIndex(nextIndex);
      restartProgress();
    },
    [restartProgress],
  );

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % SLIDES.length);
    restartProgress();
  }, [restartProgress]);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length);
    restartProgress();
  }, [restartProgress]);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(next, SLIDE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, progressKey, next, ready]);

  return (
    <section className="relative border-b border-[var(--color-line)] bg-[var(--color-paper)]">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-5 lg:flex-row lg:items-stretch lg:gap-2 lg:px-8 lg:py-6">
        {/* Main hero — larger */}
        <div className="relative min-h-[320px] flex-[1_1_82%] overflow-hidden rounded-lg lg:min-h-[560px] xl:min-h-[600px]">
          <div
            key={active.id}
            className="hero-slide-enter absolute inset-0"
            style={{ background: active.gradient }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

          <div className="relative flex h-full min-h-[320px] flex-col justify-end p-6 lg:min-h-[560px] lg:p-12 xl:min-h-[600px]">
            {active.badge && (
              <span className="mb-2 text-xs font-medium uppercase tracking-wide text-white/70">
                {active.badge}
              </span>
            )}
            <h1 className="font-display max-w-2xl text-3xl font-bold leading-tight text-white md:text-4xl lg:text-5xl xl:text-[3.25rem]">
              {active.title}
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/70 md:text-base">
              {active.subtitle}
            </p>
            <div className="mt-5">
              <Link
                href={active.cta.href}
                className="inline-flex rounded bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                {active.cta.label}
              </Link>
            </div>
          </div>
        </div>

        {/* Side rail — compact cards */}
        <div className="flex min-h-[200px] flex-[0_0_auto] flex-col lg:min-h-[560px] lg:w-[220px] xl:min-h-[600px] xl:w-[240px]">
          <div className="flex flex-1 flex-col justify-center gap-0 py-1">
            {SLIDES.map((slide, index) => {
              const isActive = index === activeIndex;

              if (isActive) {
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => goTo(index)}
                    aria-current="true"
                    className="relative w-full overflow-hidden rounded-md bg-[var(--color-hero-card)] text-left ring-1 ring-[var(--color-line)]"
                  >
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      {ready && <SlideTimerFill progressKey={progressKey} />}
                    </div>

                    <div className="relative z-10 flex min-h-[36px] items-center px-2.5 py-2 lg:min-h-[40px] lg:px-3">
                      <span className="relative z-10 text-xs font-normal leading-snug text-[var(--color-ink)] lg:text-[13px]">
                        {slide.shortLabel}
                      </span>
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goTo(index)}
                  className="w-full rounded-md px-1 py-2 text-left text-xs text-[var(--color-muted)] transition hover:text-[var(--color-ink)] lg:px-2 lg:py-2 lg:text-[13px]"
                >
                  {slide.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="mt-1 flex justify-end gap-1.5 pb-0.5">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={prev}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-line)] bg-transparent text-sm text-[var(--color-muted)] transition hover:border-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={next}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-line)] bg-transparent text-sm text-[var(--color-muted)] transition hover:border-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
