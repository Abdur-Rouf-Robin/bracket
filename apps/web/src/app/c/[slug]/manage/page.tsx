'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ExternalLink,
  FileText,
  Gamepad2,
  Settings,
  Trophy,
  Users,
} from 'lucide-react';
import { communityRoleAtLeast } from '@bracket/shared';
import { ManageCommunityGames } from '@/components/community/manage/manage-games';
import { ManageCommunityMembers } from '@/components/community/manage/manage-members';
import { ManageCommunityRankings } from '@/components/community/manage/manage-rankings';
import { ManageCommunitySettings } from '@/components/community/manage/manage-settings';
import { ManageCommunityTemplates } from '@/components/community/manage/manage-templates';
import type { CommunityPagePayload } from '@/components/community/types';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Community } from '@/lib/types-platform';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'settings', label: 'Settings', icon: Settings, minRole: 'ADMIN' as const },
  { id: 'members', label: 'Members', icon: Users, minRole: 'ADMIN' as const },
  { id: 'rankings', label: 'Rankings', icon: Trophy, minRole: 'ADMIN' as const },
  { id: 'templates', label: 'Templates', icon: FileText, minRole: 'COLLABORATOR' as const },
  { id: 'games', label: 'Games', icon: Gamepad2, minRole: 'ADMIN' as const },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function isSection(v: string | null): v is SectionId {
  return !!v && SECTIONS.some((s) => s.id === v);
}

export default function ManageCommunityPage() {
  return (
    <Suspense fallback={null}>
      <ManageCommunityPageInner />
    </Suspense>
  );
}

function ManageCommunityPageInner() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, token, loading } = useAuth();

  const sectionParam = searchParams.get('section');
  const section: SectionId = isSection(sectionParam) ? sectionParam : 'settings';

  const setSection = useCallback(
    (next: string) => {
      router.replace(`/c/${slug}/manage${next === 'settings' ? '' : `?section=${next}`}`);
    },
    [router, slug],
  );

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=/c/${slug}/manage`);
  }, [loading, user, router, slug]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['community', slug, token ?? 'anon'],
    enabled: !!token,
    retry: false,
    queryFn: () => api<CommunityPagePayload>(`/c/${slug}`, { token }),
  });

  const canEnter = communityRoleAtLeast(data?.viewerRole ?? null, 'COLLABORATOR');
  const canAdmin = communityRoleAtLeast(data?.viewerRole ?? null, 'ADMIN');
  const visibleSections = SECTIONS.filter((s) =>
    communityRoleAtLeast(data?.viewerRole ?? null, s.minRole),
  );

  useEffect(() => {
    if (data && !canEnter) router.replace(`/c/${slug}`);
  }, [data, canEnter, router, slug]);

  function onCommunitySaved(next: Community) {
    void qc.invalidateQueries({ queryKey: ['community', slug] });
    if (next.slug !== slug) {
      router.replace(`/c/${next.slug}/manage`);
    }
  }

  if (loading || (!!token && isLoading)) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-6 py-10">
          <div className="h-8 w-64 animate-pulse rounded bg-[var(--color-surface)]" />
          <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="panel-card h-96 animate-pulse rounded-2xl" />
            <div className="panel-card h-96 animate-pulse rounded-2xl" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">
            {error instanceof ApiError && error.status === 404
              ? 'Community not found'
              : 'Could not load community'}
          </h1>
          <Link href="/communities" className="mt-6 inline-block">
            <Button variant="secondary">Back to communities</Button>
          </Link>
        </main>
      </div>
    );
  }

  if (!canEnter) return null;

  const activeSection = visibleSections.some((s) => s.id === section)
    ? section
    : (visibleSections[0]?.id ?? 'templates');
  const current = SECTIONS.find((s) => s.id === activeSection)!;
  const community = data.community;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]">
              {community.logoUrl ? (
                <img src={community.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-xl font-black text-[var(--color-accent)]">
                  {community.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                Community dashboard
              </p>
              <h1 className="text-2xl font-bold text-[var(--color-ink)]">{community.name}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/events/new?community=${community.id}`}>
              <Button variant="secondary">New event</Button>
            </Link>
            <Link href={`/tournaments/new?community=${community.id}`}>
              <Button variant="secondary">New tournament</Button>
            </Link>
            <Link href={`/c/${community.slug}`}>
              <Button variant="secondary" className="gap-2">
                View page <ExternalLink className="size-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav className="lg:sticky lg:top-24 lg:self-start">
            <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {visibleSections.map((s) => {
                const Icon = s.icon;
                const active = s.id === activeSection;
                return (
                  <li key={s.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setSection(s.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm transition',
                        active
                          ? 'bg-[color-mix(in_srgb,var(--color-accent)_16%,var(--color-surface))] font-semibold text-[var(--color-ink)]'
                          : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]',
                      )}
                    >
                      <Icon className={cn('size-4', active && 'text-[var(--color-accent)]')} />
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <section className="min-w-0">
            <div className="mb-5 flex items-center gap-2">
              <current.icon className="size-5 text-[var(--color-accent)]" />
              <h2 className="text-xl font-semibold text-[var(--color-ink)]">{current.label}</h2>
            </div>

            {activeSection === 'settings' && canAdmin && (
              <>
                <ManageCommunitySettings
                  key={`${community.id}-${community.updatedAt}`}
                  community={community}
                  onSaved={onCommunitySaved}
                />
                {community.ownerId === user?.id && (
                  <DangerZone community={community} />
                )}
              </>
            )}
            {activeSection === 'members' && canAdmin && (
              <ManageCommunityMembers community={community} />
            )}
            {activeSection === 'rankings' && canAdmin && (
              <ManageCommunityRankings community={community} games={data.games} />
            )}
            {activeSection === 'templates' && (
              <ManageCommunityTemplates community={community} />
            )}
            {activeSection === 'games' && canAdmin && (
              <ManageCommunityGames community={community} selected={data.games} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function DangerZone({ community }: { community: Community }) {
  const { token } = useAuth();
  const router = useRouter();
  const [typed, setTyped] = useState('');
  const remove = useMutation({
    mutationFn: () => api(`/communities/${community.id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Community deleted');
      router.push('/communities');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not delete'),
  });

  return (
    <section className="mt-10 rounded-2xl border border-[var(--color-danger)]/30 p-5">
      <h3 className="font-display text-lg font-bold text-[var(--color-danger)]">Delete community</h3>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        This cannot be undone. Tournaments stay, but they will no longer belong to this community.
        Type <span className="font-mono text-[var(--color-ink)]">{community.slug}</span> to confirm.
      </p>
      <div className="mt-4 max-w-sm">
        <Label htmlFor="delete-slug">Confirm slug</Label>
        <Input
          id="delete-slug"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={community.slug}
        />
      </div>
      <Button
        type="button"
        className="mt-4"
        variant="secondary"
        disabled={typed !== community.slug || remove.isPending}
        onClick={() => remove.mutate()}
      >
        {remove.isPending ? 'Deleting…' : 'Delete community'}
      </Button>
    </section>
  );
}
