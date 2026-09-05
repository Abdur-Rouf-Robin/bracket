'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Gamepad2, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';
import { communityRoleAtLeast } from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { CommunityHeader } from '@/components/community/community-header';
import {
  AnnouncementForm,
  AnnouncementList,
} from '@/components/community/announcement-list';
import { RankingTable } from '@/components/community/ranking-table';
import { RoleBadge } from '@/components/community/role-badge';
import { TemplateCard } from '@/components/community/template-card';
import {
  formatDate,
  formatDateTime,
  initialsOf,
  type CommunityPagePayload,
  type CommunityTournamentCard,
} from '@/components/community/types';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { CommunityAnnouncement, CommunityMember, RankingEntry } from '@/lib/types-platform';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'events', label: 'Events' },
  { key: 'rankings', label: 'Rankings' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'people', label: 'People' },
  { key: 'templates', label: 'Templates', minRole: 'AFFILIATE' as const },
];

type TabKey = (typeof TABS)[number]['key'];

export default function CommunityPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['community', slug, token ?? 'anon'],
    queryFn: () => api<CommunityPagePayload>(`/c/${slug}`, { token: token ?? undefined }),
    retry: false,
  });

  const viewerRole = data?.viewerRole ?? null;
  const visibleTabs = TABS.filter(
    (t) => !('minRole' in t && t.minRole) || communityRoleAtLeast(viewerRole, t.minRole),
  );
  const requested = searchParams.get('tab') ?? 'overview';
  const tab: TabKey = visibleTabs.some((t) => t.key === requested) ? (requested as TabKey) : 'overview';

  function setTab(next: TabKey) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next === 'overview') sp.delete('tab');
    else sp.set('tab', next);
    const qs = sp.toString();
    router.replace(`/c/${slug}${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-6 py-10">
          <div className="gaming-card animate-pulse overflow-hidden rounded-2xl">
            <div className="aspect-[1920/820] max-h-[360px] bg-[var(--color-surface)]" />
            <div className="space-y-3 px-8 pb-6 pt-4">
              <div className="h-8 w-1/3 rounded bg-[var(--color-surface)]" />
              <div className="h-4 w-1/4 rounded bg-[var(--color-surface)]" />
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="panel-card h-40 animate-pulse rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="font-display text-3xl font-bold">
            {status === 403 ? 'This community is private' : 'Community not found'}
          </h1>
          <p className="mt-2 text-[var(--color-muted)]">
            {status === 403
              ? 'Only members can view it. Ask an admin to add you.'
              : 'The link may be wrong or the community was removed.'}
          </p>
          <Link href="/communities" className="mt-6 inline-block">
            <Button variant="secondary">Browse communities</Button>
          </Link>
        </main>
      </div>
    );
  }

  const { community } = data;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <CommunityHeader
          community={community}
          viewerRole={viewerRole}
          isFollowing={data.isFollowing}
          followers={data._count.followers}
        />

        <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--color-line)]">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition',
                tab === t.key
                  ? 'border-[var(--color-accent)] text-[var(--color-ink)]'
                  : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]',
              )}
            >
              {t.label}
              {t.key === 'tournaments' && (
                <span className="ml-1.5 text-xs text-[var(--color-muted)]">
                  {data._count.tournaments}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {tab === 'overview' && <OverviewTab data={data} onTab={setTab} />}
          {tab === 'tournaments' && <TournamentsTab data={data} />}
          {tab === 'events' && <EventsTab data={data} />}
          {tab === 'rankings' && <RankingsTab data={data} />}
          {tab === 'announcements' && <AnnouncementsTab data={data} slug={slug} />}
          {tab === 'people' && <PeopleTab data={data} />}
          {tab === 'templates' && <TemplatesTab data={data} />}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold">{children}</h2>
      {action}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-muted)]">
      {children}
    </p>
  );
}

function statusLabel(status: string) {
  return status === 'ACTIVE' ? 'In progress' : status === 'COMPLETED' ? 'Completed' : 'Upcoming';
}

function TournamentCard({ t }: { t: CommunityTournamentCard }) {
  return (
    <Link
      href={`/t/${t.slug}`}
      className="panel-card flex items-center gap-4 rounded-xl px-4 py-3 transition hover:border-[var(--color-accent)]/40"
    >
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-surface)]">
        {t.logoUrl ? (
          <img src={t.logoUrl} alt="" className="size-full object-cover" />
        ) : (
          <Trophy className="size-5 text-[var(--color-muted)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base font-bold">{t.name}</p>
        <p className="truncate text-xs text-[var(--color-muted)]">
          {t.game?.name ? `${t.game.name} · ` : ''}
          {t.format?.replaceAll('_', ' ') ?? 'Format TBD'} · {t._count?.teams ?? 0} teams
        </p>
      </div>
      <div className="shrink-0 text-right text-xs text-[var(--color-muted)]">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 font-semibold',
            t.status === 'ACTIVE' && 'bg-[var(--color-ok)]/15 text-[var(--color-ok)]',
            t.status === 'COMPLETED' && 'bg-[var(--color-surface)]',
            t.status === 'DRAFT' && 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
          )}
        >
          {statusLabel(t.status)}
        </span>
        <p className="mt-1">{t.startAt ? formatDate(t.startAt) : ''}</p>
      </div>
    </Link>
  );
}

function OverviewTab({
  data,
  onTab,
}: {
  data: CommunityPagePayload;
  onTab: (t: TabKey) => void;
}) {
  const pinned = data.announcements.filter((a) => a.pinned);
  const live = [...data.tournaments.inProgress, ...data.tournaments.upcoming].slice(0, 6);
  const topRanking = data.rankings[0];
  const { data: topEntries } = useQuery({
    queryKey: ['ranking-top', topRanking?.id],
    enabled: !!topRanking,
    queryFn: () =>
      api<{ entries: RankingEntry[] }>(`/rankings/${topRanking!.id}?pageSize=5`).then(
        (r) => r.entries,
      ),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-8">
        {data.community.description && (
          <section>
            <SectionTitle>About</SectionTitle>
            <p className="whitespace-pre-wrap text-sm text-[var(--color-ink)]/90">
              {data.community.description}
            </p>
          </section>
        )}
        {pinned.length > 0 && (
          <section>
            <SectionTitle
              action={
                <Button variant="ghost" className="text-xs" onClick={() => onTab('announcements')}>
                  All announcements
                </Button>
              }
            >
              Pinned
            </SectionTitle>
            <AnnouncementList announcements={pinned} compact />
          </section>
        )}
        <section>
          <SectionTitle
            action={
              <Button variant="ghost" className="text-xs" onClick={() => onTab('tournaments')}>
                View all
              </Button>
            }
          >
            Upcoming & in progress
          </SectionTitle>
          {live.length === 0 ? (
            <EmptyState>No upcoming tournaments right now.</EmptyState>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {live.map((t) => (
                <TournamentCard key={t.id} t={t} />
              ))}
            </div>
          )}
        </section>
      </div>
      <aside className="space-y-6">
        <section className="panel-card rounded-xl p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat icon={Users} label="Followers" value={data._count.followers} />
            <Stat icon={Trophy} label="Tournaments" value={data._count.tournaments} />
            <Stat icon={CalendarDays} label="Events" value={data._count.events} />
          </div>
        </section>
        {data.games.length > 0 && (
          <section className="panel-card rounded-xl p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Gamepad2 className="size-4 text-[var(--color-muted)]" /> Games
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {data.games.map((g) => (
                <span
                  key={g.id}
                  className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-0.5 text-xs"
                >
                  {g.name}
                </span>
              ))}
            </div>
          </section>
        )}
        {topRanking && (
          <section className="panel-card rounded-xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{topRanking.name}</h3>
              <Link
                href={`/c/${data.community.slug}/rankings/${topRanking.id}`}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Full leaderboard
              </Link>
            </div>
            {topEntries && topEntries.length > 0 ? (
              <ol className="space-y-1.5">
                {topEntries.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 font-mono text-xs text-[var(--color-muted)]">{e.rank}</span>
                    <span className="flex-1 truncate">{e.user?.name ?? e.displayName}</span>
                    <span className="font-mono text-xs font-bold">{Math.round(e.rating)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-[var(--color-muted)]">No rated players yet.</p>
            )}
          </section>
        )}
        <section className="panel-card rounded-xl p-4">
          <h3 className="mb-2 text-sm font-semibold">Owner</h3>
          <PersonRow user={data.owner} role="OWNER" />
        </section>
      </aside>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div>
      <Icon className="mx-auto size-4 text-[var(--color-muted)]" />
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
    </div>
  );
}

function PersonRow({
  user,
  role,
}: {
  user: { id: string; name: string; username?: string | null; avatarUrl?: string | null };
  role?: CommunityMember['role'];
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface)] text-xs font-bold">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          initialsOf(user.name)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        {user.username && (
          <p className="truncate text-xs text-[var(--color-muted)]">@{user.username}</p>
        )}
      </div>
      {role && <RoleBadge role={role} />}
    </div>
  );
}

function TournamentsTab({ data }: { data: CommunityPagePayload }) {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'inProgress' | 'completed'>('all');
  const list =
    filter === 'all'
      ? [...data.tournaments.inProgress, ...data.tournaments.upcoming, ...data.tournaments.completed]
      : data.tournaments[filter];
  const canCreate = communityRoleAtLeast(data.viewerRole, 'AFFILIATE');
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'All'],
              ['upcoming', `Upcoming (${data.tournaments.upcoming.length})`],
              ['inProgress', `In progress (${data.tournaments.inProgress.length})`],
              ['completed', `Completed (${data.tournaments.completed.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={cn('choice-btn rounded-full px-3 py-1.5 text-sm', filter === key && 'choice-btn-active')}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {canCreate && (
          <Link href={`/tournaments/new?community=${data.community.id}`}>
            <Button variant="secondary">Create tournament</Button>
          </Link>
        )}
      </div>
      {list.length === 0 ? (
        <EmptyState>No tournaments here yet.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((t) => (
            <TournamentCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventsTab({ data }: { data: CommunityPagePayload }) {
  if (data.events.length === 0) {
    return <EmptyState>No upcoming events.</EmptyState>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.events.map((e) => (
        <Link
          key={e.id}
          href={`/e/${e.slug}`}
          className="gaming-card overflow-hidden rounded-xl transition hover:border-[var(--color-accent)]/40"
        >
          <div
            className="h-28 bg-cover bg-center"
            style={{
              backgroundImage: e.bannerUrl
                ? `url(${e.bannerUrl})`
                : 'linear-gradient(135deg, rgba(77,212,255,0.2), rgba(124,92,255,0.2))',
            }}
          />
          <div className="p-4">
            <p className="font-display text-base font-bold">{e.name}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {e.startAt ? formatDateTime(e.startAt) : 'Date TBD'}
              {e.venueName ? ` · ${e.venueName}` : e.venueType ? ` · ${e.venueType}` : ''}
            </p>
            {e.description && (
              <p className="mt-2 line-clamp-2 text-sm text-[var(--color-muted)]">{e.description}</p>
            )}
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              {e._count?.tournaments ?? 0} tournaments
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function RankingsTab({ data }: { data: CommunityPagePayload }) {
  if (data.rankings.length === 0) {
    return (
      <EmptyState>
        No active rankings.
        {communityRoleAtLeast(data.viewerRole, 'ADMIN') && (
          <>
            {' '}
            <Link href={`/c/${data.community.slug}/manage?section=rankings`} className="text-[var(--color-accent)] underline">
              Create one
            </Link>
            .
          </>
        )}
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.rankings.map((r) => (
        <Link
          key={r.id}
          href={`/c/${data.community.slug}/rankings/${r.id}`}
          className="panel-card rounded-xl p-4 transition hover:border-[var(--color-accent)]/40"
        >
          <p className="font-display text-base font-bold">{r.name}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {r.game?.name ? `${r.game.name} · ` : ''}
            {r._count.entries} rated · {r._count.tournaments} tournaments
            {r.startAt || r.endAt
              ? ` · ${r.startAt ? formatDate(r.startAt) : '…'} – ${r.endAt ? formatDate(r.endAt) : 'ongoing'}`
              : ''}
          </p>
          {r.description && (
            <p className="mt-2 line-clamp-2 text-sm text-[var(--color-muted)]">{r.description}</p>
          )}
        </Link>
      ))}
    </div>
  );
}

function AnnouncementsTab({ data, slug }: { data: CommunityPagePayload; slug: string }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const canPost = communityRoleAtLeast(data.viewerRole, 'COLLABORATOR');
  const { data: all = data.announcements, isLoading } = useQuery({
    queryKey: ['community-announcements', data.community.id],
    queryFn: () =>
      api<CommunityAnnouncement[]>(`/communities/${data.community.id}/announcements`, {
        token: token ?? undefined,
      }),
    initialData: data.announcements,
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['community-announcements', data.community.id] });
    void qc.invalidateQueries({ queryKey: ['community', slug] });
  }

  const post = useMutation({
    mutationFn: (input: { title: string; body: string; pinned: boolean }) =>
      api<CommunityAnnouncement>(`/communities/${data.community.id}/announcements`, {
        method: 'POST',
        token,
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      toast.success('Announcement posted — followers have been notified');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to post'),
  });

  const togglePin = useMutation({
    mutationFn: (a: CommunityAnnouncement) =>
      api(`/communities/${data.community.id}/announcements/${a.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ pinned: !a.pinned }),
      }),
    onSuccess: refresh,
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (a: CommunityAnnouncement) =>
      api(`/communities/${data.community.id}/announcements/${a.id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Announcement deleted');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="panel-card h-24 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <AnnouncementList
            announcements={all}
            canManage={canPost}
            onTogglePin={(a) => togglePin.mutate(a)}
            onDelete={(a) => {
              if (confirm(`Delete "${a.title}"?`)) remove.mutate(a);
            }}
          />
        )}
      </div>
      {canPost && (
        <div>
          <h3 className="mb-2 font-display text-base font-bold">Post an announcement</h3>
          <AnnouncementForm onSubmit={(i) => post.mutateAsync(i).then(() => undefined)} pending={post.isPending} />
        </div>
      )}
    </div>
  );
}

function PeopleTab({ data }: { data: CommunityPagePayload }) {
  const { token } = useAuth();
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['community-members', data.community.id, token ?? 'anon'],
    queryFn: () =>
      api<CommunityMember[]>(`/communities/${data.community.id}/members`, {
        token: token ?? undefined,
      }),
  });
  const groups: { role: CommunityMember['role']; label: string }[] = [
    { role: 'OWNER', label: 'Owner' },
    { role: 'ADMIN', label: 'Admins' },
    { role: 'COLLABORATOR', label: 'Collaborators' },
    { role: 'AFFILIATE', label: 'Affiliates' },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {isLoading ? (
          <div className="panel-card h-40 animate-pulse rounded-xl" />
        ) : (
          groups.map((g) => {
            const list = members.filter((m) => m.role === g.role);
            if (list.length === 0) return null;
            return (
              <section key={g.role}>
                <SectionTitle>{g.label}</SectionTitle>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map((m) => (
                    <div key={m.id} className="panel-card rounded-xl px-3 py-2.5">
                      <PersonRow user={m.user} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
      <aside className="panel-card h-fit rounded-xl p-4">
        <p className="font-display text-3xl font-bold">{data._count.followers}</p>
        <p className="text-sm text-[var(--color-muted)]">followers</p>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Followers get notified about announcements and new tournaments.
        </p>
      </aside>
    </div>
  );
}

function TemplatesTab({ data }: { data: CommunityPagePayload }) {
  if (data.templates.length === 0) {
    return (
      <EmptyState>
        No templates yet.
        {communityRoleAtLeast(data.viewerRole, 'COLLABORATOR') && (
          <>
            {' '}
            <Link href={`/c/${data.community.slug}/manage?section=templates`} className="text-[var(--color-accent)] underline">
              Create one from an existing tournament
            </Link>
            .
          </>
        )}
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.templates.map((t) => (
        <TemplateCard key={t.id} template={t} communityId={data.community.id} />
      ))}
    </div>
  );
}
