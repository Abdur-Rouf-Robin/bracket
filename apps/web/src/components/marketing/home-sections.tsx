'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bike,
  CalendarClock,
  Check,
  ClipboardList,
  Code2,
  Download,
  Dumbbell,
  FileText,
  Gamepad2,
  Goal,
  LayoutGrid,
  ListOrdered,
  MonitorPlay,
  Palette,
  QrCode,
  Radio,
  Star,
  Swords,
  Trophy,
  Users,
  Vote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLANS } from '@/lib/plans';
import { FORMAT_LINKS } from '@/components/site-header';
import { SectionHeading } from './marketing-shell';
import { Faq } from './faq';

export const FORMAT_CARDS: { href: string; title: string; blurb: string; icon: typeof Trophy; math: string }[] = [
  { href: '/formats/single-elimination', title: 'Single elimination', blurb: 'Lose once and you are out. The classic knockout tree.', icon: Trophy, math: 'n − 1 matches' },
  { href: '/formats/double-elimination', title: 'Double elimination', blurb: 'Winners and losers brackets. Everyone gets a second chance.', icon: Swords, math: '2n − 2 matches' },
  { href: '/formats/round-robin', title: 'Round robin', blurb: 'Everyone plays everyone. Ranked by points and tiebreakers.', icon: ListOrdered, math: 'n(n − 1) / 2 matches' },
  { href: '/formats/swiss', title: 'Swiss system', blurb: 'Pair similar records each round. Big fields, few rounds.', icon: LayoutGrid, math: 'log₂(n) rounds' },
  { href: '/formats/groups-knockout', title: 'Groups + knockout', blurb: 'World-Cup style: group stage, then a bracket for advancers.', icon: Goal, math: 'groups + KO tree' },
  { href: '/formats/free-for-all', title: 'Free for all', blurb: 'Placement-based events — battle royale, party games, heats.', icon: Gamepad2, math: 'placement points' },
  { href: '/formats/leaderboard', title: 'Leaderboard', blurb: 'Multiple scoring events feeding a cumulative table.', icon: BarChart3, math: 'events × points' },
  { href: '/formats/racing', title: 'Racing', blurb: 'Time trials, single races and multi-race Grand Prix series.', icon: Bike, math: 'time or F1 points' },
];

const FEATURES = [
  { icon: Radio, title: 'Live standings', body: 'Scores, brackets and tables update for every viewer in real time — no refresh needed.' },
  { icon: CalendarClock, title: 'Auto-scheduler', body: 'Generate match times across venues and referees, respecting availability and rest gaps.' },
  { icon: MonitorPlay, title: 'Stations & station queue', body: 'Assign matches to tables, courts or PCs and show the up-next queue on any screen.' },
  { icon: ClipboardList, title: 'Check-in & sign-up pages', body: 'Public registration with custom fields, waivers, waitlists and day-of check-in.' },
  { icon: Users, title: 'Communities & Elo rankings', body: 'Run a club or league with roles, followers, announcements and cross-tournament ratings.' },
  { icon: Trophy, title: 'Events & tickets', body: 'Bundle tournaments into an event, sell tickets and check attendees in with QR codes.' },
  { icon: QrCode, title: 'Embeds, QR & TV mode', body: 'Embed brackets anywhere, print QR posters, and run an auto-rotating TV display.' },
  { icon: Vote, title: 'Predictions & voting', body: 'Let fans predict brackets and vote on matches with leaderboards for the sharpest picks.' },
  { icon: Star, title: 'Player stats & MVP', body: 'Track goals, kills, assists or runs per player and crown MVPs automatically.' },
  { icon: Download, title: 'CSV / PDF export', body: 'Export participants, schedules, results and standings for spreadsheets or print.' },
  { icon: Code2, title: 'API & webhooks', body: 'Build on a REST API with keys and webhooks for results, registrations and more.' },
  { icon: Palette, title: 'Custom branding', body: 'Your colours, logo and sponsors on public pages and embeds.' },
];

const SPORTS: { label: string; href: string; icon: typeof Trophy }[] = [
  { label: 'Football', href: '/sports/football', icon: Goal },
  { label: 'Cricket', href: '/sports/cricket', icon: Dumbbell },
  { label: 'Padel & tennis', href: '/search?q=padel', icon: Swords },
  { label: 'Esports', href: '/search?q=esports', icon: Gamepad2 },
  { label: 'Basketball', href: '/search?q=basketball', icon: Trophy },
  { label: 'Table tennis', href: '/search?q=table%20tennis', icon: LayoutGrid },
  { label: 'Chess', href: '/search?q=chess', icon: ListOrdered },
  { label: 'Racing', href: '/formats/racing', icon: Bike },
];

