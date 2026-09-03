'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TournamentSeo } from '@/components/tournament-seo';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { TournamentSectionNav } from '@/components/tournament-section-nav';
import { TournamentTabContent } from '@/components/tournament-tab-content';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';
import type { TournamentMvpRow } from '@bracket/shared';
import { formatShareDateTime, formatVenue } from '@bracket/shared';
import { buildNavItems, parseTournamentNav } from '@/lib/tournament-nav';
import { hasKnockoutPhase } from '@/lib/tournament-stats';
import { useTournamentLive } from '@/lib/use-tournament-live';
import { useState } from 'react';

export default function PublicTournamentPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const searchParams = useSearchParams();
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
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

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copyEmbed() {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    const code = `<iframe src="${origin}/t/${slug}/embed" width="100%" height="480" frameborder="0" title="${data?.name ?? 'Bracket'}"></iframe>`;
    await navigator.clipboard.writeText(code);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 1500);
  }

  return (
    <div className="min-h-screen">
      <TournamentSeo slug={slug} />
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        {isLoading && <p className="text-[var(--color-muted)]">Loading…</p>}
        {error && (
          <p className="text-red-700">
            {error instanceof Error ? error.message : 'Not found'}
          </p>
        )}
        {data && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-[var(--color-muted)]">
                  Tournament
                  {data.game?.name ? ` · ${data.game.name}` : ''}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-4xl font-bold">{data.name}</h1>
                  {(data.settings as { tentative?: boolean } | undefined)
                    ?.tentative && (
                    <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
                      Tentative schedule
                    </span>
                  )}
                </div>
                {data.description && (
                  <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
                    {data.description}
                  </p>
                )}
                {(data.startAt || formatVenue(data)) && (
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {data.startAt && (
                      <span>{formatShareDateTime(data.startAt)}</span>
                    )}
                    {data.startAt && formatVenue(data) ? ' · ' : ''}
                    {formatVenue(data) && <span>{formatVenue(data)}</span>}
                  </p>
                )}
                <p className="mt-1 text-[var(--color-muted)]">
                  {data.format?.replaceAll('_', ' ') ?? 'Draft'} · {data.status}
                  {' · '}
                  <span className="font-mono text-xs">/t/{data.slug}</span>
                  <span
                    className={`ml-2 inline-flex items-center gap-1 ${
                      connected
                        ? 'text-[var(--color-ok)]'
                        : 'text-[var(--color-muted)]'
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        connected
                          ? 'animate-pulse bg-[var(--color-ok)]'
                          : 'bg-[var(--color-muted)]'
                      }`}
                    />
                    {connected ? 'Live' : 'Offline'}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/t/${data.slug}/bracket`}>
                  <Button variant="secondary">Full bracket page</Button>
                </Link>
                {registrationOpen && (
                  <Link href={`/t/${data.slug}/register`}>
                    <Button>Register</Button>
                  </Link>
                )}
                <Button variant="secondary" type="button" onClick={copyLink}>
                  {copied ? 'Copied' : 'Share link'}
                </Button>
                <Button variant="secondary" type="button" onClick={copyEmbed}>
                  {embedCopied ? 'Embed copied' : 'Embed code'}
                </Button>
                {data.canManage && (
                  <Link href={`/t/${data.slug}?tab=matches&sub=play`}>
                    <Button>Enter results</Button>
                  </Link>
                )}
              </div>
            </div>

            <TournamentSectionNav
              basePath={basePath}
              items={navItems}
              activeTab={tab}
              activeSub={sub}
            />

            <div className="mt-6">
              <TournamentTabContent
                tournament={data}
                tab={tab}
                sub={sub}
                mode="public"
                basePath={basePath}
                mvpRows={mvpRows}
                token={token ?? undefined}
                userId={user?.id}
                onCheckInSelf={async () => {
                  if (!token) return;
                  await api(`/t/${slug}/check-in`, {
                    method: 'POST',
                    token,
                  });
                  await qc.invalidateQueries({
                    queryKey: ['tournament', slug],
                  });
                }}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
