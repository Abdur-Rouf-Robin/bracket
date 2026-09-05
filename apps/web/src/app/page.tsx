'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { MiniBracket } from '@/components/marketing/mini-bracket';
import { QuickStart } from '@/components/marketing/quick-start';
import { SAMPLE_TEAMS, buildPreview } from '@/components/marketing/generate-preview';
import {
  CommunitiesEventsPromo,
  FeatureGrid,
  FinalCta,
  FormatGrid,
  HomeFaq,
  HowItWorks,
  PricingTeaser,
  SportsLinks,
  Testimonials,
  TrustBand,
} from '@/components/marketing/home-sections';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

function Hero() {
  const { user } = useAuth();
  const demo = useMemo(
    () => buildPreview('SINGLE_ELIMINATION', SAMPLE_TEAMS, { thirdPlace: false, seed: 7 }),
    [],
  );

  return (
    <section className="relative overflow-hidden border-b border-[var(--color-line)]">
      <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[60rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 40%, transparent), transparent 70%)',
        }}
        aria-hidden
      />
      <div className="container-page relative grid items-center gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <span className="badge badge-accent">
            <Sparkles className="size-3" aria-hidden /> New: auto-scheduler, communities & events
          </span>
          <h1 className="font-display mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Run any tournament.
            <br />
            <span className="gradient-text">Brackets, schedules, live results.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[var(--color-muted)]">
            Single and double elimination, round robin, Swiss, groups + knockout, leaderboards and
            racing. Generate in seconds, run it from your phone, and let everyone follow live —
            no login needed for viewers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="gaming-glow" asChild>
              <Link href={user ? '/tournaments/new' : '/register?next=/tournaments/new'}>
                Create a tournament <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/bracket-generator">
                <Play /> Try the bracket generator
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-[var(--color-muted)]">
            Free forever for up to 256 participants · No credit card
          </p>

          <div className="mt-10 hidden lg:block">
            <p className="font-display mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Live preview · 8-team single elimination
            </p>
            <MiniBracket preview={demo} compact className="border border-[var(--color-line)] bg-[var(--color-card)]/60" />
          </div>
        </div>

        <div className="float-slow lg:justify-self-end lg:w-full lg:max-w-md">
          <QuickStart />
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <MarketingShell>
      <Hero />
      <TrustBand />
      <HowItWorks />
      <FormatGrid />
      <FeatureGrid />
      <CommunitiesEventsPromo />
      <SportsLinks />
      <Testimonials />
      <PricingTeaser />
      <HomeFaq />
      <FinalCta />
    </MarketingShell>
  );
}
