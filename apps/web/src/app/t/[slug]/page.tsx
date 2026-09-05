'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TournamentSeo } from '@/components/tournament-seo';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { TournamentHero } from '@/components/tournament-hero';
import { TournamentPasswordGate } from '@/components/tournament-password-gate';
import { tournamentBrandStyle } from '@/components/sharing/brand-style';
import { TournamentSectionNav } from '@/components/tournament-section-nav';
import { TournamentTabContent } from '@/components/tournament-tab-content';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';
import type { TournamentMvpRow } from '@bracket/shared';
import { buildNavItems, parseTournamentNav } from '@/lib/tournament-nav';
import { hasKnockoutPhase } from '@/lib/tournament-stats';
import { useTournamentLive } from '@/lib/use-tournament-live';
import { SearchX } from 'lucide-react';
import Link from 'next/link';

export default function PublicTournamentPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const searchParams = useSearchParams();
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const basePath = `/t/${slug}`;

  const { data, isLoading, error } = useQuery({
    queryKey: ['tournament', slug, token ?? 'anon'],
    queryFn: () =>
      api<Tournament>(`/t/${slug}`, { token: token ?? undefined }),
  });

  const { tab, sub } = parseTournamentNav(searchParams, 'public', {
    canManage: !!data?.canManage,
  });

  const { data: mvpRows = [] } = useQuery({
    queryKey: ['tournament-mvp', slug],
    enabled: !!data,
    queryFn: () => api<TournamentMvpRow[]>(`/t/${slug}/mvp`),
  });

  const { connected } = useTournamentLive(data?.id, slug);

  const settings = data?.settings as
    | {
        registrationMode?: string;
        enableMvp?: boolean;
        showStandings?: boolean;
      }
    | undefined;
  const openSignup = settings?.registrationMode === 'OPEN_SIGNUP';
  const registrationOpen =
    openSignup &&
    data?.status !== 'COMPLETED' &&
    (data?.matches?.length ?? 0) === 0;

  const navItems = data
    ? buildNavItems({
        mode: 'public',
        hasKnockout: hasKnockoutPhase(data),
        showMvp: settings?.enableMvp !== false,
        showStandings: settings?.showStandings !== false,
        isOwner: !!data.isOwner,
        canManage: !!data.canManage,
      })
    : [];

  const checkInSelf = async () => {
    if (!token) return;
    await api(`/t/${slug}/check-in`, {
      method: 'POST',
      token,
    });
    await qc.invalidateQueries({
      queryKey: ['tournament', slug],
    });
  };

  // Viewer owns a participant entry that hasn't checked in yet.
  const canCheckIn =
    !!user &&
    !!data &&
    data.status !== 'COMPLETED' &&
    (data.teams ?? []).some(
      (t) => t.registeredByUserId === user.id && !t.checkedIn && !t.withdrawn,
    );

  return (
    <div className="flex min-h-screen flex-col" style={tournamentBrandStyle(data)}>
      <TournamentSeo slug={slug} />
      <SiteHeader />
      <main className="container-page flex-1 py-6 md:py-8">
        {isLoading && (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
        {error && (
          <EmptyState
            icon={SearchX}
            title="Tournament not found"
            description={error instanceof Error ? error.message : 'This tournament may be private or was removed.'}
            action={
              <Button variant="secondary" asChild>
                <Link href="/browse">Browse tournaments</Link>
              </Button>
            }
          />
        )}
        {data && (
          <TournamentPasswordGate tournament={data}>
            <TournamentHero
              tournament={data}
              mode="public"
              connected={connected}
              registrationOpen={registrationOpen}
              canCheckIn={canCheckIn}
              onCheckIn={checkInSelf}
              actions={
                data.canManage ? (
                  <Button size="sm" asChild>
                    <Link href={`/t/${data.slug}?tab=matches&sub=play`}>Enter results</Link>
                  </Button>
                ) : undefined
              }
            />

            <TournamentSectionNav
              basePath={basePath}
              items={navItems}
              activeTab={tab}
              activeSub={sub}
            />

            <div className="mt-6 min-w-0">
              <TournamentTabContent
                tournament={data}
                tab={tab}
                sub={sub}
                mode="public"
                basePath={basePath}
                mvpRows={mvpRows}
                token={token ?? undefined}
                userId={user?.id}
                onCheckInSelf={checkInSelf}
              />
            </div>
          </TournamentPasswordGate>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
