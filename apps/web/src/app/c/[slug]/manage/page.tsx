'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  COMMUNITY_AUDIENCE_OPTIONS,
  COMMUNITY_BANNER_SPEC,
  COMMUNITY_ROLE_DESCRIPTIONS,
  COMMUNITY_SOCIAL_KEYS,
  COMMUNITY_SOCIAL_LABELS,
  COUNTRY_OPTIONS,
  RANKING_DEFAULTS,
  RANKING_K_FACTOR_HELP,
  communityRoleAtLeast,
  slugifyCommunityName,
} from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ImageUrlField } from '@/components/image-url-field';
import {
  AnnouncementForm,
  AnnouncementList,
} from '@/components/community/announcement-list';
import { MemberTable } from '@/components/community/member-table';
import { RankingSettingsEditor } from '@/components/community/ranking-settings-editor';
import { TemplateCard } from '@/components/community/template-card';
import {
  formatDate,
  type CommunityPagePayload,
  type CommunityTemplate,
  type CommunityTournamentCard,
  type Game,
} from '@/components/community/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Tournament } from '@/lib/types';
import type {
  Community,
  CommunityAnnouncement,
  CommunityMember,
  CommunityRole,
  Ranking,
} from '@/lib/types-platform';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { key: 'general', label: 'General' },
  { key: 'branding', label: 'Branding' },
  { key: 'games', label: 'Games' },
  { key: 'members', label: 'Members' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'templates', label: 'Templates' },
  { key: 'rankings', label: 'Rankings' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'danger', label: 'Danger zone' },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

export default function ManageCommunityPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, loading } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=/c/${slug}/manage`);
  }, [loading, user, router, slug]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['community', slug, token ?? 'anon'],
    enabled: !!token,
    queryFn: () => api<CommunityPagePayload>(`/c/${slug}`, { token }),
    retry: false,
  });

  const isAdmin = communityRoleAtLeast(data?.viewerRole ?? null, 'ADMIN');
  const isOwner = data?.viewerRole === 'OWNER';

  useEffect(() => {
    if (data && !isAdmin) {
      toast.error('You need admin access to manage this community');
      router.replace(`/c/${slug}`);
    }
  }, [data, isAdmin, router, slug]);

  const requested = searchParams.get('section') ?? 'general';
  const section: SectionKey = SECTIONS.some((s) => s.key === requested)
    ? (requested as SectionKey)
    : 'general';
  function setSection(next: SectionKey) {
    router.replace(`/c/${slug}/manage${next === 'general' ? '' : `?section=${next}`}`, {
      scroll: false,
    });
  }

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['community', slug] });
    void qc.invalidateQueries({ queryKey: ['communities-mine'] });
  }

  if (loading || !user || isLoading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-6 py-10">
          <div className="h-8 w-64 animate-pulse rounded bg-[var(--color-surface)]" />
          <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
            <div className="panel-card h-80 animate-pulse rounded-xl" />
            <div className="panel-card h-80 animate-pulse rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="font-display text-2xl font-bold">Could not load community</h1>
          <p className="mt-2 text-[var(--color-muted)]">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </main>
      </div>
    );
  }

  if (!isAdmin) return null;

  const community = data.community;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Link href={`/c/${slug}`} className="text-sm text-[var(--color-muted)] hover:underline">
          ← Back to {community.name}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Manage community</h1>

        <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition',
                  section === s.key
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]',
                  s.key === 'danger' && section !== s.key && 'text-[var(--color-danger)]/80',
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0">
            {section === 'general' && <GeneralSection community={community} onSaved={refresh} />}
            {section === 'branding' && <BrandingSection community={community} onSaved={refresh} />}
            {section === 'games' && <GamesSection community={community} onSaved={refresh} />}
            {section === 'members' && (
              <MembersSection community={community} isOwner={isOwner} onChanged={refresh} />
            )}
            {section === 'announcements' && <AnnouncementsSection community={community} onChanged={refresh} />}
            {section === 'templates' && <TemplatesSection community={community} onChanged={refresh} />}
            {section === 'rankings' && <RankingsSection community={community} onChanged={refresh} />}
            {section === 'tournaments' && <TournamentsSection community={community} onChanged={refresh} />}
            {section === 'danger' && <DangerSection community={community} isOwner={isOwner} />}
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel-card rounded-2xl p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function useCommunityPatch(communityId: string, onSaved: () => void) {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Community>(`/communities/${communityId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Saved');
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Save failed'),
  });
}