const TESTIMONIALS = [
  {
    quote: 'We moved our 96-team futsal league off spreadsheets in a weekend. Parents follow live standings on their phones and stopped messaging me for results.',
    name: 'Maya R.',
    role: 'League coordinator, community futsal',
  },
  {
    quote: 'The station queue saved the day. Sixteen setups, 200 players, and nobody asked "where do I play next?" all day.',
    name: 'Devon K.',
    role: 'Tournament organizer, fighting games',
  },
  {
    quote: 'Groups into knockout with best-thirds, ET and penalties handled correctly. It is the first tool that gets football rules right.',
    name: 'Tomás A.',
    role: 'Club secretary, amateur football',
  },
];

const HOME_FAQ = [
  { q: 'How are byes handled?', a: 'When the number of participants is not a power of two, top seeds receive byes in the first round automatically. Byes are shown in the bracket and advance the seeded participant without a match.' },
  { q: 'Can I add a third-place match?', a: 'Yes. Enable "third place / placement matches" in tournament settings for single or double elimination, and the bracket adds a consolation final between the semi-final losers. You can also run placement ladders for 5th–8th and beyond.' },
  { q: 'Do viewers need an account?', a: 'No. Public tournament pages, brackets, schedules and standings are viewable by anyone with the link — no login required. Only organizers and participants who register need accounts.' },
  { q: 'Can I embed a bracket on my website?', a: 'Every public tournament has an embed URL you can drop into an iframe. Pick light, dark or a custom theme to match your site.' },
  { q: 'Does it work on mobile?', a: 'Yes. Everything — including score entry, check-in and the station queue — is designed mobile-first so you can run the whole event from your phone.' },
  { q: 'Can participants be teams with rosters?', a: 'Yes. Participants can be individuals or teams with players, captains and substitutes. Player-level stats and MVP awards are available for team sports.' },
  { q: 'Can I keep a tournament private?', a: 'You can hide a tournament from browse and search engines, restrict it to a password, or keep it fully private to organizers until you are ready to publish.' },
  { q: 'What does it cost?', a: `Nothing. Every format, game catalog, scheduler, export, embed theme and cricket scoreboard is free forever — up to ${PLANS.FREE.limits.maxParticipants} participants per tournament, unlimited events.` },
];

