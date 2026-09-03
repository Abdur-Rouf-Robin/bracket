'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { ShareMatchCard } from '@/components/share-match-card';
import { ShareImagesModal } from '@/components/share-images/share-image-cards';
import { TournamentSectionNav } from '@/components/tournament-section-nav';
import { TournamentTabContent } from '@/components/tournament-tab-content';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';
import { useTournamentLive } from '@/lib/use-tournament-live';
import { buildNavItems, parseTournamentNav } from '@/lib/tournament-nav';
import { hasKnockoutPhase } from '@/lib/tournament-stats';
import {
  type AnySharePayload,
  type ShareCardPayload,
  type TournamentMvpRow,
} from '@bracket/shared';

export default function ManageTournamentPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const searchParams = useSearchParams();
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [eventKey, setEventKey] = useState('');
  const [eventValues, setEventValues] = useState<Record<string, string>>({});
  const [sharePayload, setSharePayload] = useState<ShareCardPayload | null>(null);
  const [shareImage, setShareImage] = useState<{
    payload: AnySharePayload;
    title: string;
  } | null>(null);

  const { tab, sub } = parseTournamentNav(searchParams, 'manage', {
    canManage: true,
  });
  const basePath = `/t/${slug}/manage`;

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['tournament', slug],
    enabled: !!token,
    queryFn: () => api<Tournament>(`/t/${slug}`, { token }),
  });

  const { data: mvpRows = [] } = useQuery({
    queryKey: ['tournament-mvp', slug],
    enabled: !!data,
    queryFn: () => api<TournamentMvpRow[]>(`/t/${slug}/mvp`),
  });

  useTournamentLive(data?.id, slug);

  useEffect(() => {
    if (data && user && !data.canManage) {
      router.replace(`/t/${slug}`);
    }
  }, [data, user, router, slug]);

  const eventMutation = useMutation({
    mutationFn: async () => {
      if (!token || !data || !eventKey) return;
      const rows =
        data.eventResults?.filter((r) => r.eventKey === eventKey) ?? [];
      return api(`/tournaments/${data.id}/events/results`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          eventKey,
          results: rows.map((r, i) => ({
            teamId: r.teamId,
            value: Number(eventValues[r.teamId] ?? r.value ?? i + 1),
            position:
              data.format === 'SINGLE_RACE' || data.format === 'GRAND_PRIX'
                ? Number(eventValues[r.teamId] ?? i + 1)
                : undefined,
          })),
        }),
      });
    },
    onSuccess: async () => {
      setError('');
      await qc.invalidateQueries({ queryKey: ['tournament', slug] });
    },
    onError: (err: Error) => setError(err.message),
  });

  useEffect(() => {
    if (!data?.eventResults?.length) return;
    const first = data.eventResults[0].eventKey;
    if (!eventKey) setEventKey(first);
    const key = eventKey || first;
    const next: Record<string, string> = {};
    for (const r of data.eventResults.filter((x) => x.eventKey === key)) {
      next[r.teamId] =
        r.status === 'COMPLETED'
          ? String(
              data.format === 'TIME_TRIAL' || data.format === 'LEADERBOARD'
                ? r.value
                : (r.position ?? r.value),
            )
          : '';
    }
    setEventValues(next);
  }, [data, eventKey]);

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!token || !data) return;
      return api(`/tournaments/${data.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tournament', slug] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!token || !data) return;
      return api(`/tournaments/${data.id}/reset`, {
        method: 'POST',
        token,
      });
    },
    onSuccess: () => router.push('/tournaments/new'),
  });

  async function copyLink() {
    await navigator.clipboard.writeText(
      `${window.location.origin}/t/${slug}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const settings = data?.settings as
    | { enableMvp?: boolean; showStandings?: boolean }
    | undefined;

  const navItems = data
    ? buildNavItems({
        mode: 'manage',
        hasKnockout: hasKnockoutPhase(data),
        showMvp: settings?.enableMvp !== false,
        showStandings: settings?.showStandings !== false,
        isOwner: !!data.isOwner,
        canManage: !!data.canManage,
      })
    : [];

  if (loading || !user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <p className="p-8 text-[var(--color-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        {isLoading && <p className="text-[var(--color-muted)]">Loading…</p>}
        {data && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-3xl font-bold">
                    Manage · {data.name}
                  </h1>
                  {(data.settings as { tentative?: boolean } | undefined)
                    ?.tentative && (
                    <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
                      Tentative
                    </span>
                  )}
                </div>
                <p className="text-[var(--color-muted)]">
                  {data.format?.replaceAll('_', ' ')} · {data.status}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" type="button" onClick={copyLink}>
                  {copied ? 'Copied' : 'Share'}
                </Button>
                <Link href={`/t/${data.slug}/bracket`}>
                  <Button variant="secondary">Bracket view</Button>
                </Link>
                <Link href={`/t/${data.slug}`}>
                  <Button variant="secondary">Public view</Button>
                </Link>
                {data.isOwner && data.status !== 'COMPLETED' && (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => completeMutation.mutate()}
                  >
                    Mark completed
                  </Button>
                )}
                {data.isOwner && (
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          'Reset bracket? All matches and standings will be cleared.',
                        )
                      ) {
                        resetMutation.mutate();
                      }
                    }}
                  >
                    Reset
                  </Button>
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
                mode="manage"
                basePath={basePath}
                mvpRows={mvpRows}
                token={token ?? undefined}
                manage={
                  token
                    ? {
                        token,
                        slug,
                        eventKey,
                        setEventKey,
                        eventValues,
                        setEventValues,
                        onSaveEvent: () => eventMutation.mutate(),
                        eventPending: eventMutation.isPending,
                        onSharePrematch: async (matchId) => {
                          const payload = await api<AnySharePayload>(
                            `/tournaments/${data.id}/matches/${matchId}/share/prematch`,
                          );
                          setShareImage({
                            payload,
                            title: 'Pre-match image',
                          });
                        },
                        onShareResult: async (matchId) => {
                          const payload = await api<AnySharePayload>(
                            `/tournaments/${data.id}/matches/${matchId}/share/result-full`,
                          );
                          setShareImage({
                            payload,
                            title: 'Result image',
                          });
                        },
                        onShareCard: async (matchId) => {
                          const card = await api<ShareCardPayload>(
                            `/tournaments/${data.id}/matches/${matchId}/share-card`,
                            { token },
                          );
                          setSharePayload(card);
                        },
                      }
                    : undefined
                }
              />
            </div>

            {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

            {sharePayload && (
              <ShareMatchCard
                payload={sharePayload}
                onClose={() => setSharePayload(null)}
              />
            )}
            {shareImage && (
              <ShareImagesModal
                payload={shareImage.payload}
                title={shareImage.title}
                onClose={() => setShareImage(null)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