function GeneralSection({ community, onSaved }: { community: Community; onSaved: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: community.name,
    slug: community.slug,
    description: community.description ?? '',
    audience: community.audience ?? [],
    location: community.location ?? '',
    countryCode: community.countryCode ?? '',
    socials: { ...(community.socials ?? {}) } as Record<string, string>,
    isPublic: community.isPublic,
  });
  const patch = useCommunityPatch(community.id, onSaved);
  const countryOptions = useMemo(
    () => COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.name })),
    [],
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const socials = Object.fromEntries(
          Object.entries(form.socials).filter(([, v]) => v && v.trim()),
        );
        patch.mutate(
          {
            name: form.name.trim(),
            slug: form.slug.trim(),
            description: form.description.trim() || null,
            audience: form.audience,
            location: form.location.trim() || null,
            countryCode: form.countryCode || null,
            socials,
            websiteUrl: socials.website ? normalizeUrl(socials.website) : null,
            isPublic: form.isPublic,
          },
          {
            onSuccess: (c) => {
              if (c.slug !== community.slug) router.replace(`/c/${c.slug}/manage`);
            },
          },
        );
      }}
    >
      <Card title="General" description="Name, URL, description and who the community is for.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="g-name">Name</Label>
            <Input
              id="g-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="g-slug">URL slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-muted)]">/c/</span>
              <Input
                id="g-slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugifyCommunityName(e.target.value) }))}
                required
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="g-desc">Description</Label>
            <textarea
              id="g-desc"
              className="field-textarea min-h-[120px]"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Who is it for?</Label>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_AUDIENCE_OPTIONS.map((opt) => {
                const active = form.audience.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    className={cn('choice-btn rounded-full px-3 py-1.5 text-sm', active && 'choice-btn-active')}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        audience: active ? f.audience.filter((x) => x !== opt) : [...f.audience, opt],
                      }))
                    }
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label htmlFor="g-loc">City / region</Label>
            <Input
              id="g-loc"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </div>
          <div>
            <Label>Country</Label>
            <Select
              value={form.countryCode}
              onChange={(v) => setForm((f) => ({ ...f, countryCode: v }))}
              placeholder="Select country"
              options={countryOptions}
            />
          </div>
        </div>
      </Card>

      <Card title="Links" description="Social profiles shown on the community page.">
        <div className="grid gap-4 sm:grid-cols-2">
          {COMMUNITY_SOCIAL_KEYS.map((key) => (
            <div key={key}>
              <Label htmlFor={`g-social-${key}`}>{COMMUNITY_SOCIAL_LABELS[key]}</Label>
              <Input
                id={`g-social-${key}`}
                value={form.socials[key] ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, socials: { ...f.socials, [key]: e.target.value } }))
                }
                placeholder="https://…"
              />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Visibility">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--color-accent)]"
            checked={form.isPublic}
            onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
          />
          <span>
            <span className="font-medium">Public community</span>
            <span className="mt-0.5 block text-[var(--color-muted)]">
              Listed in discovery and visible to everyone. When off, only members can view it.
            </span>
          </span>
        </label>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={patch.isPending || !form.name.trim()}>
          {patch.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

function BrandingSection({ community, onSaved }: { community: Community; onSaved: () => void }) {
  const { token } = useAuth();
  const [logoUrl, setLogoUrl] = useState(community.logoUrl ?? '');
  const [bannerUrl, setBannerUrl] = useState(community.bannerUrl ?? '');
  const patch = useCommunityPatch(community.id, onSaved);
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        patch.mutate({ logoUrl: logoUrl.trim() || null, bannerUrl: bannerUrl.trim() || null });
      }}
    >
      <Card title="Branding" description="Logo and banner shown at the top of your community page.">
        <div className="space-y-5">
          <ImageUrlField
            label="Logo"
            hint="Square image, at least 256×256."
            value={logoUrl}
            onChange={setLogoUrl}
            token={token ?? undefined}
          />
          <ImageUrlField
            label="Banner"
            hint={`Wide image, ${COMMUNITY_BANNER_SPEC.width}×${COMMUNITY_BANNER_SPEC.height} recommended.`}
            value={bannerUrl}
            onChange={setBannerUrl}
            token={token ?? undefined}
          />
          {bannerUrl && (
            <div
              className="aspect-[1920/820] w-full rounded-xl bg-cover bg-center"
              style={{ backgroundImage: `url(${bannerUrl})` }}
            />
          )}
        </div>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={patch.isPending}>
          {patch.isPending ? 'Saving…' : 'Save branding'}
        </Button>
      </div>
    </form>
  );
}

