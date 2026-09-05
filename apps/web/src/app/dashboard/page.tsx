'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  Clock,
  Radio,
  Trophy,
  Users2,
  UsersRound,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PremierUpsell } from '@/components/dashboard/premier-upsell';
import {
  ActivityPanel,
  CommunitiesPanel,
  EventsPanel,
  TemplatesPanel,
} from '@/components/dashboard/side-panels';
import { TournamentList, bucketOf } from '@/components/dashboard/tournament-list';
import { VerifyEmailBanner } from '@/components/dashboard/verify-email-banner';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/ui/stat-card';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';
import type { Community, PlatformEvent } from '@/lib/types-platform';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === 'object' && Array.isArray((res as { items?: unknown }).items)) {
    return (res as { items: T[] }).items;
  }
  return [];
}

const QUICK_ACTIONS = [
  { href: '/tournaments/new', label: 'New tournament', icon: Trophy, primary: true },
  { href: '/communities/new', label: 'New community', icon: Users2 },
  { href: '/events/new', label: 'New event', icon: CalendarPlus },
  { href: '/bracket-generator', label: 'Quick bracket', icon: Wand2 },
];

export default function DashboardPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [slugLookup, setSlugLookup] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/dashboard');
  }, [loading, user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['my-tournaments'],
    enabled: !!token,
    queryFn: () => api<Tournament[]>('/tournaments/mine', { token }),
  });

  const communities = useQuery({
    queryKey: ['communities', 'mine'],
    enabled: !!token,
    retry: false,
    queryFn: async () => unwrapList<Community>(await api<unknown>('/communities/mine', { token })),
  });
  const events = useQuery({
    queryKey: ['events', 'mine'],
    enabled: !!token,
    retry: false,
    queryFn: async () => unwrapList<PlatformEvent>(await api<unknown>('/events/mine', { token })),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/tournaments/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-tournaments'] });
      toast.success('Tournament deleted');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not delete tournament'),
  });

  const stats = useMemo(() => {
    const s = { total: 0, live: 0, upcoming: 0, completed: 0 };
    for (const t of data ?? []) {
      s.total++;
      const b = bucketOf(t);
      if (b === 'ACTIVE') s.live++;
      else if (b === 'COMPLETED') s.completed++;
      else s.upcoming++;
    }
    return s;
  }, [data]);

  function openBySlug(e: FormEvent) {
    e.preventDefault();
    const raw = slugLookup.trim();
    if (!raw) return;
    const slug = raw.replace(/^https?:\/\/[^/]+\/t\//, '').split(/[/?#]/)[0] ?? raw;
    router.push(`/t/${slug}`);
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="container-page flex-1 py-10">
          <div className="skeleton h-10 w-64" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
          <p className="sr-only">{loading ? 'Loading…' : 'Redirecting to sign in…'}</p>
        </main>
      </div>
    );
  }

  const isPremier = user.plan === 'PREMIER';
  const firstName = user.name?.split(' ')[0] || user.name;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="container-page flex-1 space-y-8 py-8 md:py-10">
        <VerifyEmailBanner />

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} src={user.avatarUrl} size="xl" className="hidden sm:inline-flex" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  {greeting()}, {firstName}
                </h1>
                {isPremier ? (
                  <Badge variant="premier">Premier</Badge>
                ) : (
                  <Badge variant="neutral">Standard</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {stats.live > 0
                  ? `${stats.live} tournament${stats.live === 1 ? ' is' : 's are'} live right now.`
                  : stats.total > 0
                    ? 'Everything is quiet. Ready for the next one?'
                    : 'Welcome to Bracket — let’s set up your first tournament.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Button key={a.href} variant={a.primary ? 'primary' : 'outline'} size="sm" asChild>
                <Link href={a.href}>
                  <a.icon /> {a.label}
                </Link>
              </Button>
            ))}
          </div>
        </header>

        <section aria-label="Overview" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard label="Tournaments" value={stats.total} icon={Trophy} loading={isLoading} />
          <StatCard label="Live" value={stats.live} icon={Radio} tone={stats.live ? 'ok' : 'default'} loading={isLoading} />
          <StatCard label="Upcoming" value={stats.upcoming} icon={Clock} tone="accent" loading={isLoading} hint="Drafts & registration" />
          <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} loading={isLoading} />
          <StatCard
            label="Communities"
            value={communities.isError ? '—' : communities.data?.length ?? 0}
            icon={UsersRound}
            loading={communities.isLoading}
          />
          <StatCard
            label="Events"
            value={events.isError ? '—' : events.data?.length ?? 0}
            icon={CalendarRange}
            loading={events.isLoading}
          />
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-8">
            <TournamentList
              tournaments={data}
              loading={isLoading}
              deleting={deleteMutation.isPending}
              onDelete={(id) => deleteMutation.mutateAsync(id)}
            />

            <form onSubmit={openBySlug} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-sm font-semibold">Open a public tournament</p>
                <p className="text-xs text-[var(--color-muted)]">Paste a link or slug to jump straight to it.</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={slugLookup}
                  onChange={(e) => setSlugLookup(e.target.value)}
                  placeholder="bracket.app/t/summer-cup"
                  aria-label="Tournament link or slug"
                  className="h-9 sm:w-64"
                />
                <Button type="submit" variant="secondary" size="sm">
                  Open <ArrowRight />
                </Button>
              </div>
            </form>
          </div>

          <aside className="space-y-4">
            {!isPremier && <PremierUpsell />}
            <ActivityPanel token={token} />
            <CommunitiesPanel token={token} />
            <EventsPanel token={token} />
            <TemplatesPanel token={token} />
            <div className="card p-4 text-xs text-[var(--color-muted)]">
              <p className="font-semibold text-[var(--color-ink)]">Need a hand?</p>
              <p className="mt-1">Read the guides or reach out — Premier gets priority replies.</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="ghost" asChild><Link href="/help">Help center</Link></Button>
                <Button size="sm" variant="ghost" asChild><Link href="/contact">Contact</Link></Button>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