export function TrustBand() {
  const items = [
    { value: '10', label: 'formats supported' },
    { value: '0', label: 'logins needed for viewers' },
    { value: 'Live', label: 'updates on every device' },
    { value: '$0', label: 'to start' },
  ];
  return (
    <section aria-label="Highlights" className="border-y border-[var(--color-line)] bg-[var(--color-surface)]/40">
      <div className="container-page grid grid-cols-2 divide-[var(--color-line)] py-6 md:grid-cols-4 md:divide-x">
        {items.map((i) => (
          <div key={i.label} className="px-4 py-2 text-center">
            <p className="font-display text-2xl font-bold text-[var(--color-accent)] md:text-3xl">{i.value}</p>
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{i.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    { n: '1', title: 'Add participants & pick a format', body: 'Paste names, import a CSV, or open public sign-ups. Choose any format — we suggest one based on your field size.' },
    { n: '2', title: 'Generate the bracket or schedule', body: 'Seed, shuffle, draw groups live, and auto-schedule across venues, stations and referees in one click.' },
    { n: '3', title: 'Enter scores live from your phone', body: 'Results flow to brackets, standings, stats and embeds instantly. Share cards, QR posters and TV mode included.' },
  ];
  return (
    <section className="container-page py-20">
      <SectionHeading eyebrow="How it works" title="From names to final in three steps" />
      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="card card-hover relative p-6">
            <span className="font-display inline-flex size-10 items-center justify-center rounded-xl bg-[var(--color-accent)] text-lg font-bold text-[var(--color-accent-fg)]">
              {s.n}
            </span>
            <h3 className="font-display mt-4 text-lg font-bold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FormatGrid() {
  return (
    <section className="border-t border-[var(--color-line)] bg-[var(--color-surface)]/30 py-20">
      <div className="container-page">
        <SectionHeading eyebrow="Formats" title="Every format, done right" description="Brackets are generated by a tested engine with correct seeding, byes, tiebreakers and placement rules." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FORMAT_CARDS.map((f) => (
            <Link key={f.href} href={f.href} className="card card-hover group flex flex-col p-5">
              <f.icon className="size-6 text-[var(--color-accent)]" aria-hidden />
              <h3 className="font-display mt-4 text-base font-bold group-hover:text-[var(--color-accent)]">{f.title}</h3>
              <p className="mt-1.5 flex-1 text-sm text-[var(--color-muted)]">{f.blurb}</p>
              <p className="mt-4 font-mono text-[11px] text-[var(--color-muted)]">{f.math}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid() {
  return (
    <section className="container-page py-20">
      <SectionHeading eyebrow="Everything included" title="Feature-rich without the clutter" description="The power of a pro tournament suite, wrapped in an interface that a first-time organizer can run in minutes." />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/12 text-[var(--color-accent)]">
                <f.icon className="size-4" aria-hidden />
              </span>
              <h3 className="font-display text-sm font-bold">{f.title}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{f.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Button variant="outline" asChild>
          <Link href="/features">Compare all features <ArrowRight /></Link>
        </Button>
      </div>
    </section>
  );
}

export function CommunitiesEventsPromo() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-surface)]/30 py-20">
      <div className="container-page grid gap-6 lg:grid-cols-2">
        <div className="gaming-card relative overflow-hidden rounded-2xl p-8">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-[var(--color-accent)]/15 blur-3xl" aria-hidden />
          <Users className="size-7 text-[var(--color-accent)]" aria-hidden />
          <h3 className="font-display mt-4 text-2xl font-bold">Communities</h3>
          <p className="mt-2 max-w-md text-[var(--color-muted)]">
            One home for your club or league: members with roles, followers, announcements, templates, and Elo rankings that carry across every tournament you run.
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            {['Owner, admin, collaborator & affiliate roles', 'Elo rankings with configurable K-factors', 'Reusable tournament templates'].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check className="size-4 text-[var(--color-ok)]" aria-hidden />{t}</li>
            ))}
          </ul>
          <Button className="mt-6" variant="secondary" asChild>
            <Link href="/communities">Explore communities <ArrowRight /></Link>
          </Button>
        </div>
        <div className="gaming-card relative overflow-hidden rounded-2xl p-8">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-[var(--color-accent-glow)]/20 blur-3xl" aria-hidden />
          <CalendarClock className="size-7 text-[var(--color-accent-glow)]" aria-hidden />
          <h3 className="font-display mt-4 text-2xl font-bold">Events</h3>
          <p className="mt-2 max-w-md text-[var(--color-muted)]">
            Group several tournaments under one event page with venue details, streams, a shared schedule and ticket sales with QR check-in.
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            {['Multiple tournaments, one landing page', 'Tickets, orders and door check-in', 'Stream links and venue maps'].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check className="size-4 text-[var(--color-ok)]" aria-hidden />{t}</li>
            ))}
          </ul>
          <Button className="mt-6" variant="secondary" asChild>
            <Link href="/events">Browse events <ArrowRight /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function SportsLinks() {
  return (
    <section className="container-page py-16">
      <SectionHeading eyebrow="Built for your sport" title="Presets for the games you play" description="Sport-aware scoring: goals and cards, overs and wickets, sets and games, kills and placements." />
      <div className="mt-10 flex flex-wrap justify-center gap-2">
        {SPORTS.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]"
          >
            <s.icon className="size-4" aria-hidden />
            {s.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section className="border-t border-[var(--color-line)] bg-[var(--color-surface)]/30 py-20">
      <div className="container-page">
        <SectionHeading eyebrow="Organizers" title="Run by people who run events" />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="card flex flex-col p-6">
              <div className="flex gap-0.5 text-[var(--color-warning)]" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-4 fill-current" aria-hidden />)}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed">“{t.quote}”</blockquote>
              <figcaption className="mt-5 text-xs text-[var(--color-muted)]">
                <span className="font-semibold text-[var(--color-ink)]">{t.name}</span> · {t.role}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-[var(--color-muted)]">Example quotes for illustration.</p>
      </div>
    </section>
  );
}

export function PricingTeaser() {
  return (
    <section className="container-page py-20">
      <SectionHeading eyebrow="Pricing" title="Everything is free. Forever." />
      <div className="mx-auto mt-12 max-w-xl">
        <div className="card p-6">
          <p className="font-display text-sm font-bold uppercase tracking-widest text-[var(--color-muted)]">{PLANS.FREE.name}</p>
          <p className="font-display mt-2 text-4xl font-bold">$0</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{PLANS.FREE.tagline}</p>
          <ul className="mt-5 space-y-2 text-sm">
            {PLANS.FREE.features.slice(0, 6).map((f) => (
              <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[var(--color-ok)]" aria-hidden />{f}</li>
            ))}
          </ul>
          <Button variant="primary" className="mt-6 w-full" asChild>
            <Link href="/register">Get started free</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function HomeFaq() {
  return (
    <section className="border-t border-[var(--color-line)] bg-[var(--color-surface)]/30 py-20">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_2fr]">
        <div>
          <SectionHeading align="left" eyebrow="FAQ" title="Questions, answered" description="Still curious? The help center covers every feature in depth." />
          <Button variant="outline" className="mt-6" asChild>
            <Link href="/help"><FileText /> Open help center</Link>
          </Button>
        </div>
        <Faq items={HOME_FAQ} />
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="container-page py-20">
      <div className="gaming-card gaming-glow relative overflow-hidden rounded-3xl px-6 py-14 text-center md:px-12">
        <div className="hero-grid absolute inset-0" aria-hidden />
        <div className="relative">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Ready to run your next event?</h2>
          <p className="mx-auto mt-3 max-w-lg text-[var(--color-muted)]">
            Create a tournament, add participants and publish a live bracket in under five minutes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/tournaments/new">Create a tournament</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/bracket-generator">Try the bracket generator</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-[var(--color-muted)]">
            Formats: {FORMAT_LINKS.map((f) => f.label).join(' · ')}
          </p>
        </div>
      </div>
    </section>
  );
}