function GamesSection({ community, onSaved }: { community: Community; onSaved: () => void }) {
  const { token } = useAuth();
  const [selected, setSelected] = useState<string[]>((community.games ?? []).map((g) => g.id));
  const [filter, setFilter] = useState('');
  const { data: games = [], isLoading } = useQuery({
    queryKey: ['games'],
    queryFn: () => api<Game[]>('/games'),
  });
  const save = useMutation({
    mutationFn: () =>
      api(`/communities/${community.id}/games`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ gameIds: selected }),
      }),
    onSuccess: () => {
      toast.success('Games updated');
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Save failed'),
  });
  const grouped = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const g of games) {
      if (filter && !g.name.toLowerCase().includes(filter.toLowerCase())) continue;
      const list = map.get(g.category) ?? [];
      list.push(g);
      map.set(g.category, list);
    }
    return [...map.entries()];
  }, [games, filter]);

  return (
    <Card title="Games" description="Games and sports your community runs. Used for discovery filters.">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter games"
        className="mb-4 sm:w-72"
      />
      {isLoading ? (
        <div className="h-32 animate-pulse rounded bg-[var(--color-surface)]" />
      ) : (
        <div className="space-y-4">
          {grouped.map(([category, list]) => (
            <div key={category}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                {category}
              </p>
              <div className="flex flex-wrap gap-2">
                {list.map((g) => {
                  const active = selected.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className={cn('choice-btn rounded-full px-3 py-1.5 text-sm', active && 'choice-btn-active')}
                      onClick={() =>
                        setSelected((s) => (active ? s.filter((x) => x !== g.id) : [...s, g.id]))
                      }
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-[var(--color-muted)]">{selected.length} selected</p>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save games'}
        </Button>
      </div>
    </Card>
  );
}

function MembersSection({
  community,
  isOwner,
  onChanged,
}: {
  community: Community;
  isOwner: boolean;
  onChanged: () => void;
}) {
  const { token, user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<CommunityRole, 'OWNER'>>('AFFILIATE');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['community-members', community.id, token ?? 'anon'],
    queryFn: () => api<CommunityMember[]>(`/communities/${community.id}/members`, { token }),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['community-members', community.id] });
    onChanged();
  }

  const invite = useMutation({
    mutationFn: () =>
      api<CommunityMember>(`/communities/${community.id}/members`, {
        method: 'POST',
        token,
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      }),
    onSuccess: (m) => {
      toast.success(`${m.user.name} added as ${role.toLowerCase()}`);
      setEmail('');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not add member'),
  });

  const changeRole = useMutation({
    mutationFn: ({ m, next }: { m: CommunityMember; next: Exclude<CommunityRole, 'OWNER'> }) =>
      api(`/communities/${community.id}/members/${m.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ role: next }),
      }),
    onMutate: ({ m }) => setPendingId(m.id),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      toast.success('Role updated');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (m: CommunityMember) =>
      api(`/communities/${community.id}/members/${m.id}`, { method: 'DELETE', token }),
    onMutate: (m) => setPendingId(m.id),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      toast.success('Member removed');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  const transfer = useMutation({
    mutationFn: (m: CommunityMember) =>
      api(`/communities/${community.id}/transfer-ownership`, {
        method: 'POST',
        token,
        body: JSON.stringify({ userId: m.user.id }),
      }),
    onSuccess: () => {
      toast.success('Ownership transferred');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  return (
    <div className="space-y-6">
      <Card title="Invite a member" description="They must already have an account with this email.">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) invite.mutate();
          }}
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            className="flex-1"
            required
          />
          <select
            className="field-select sm:w-44"
            value={role}
            onChange={(e) => setRole(e.target.value as Exclude<CommunityRole, 'OWNER'>)}
          >
            <option value="ADMIN">Admin</option>
            <option value="COLLABORATOR">Collaborator</option>
            <option value="AFFILIATE">Affiliate</option>
          </select>
          <Button type="submit" disabled={invite.isPending || !email.trim()}>
            {invite.isPending ? 'Adding…' : 'Add member'}
          </Button>
        </form>
        <dl className="mt-4 grid gap-2 text-xs text-[var(--color-muted)] sm:grid-cols-2">
          {(['ADMIN', 'COLLABORATOR', 'AFFILIATE'] as const).map((r) => (
            <div key={r}>
              <dt className="font-semibold text-[var(--color-ink)]">{r.charAt(0) + r.slice(1).toLowerCase()}</dt>
              <dd>{COMMUNITY_ROLE_DESCRIPTIONS[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title={`Members (${members.length})`}>
        {isLoading ? (
          <div className="h-40 animate-pulse rounded bg-[var(--color-surface)]" />
        ) : (
          <MemberTable
            members={members}
            canManage
            isOwner={isOwner}
            currentUserId={user?.id}
            pendingId={pendingId}
            onChangeRole={(m, next) => changeRole.mutate({ m, next })}
            onRemove={(m) => {
              if (confirm(`Remove ${m.user.name} from the community?`)) remove.mutate(m);
            }}
            onTransfer={(m) => {
              if (
                confirm(
                  `Transfer ownership to ${m.user.name}? You will become an admin and cannot undo this yourself.`,
                )
              ) {
                transfer.mutate(m);
              }
            }}
          />
        )}
      </Card>
    </div>
  );
}

function AnnouncementsSection({
  community,
  onChanged,
}: {
  community: Community;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CommunityAnnouncement | null>(null);
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['community-announcements', community.id],
    queryFn: () => api<CommunityAnnouncement[]>(`/communities/${community.id}/announcements`, { token }),
  });
  function refresh() {
    void qc.invalidateQueries({ queryKey: ['community-announcements', community.id] });
    onChanged();
  }
  const post = useMutation({
    mutationFn: (input: { title: string; body: string; pinned: boolean }) =>
      api(`/communities/${community.id}/announcements`, {
        method: 'POST',
        token,
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      toast.success('Announcement posted — followers and members notified');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<{ title: string; body: string; pinned: boolean }> }) =>
      api(`/communities/${community.id}/announcements/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      toast.success('Announcement updated');
      setEditing(null);
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });
  const remove = useMutation({
    mutationFn: (a: CommunityAnnouncement) =>
      api(`/communities/${community.id}/announcements/${a.id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Deleted');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  return (
    <div className="space-y-6">
      <Card
        title={editing ? 'Edit announcement' : 'New announcement'}
        description="Every follower and member receives an in-app notification; followers also get an email."
      >
        {editing ? (
          <div className="space-y-2">
            <AnnouncementForm
              key={editing.id}
              initial={editing}
              submitLabel="Save changes"
              pending={update.isPending}
              onSubmit={(input) => update.mutateAsync({ id: editing.id, input }).then(() => undefined)}
            />
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel editing
            </Button>
          </div>
        ) : (
          <AnnouncementForm onSubmit={(i) => post.mutateAsync(i).then(() => undefined)} pending={post.isPending} />
        )}
      </Card>
      <Card title={`All announcements (${list.length})`}>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded bg-[var(--color-surface)]" />
        ) : (
          <div className="space-y-3">
            <AnnouncementList
              announcements={list}
              canManage
              onTogglePin={(a) => update.mutate({ id: a.id, input: { pinned: !a.pinned } })}
              onDelete={(a) => {
                if (confirm(`Delete "${a.title}"?`)) remove.mutate(a);
              }}
            />
            {list.length > 0 && (
              <p className="text-xs text-[var(--color-muted)]">
                To edit an announcement, pick it here:{' '}
                {list.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="mr-2 underline hover:text-[var(--color-ink)]"
                    onClick={() => setEditing(a)}
                  >
                    {a.title}
                  </button>
                ))}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function TemplatesSection({ community, onChanged }: { community: Community; onChanged: () => void }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [sourceId, setSourceId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<CommunityTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', token],
    queryFn: () => api<CommunityTemplate[]>('/templates', { token }),
    select: (rows) => rows.filter((t) => t.communityId === community.id),
  });
  const { data: mine = [] } = useQuery({
    queryKey: ['my-tournaments'],
    queryFn: () => api<Tournament[]>('/tournaments/mine', { token }),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['templates'] });
    onChanged();
  }

  const createFrom = useMutation({
    mutationFn: () =>
      api<CommunityTemplate>(`/templates/from-tournament/${sourceId}`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          communityId: community.id,
        }),
      }),
    onSuccess: () => {
      toast.success('Template created');
      setName('');
      setDescription('');
      setSourceId('');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  const update = useMutation({
    mutationFn: (t: CommunityTemplate) =>
      api(`/templates/${t.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ name: t.name, description: t.description ?? null }),
      }),
    onSuccess: () => {
      toast.success('Template updated');
      setEditing(null);
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (t: CommunityTemplate) => api(`/templates/${t.id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Template deleted');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  const tournamentOptions = mine.map((t) => ({
    value: t.id,
    label: `${t.name}${t.game?.name ? ` · ${t.game.name}` : ''}`,
  }));

  return (
    <div className="space-y-6">
      <Card
        title="Create a template from a tournament"
        description="Copies format, rules, scoring and branding so affiliates can spin up new tournaments in one click."
      >
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (sourceId && name.trim()) createFrom.mutate();
          }}
        >
          <div className="sm:col-span-2">
            <Label>Source tournament</Label>
            <Select
              value={sourceId}
              onChange={(v) => {
                setSourceId(v);
                const t = mine.find((x) => x.id === v);
                if (t && !name) setName(`${t.name} template`);
              }}
              placeholder={mine.length ? 'Pick one of your tournaments' : 'You have no tournaments yet'}
              options={tournamentOptions}
            />
          </div>
          <div>
            <Label htmlFor="tpl-name">Template name</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="tpl-desc">Description</Label>
            <Input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={!sourceId || !name.trim() || createFrom.isPending}>
              {createFrom.isPending ? 'Creating…' : 'Create template'}
            </Button>
          </div>
        </form>
      </Card>

      {editing && (
        <Card title="Edit template">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate(editing);
            }}
          >
            <div>
              <Label>Name</Label>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={editing.description ?? ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                Save
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title={`Community templates (${templates.length})`}>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded bg-[var(--color-surface)]" />
        ) : templates.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No templates yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                communityId={community.id}
                canEdit
                onEdit={setEditing}
                onDelete={(x) => {
                  if (confirm(`Delete template "${x.name}"?`)) remove.mutate(x);
                }}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function RankingsSection({ community, onChanged }: { community: Community; onChanged: () => void }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    gameId: '',
    startAt: '',
    endAt: '',
    ...RANKING_DEFAULTS,
  });

  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['community-rankings', community.id, token ?? 'anon'],
    queryFn: () => api<Ranking[]>(`/communities/${community.id}/rankings`, { token }),
  });
  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => api<Game[]>('/games'),
  });
  const { data: tournaments = [] } = useQuery({
    queryKey: ['community-tournaments', community.id, token ?? 'anon'],
    queryFn: () => api<CommunityTournamentCard[]>(`/communities/${community.id}/tournaments`, { token }),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['community-rankings', community.id] });
    void qc.invalidateQueries({ queryKey: ['community-tournaments', community.id] });
    onChanged();
  }

  const create = useMutation({
    mutationFn: () =>
      api<Ranking>(`/communities/${community.id}/rankings`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          gameId: form.gameId || null,
          startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
          endAt: form.endAt ? new Date(`${form.endAt}T23:59:59`).toISOString() : null,
          startingRating: form.startingRating,
          kFactorNew: form.kFactorNew,
          kFactorNormal: form.kFactorNormal,
          kFactorPro: form.kFactorPro,
          newPlayerMatches: form.newPlayerMatches,
          proThreshold: form.proThreshold,
        }),
      }),
    onSuccess: () => {
      toast.success('Ranking created');
      setCreating(false);
      setForm({ name: '', description: '', gameId: '', startAt: '', endAt: '', ...RANKING_DEFAULTS });
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  const assign = useMutation({
    mutationFn: ({ rankingId, tournamentId, on }: { rankingId: string; tournamentId: string; on: boolean }) =>
      api(`/rankings/${rankingId}/tournaments/${tournamentId}`, {
        method: on ? 'POST' : 'DELETE',
        token,
      }),
    onSuccess: () => {
      toast.success('Tournament assignment updated');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  const { data: assignments = {} } = useQuery({
    queryKey: ['ranking-assignments', community.id, rankings.map((r) => r.id).join(',')],
    enabled: rankings.length > 0,
    queryFn: async () => {
      const out: Record<string, string[]> = {};
      await Promise.all(
        rankings.map(async (r) => {
          const res = await api<{ tournaments: { id: string }[] }>(`/rankings/${r.id}?pageSize=1`, { token });
          out[r.id] = res.tournaments.map((t) => t.id);
        }),
      );
      return out;
    },
  });

  const numericKeys = [
    'startingRating',
    'kFactorNew',
    'kFactorNormal',
    'kFactorPro',
    'newPlayerMatches',
    'proThreshold',
  ] as const;

  return (
    <div className="space-y-6">
      <Card
        title="Rankings"
        description="Elo-style ladders fed by results of assigned tournaments. Players with accounts are tracked by account; others by team name."
      >
        {!creating ? (
          <Button onClick={() => setCreating(true)}>New ranking</Button>
        ) : (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.name.trim()) create.mutate();
            }}
          >
            <div>
              <Label htmlFor="rk-new-name">Name</Label>
              <Input
                id="rk-new-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 2026 Season ladder"
                required
              />
            </div>
            <div>
              <Label>Game (optional)</Label>
              <Select
                value={form.gameId}
                onChange={(v) => setForm((f) => ({ ...f, gameId: v }))}
                placeholder="Any game"
                options={games.map((g) => ({ value: g.id, label: g.name }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="rk-new-desc">Description</Label>
              <textarea
                id="rk-new-desc"
                className="field-textarea min-h-[70px]"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="rk-new-start">Start date</Label>
              <Input
                id="rk-new-start"
                type="date"
                value={form.startAt}
                onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="rk-new-end">End date</Label>
              <Input
                id="rk-new-end"
                type="date"
                value={form.endAt}
                onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
              />
            </div>
            {numericKeys.map((k) => (
              <div key={k}>
                <Label htmlFor={`rk-new-${k}`}>{labelFor(k)}</Label>
                <Input
                  id={`rk-new-${k}`}
                  type="number"
                  min={0}
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: Number(e.target.value) || 0 }))}
                />
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">{RANKING_K_FACTOR_HELP[k]}</p>
              </div>
            ))}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending || !form.name.trim()}>
                {create.isPending ? 'Creating…' : 'Create ranking'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {isLoading ? (
        <div className="panel-card h-32 animate-pulse rounded-2xl" />
      ) : rankings.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No rankings yet.</p>
      ) : (
        rankings.map((r) => {
          const assigned = new Set(assignments[r.id] ?? []);
          return (
            <section key={r.id} className="panel-card rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold">
                    {r.name}
                    {!r.isActive && (
                      <span className="ml-2 rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
                        Inactive
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    {r.game?.name ? `${r.game.name} · ` : ''}
                    {r._count?.entries ?? 0} rated · K {r.kFactorNew}/{r.kFactorNormal}/{r.kFactorPro} · start{' '}
                    {r.startingRating}
                    {r.startAt || r.endAt
                      ? ` · ${r.startAt ? formatDate(r.startAt) : '…'} – ${r.endAt ? formatDate(r.endAt) : 'ongoing'}`
                      : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/c/${community.slug}/rankings/${r.id}`}>
                    <Button variant="secondary" className="text-xs">
                      Leaderboard
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={() => setEditingId(editingId === r.id ? null : r.id)}
                  >
                    {editingId === r.id ? 'Close' : 'Settings'}
                  </Button>
                </div>
              </div>

              {editingId === r.id && (
                <RankingSettingsEditor
                  ranking={r}
                  onSaved={() => {
                    setEditingId(null);
                    refresh();
                  }}
                  onDeleted={() => {
                    setEditingId(null);
                    refresh();
                  }}
                />
              )}

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Counting tournaments
                </p>
                {tournaments.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted)]">
                    Attach tournaments to the community first (Tournaments section).
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tournaments.map((t) => {
                      const on = assigned.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={assign.isPending}
                          className={cn('choice-btn rounded-full px-3 py-1.5 text-xs', on && 'choice-btn-active')}
                          onClick={() => assign.mutate({ rankingId: r.id, tournamentId: t.id, on: !on })}
                          title={on ? 'Click to unassign' : 'Click to assign'}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function labelFor(k: keyof typeof RANKING_K_FACTOR_HELP): string {
  switch (k) {
    case 'startingRating':
      return 'Starting rating';
    case 'kFactorNew':
      return 'New K-factor';
    case 'kFactorNormal':
      return 'Normal K-factor';
    case 'kFactorPro':
      return 'Pro K-factor';
    case 'newPlayerMatches':
      return 'New player matches';
    case 'proThreshold':
      return 'Pro threshold';
  }
}

function TournamentsSection({ community, onChanged }: { community: Community; onChanged: () => void }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [pick, setPick] = useState('');
  const { data: attached = [], isLoading } = useQuery({
    queryKey: ['community-tournaments', community.id, token ?? 'anon'],
    queryFn: () => api<CommunityTournamentCard[]>(`/communities/${community.id}/tournaments`, { token }),
  });
  const { data: mine = [] } = useQuery({
    queryKey: ['my-tournaments'],
    queryFn: () => api<Tournament[]>('/tournaments/mine', { token }),
  });
  const attachedIds = new Set(attached.map((t) => t.id));
  const candidates = mine.filter((t) => !attachedIds.has(t.id) && !t.communityId);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['community-tournaments', community.id] });
    void qc.invalidateQueries({ queryKey: ['my-tournaments'] });
    onChanged();
  }

  const attach = useMutation({
    mutationFn: (tournamentId: string) =>
      api(`/communities/${community.id}/tournaments/${tournamentId}`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success('Tournament attached');
      setPick('');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });
  const detach = useMutation({
    mutationFn: (tournamentId: string) =>
      api(`/communities/${community.id}/tournaments/${tournamentId}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Tournament detached');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  return (
    <div className="space-y-6">
      <Card
        title="Attach an existing tournament"
        description="Tournaments you manage that are not yet part of a community."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select
            value={pick}
            onChange={setPick}
            placeholder={candidates.length ? 'Choose a tournament' : 'Nothing to attach'}
            options={candidates.map((t) => ({ value: t.id, label: t.name }))}
            className="flex-1"
          />
          <Button disabled={!pick || attach.isPending} onClick={() => attach.mutate(pick)}>
            Attach
          </Button>
          <Link href={`/tournaments/new?community=${community.id}`}>
            <Button variant="secondary">Create new</Button>
          </Link>
        </div>
      </Card>

      <Card title={`Community tournaments (${attached.length})`}>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded bg-[var(--color-surface)]" />
        ) : attached.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No tournaments attached yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {attached.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/t/${t.slug}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                  <p className="text-xs text-[var(--color-muted)]">
                    {t.status} · {t._count?.teams ?? 0} teams
                    {t.startAt ? ` · ${formatDate(t.startAt)}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/t/${t.slug}/manage`}>
                    <Button variant="ghost" className="text-xs">
                      Manage
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    className="text-xs hover:text-[var(--color-danger)]"
                    disabled={detach.isPending}
                    onClick={() => {
                      if (confirm(`Detach "${t.name}" from the community?`)) detach.mutate(t.id);
                    }}
                  >
                    Detach
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DangerSection({ community, isOwner }: { community: Community; isOwner: boolean }) {
  const { token } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirmSlug, setConfirmSlug] = useState('');
  const remove = useMutation({
    mutationFn: () => api(`/communities/${community.id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Community deleted');
      void qc.invalidateQueries({ queryKey: ['communities-mine'] });
      router.replace('/communities');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });
  return (
    <Card
      title="Delete community"
      description="Removes the community, its members, followers, announcements, rankings and templates. Tournaments are kept but detached."
    >
      {!isOwner ? (
        <p className="text-sm text-[var(--color-muted)]">Only the owner can delete the community.</p>
      ) : (
        <div className="space-y-3">
          <Label htmlFor="danger-slug">
            Type <span className="font-mono text-[var(--color-ink)]">{community.slug}</span> to confirm
          </Label>
          <Input
            id="danger-slug"
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            className="sm:w-80"
          />
          <Button
            variant="secondary"
            className="border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
            disabled={confirmSlug !== community.slug || remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? 'Deleting…' : 'Delete this community'}
          </Button>
        </div>
      )}
    </Card>
  );
}

function normalizeUrl(value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}
