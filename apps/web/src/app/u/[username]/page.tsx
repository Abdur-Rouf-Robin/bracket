'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Trophy, Users, Swords } from 'lucide-react';
import { COUNTRY_OPTIONS } from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { Avatar } from '@/components/account/avatar';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { PublicUser } from '@/lib/types-platform';

type HostedTournament = {
  id: string;
  slug: string;
  name: string;
  status: string;
  format: string | null;
  startAt: string | null;
  logoUrl: string | null;
  game: { id: string; name: string; category: string } | null;
  teamCount: number;
};

type Participation = {
  team: { id: string; name: string; seed: number | null; withdrawn: boolean };
  tournament: {
    id: string;
    slug: string;
    name: string;
    status: string;
    startAt: string | null;
    logoUrl: string | null;
    game: { id: string; name: string } | null;
  };
  finalRank: number | null;
  record: { wins: number; losses: number; draws: number } | null;
};

type Profile = {
  user: PublicUser;
  stats: { tournamentsHosted: number; tournamentsPlayed: number; wins: number };
  hosted: HostedTournament[];
  participated: Participation[];
  communities: { id: string; slug: string; name: string; logoUrl: string | null }[];
};

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const { user, token } = useAuth();

  const query = useQuery({
    queryKey: ['public-profile', username],
    queryFn: () => api<Profile>(`/users/${encodeURIComponent(username)}`, { token: token ?? undefined }),
  });

  const profile = query.data;
  const isSelf = !!user && !!profile && user.id === profile.user.id;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        {query.isLoading && <p className="text-[var(--color-muted)]">Loading profile…</p>}
        {query.error && (
          <div className="gaming-card rounded-2xl p-8 text-center">
            <h1 className="font-display text-2xl font-bold">Player not found</h1>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              No one goes by @{username} here.
            </p>
            <Link href="/browse" className="mt-4 inline-block">
              <Button variant="secondary">Browse tournaments</Button>
            </Link>
          </div>
        )}
        {profile && (
          <>
            <section className="gaming-card rounded-2xl p-6">
              <div className="flex flex-wrap items-start gap-5">
                <Avatar name={profile.user.name} src={profile.user.avatarUrl} size="xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-display text-3xl font-bold">{profile.user.name}</h1>
                    {profile.user.username && (
                      <span className="text-sm text-[var(--color-muted)]">@{profile.user.username}</span>
                    )}
                    {isSelf && (
                      <Link href="/settings/profile" className="ml-auto">
                        <Button variant="secondary" className="h-8 text-xs">
                          Edit profile
                        </Button>
                      </Link>
                    )}
                  </div>
                  {profile.user.bio && (
                    <p className="mt-2 max-w-2xl text-sm text-[var(--color-ink)]/90">{profile.user.bio}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                    {profile.user.countryCode && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {COUNTRY_OPTIONS.find((c) => c.code === profile.user.countryCode)?.name ??
                          profile.user.countryCode}
                      </span>
                    )}
                    {profile.user.createdAt && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        Joined {formatDate(profile.user.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <StatCard icon={Users} label="Tournaments hosted" value={profile.stats.tournamentsHosted} />
                <StatCard icon={Swords} label="Tournaments played" value={profile.stats.tournamentsPlayed} />
                <StatCard icon={Trophy} label="Match wins" value={profile.stats.wins} />
              </div>
            </section>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <section>
                <h2 className="font-display text-lg font-semibold">Hosted tournaments</h2>
                {profile.hosted.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--color-muted)]">No public tournaments hosted yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {profile.hosted.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/t/${t.slug}`}
                          className="panel-card flex items-center gap-3 rounded-xl p-3 transition hover:border-[var(--color-accent)]/40"
                        >
                          {t.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.logoUrl} alt="" className="size-10 rounded-lg object-cover" />
                          ) : (
                            <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-accent)]/15 text-xs font-bold text-[var(--color-accent)]">
                              {t.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{t.name}</span>
                            <span className="block text-xs text-[var(--color-muted)]">
                              {[t.game?.name, formatDate(t.startAt), `${t.teamCount} participants`]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          <StatusChip status={t.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="font-display text-lg font-semibold">Participation</h2>
                {profile.participated.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--color-muted)]">Hasn&apos;t played in a public tournament yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {profile.participated.map((p) => (
                      <li key={p.team.id}>
                        <Link
                          href={`/t/${p.tournament.slug}`}
                          className="panel-card flex items-center gap-3 rounded-xl p-3 transition hover:border-[var(--color-accent)]/40"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{p.tournament.name}</span>
                            <span className="block text-xs text-[var(--color-muted)]">
                              as <span className="text-[var(--color-ink)]">{p.team.name}</span>
                              {p.team.withdrawn ? ' · withdrawn' : ''}
                              {p.record
                                ? ` · ${p.record.wins}W ${p.record.losses}L${p.record.draws ? ` ${p.record.draws}D` : ''}`
                                : ''}
                              {formatDate(p.tournament.startAt) ? ` · ${formatDate(p.tournament.startAt)}` : ''}
                            </span>
                          </span>
                          {p.finalRank ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                p.finalRank === 1
                                  ? 'bg-amber-400/20 text-amber-300'
                                  : 'bg-[var(--color-surface)] text-[var(--color-muted)]'
                              }`}
                            >
                              {ordinal(p.finalRank)}
                            </span>
                          ) : (
                            <StatusChip status={p.tournament.status} />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {profile.communities.length > 0 && (
              <section className="mt-8">
                <h2 className="font-display text-lg font-semibold">Communities</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.communities.map((c) => (
                    <Link
                      key={c.id}
                      href={`/c/${c.slug}`}
                      className="panel-card flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition hover:border-[var(--color-accent)]/40"
                    >
                      {c.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logoUrl} alt="" className="size-5 rounded-full object-cover" />
                      ) : (
                        <span className="size-5 rounded-full bg-[var(--color-accent)]/20" />
                      )}
                      {c.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="panel-card rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">
        <Icon className="size-3.5" /> {label}
      </div>
      <p className="font-display mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === 'ACTIVE'
      ? 'text-[var(--color-ok)] border-[var(--color-ok)]/40'
      : status === 'COMPLETED'
        ? 'text-[var(--color-muted)] border-[var(--color-line)]'
        : 'text-[var(--color-accent)] border-[var(--color-accent)]/40';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
      {status === 'ACTIVE' ? 'Live' : status === 'COMPLETED' ? 'Finished' : 'Upcoming'}
    </span>
  );
}
