import Link from 'next/link';
import { MapPin, Trophy, Users } from 'lucide-react';
import { COUNTRY_OPTIONS } from '@bracket/shared';
import type { Community, CommunityRole } from '@/lib/types-platform';
import { RoleBadge } from './role-badge';
import { initialsOf } from './types';

export function countryName(code?: string | null): string | null {
  if (!code) return null;
  return COUNTRY_OPTIONS.find((c) => c.code === code)?.name ?? code;
}

export function CommunityCard({
  community,
  viewerRole,
}: {
  community: Community;
  viewerRole?: CommunityRole | null;
}) {
  const games = community.games ?? [];
  const location = [community.location, countryName(community.countryCode)]
    .filter(Boolean)
    .join(', ');
  return (
    <Link
      href={`/c/${community.slug}`}
      className="gaming-card group flex flex-col overflow-hidden rounded-2xl transition hover:border-[var(--color-accent)]/40"
    >
      <div
        className="relative h-24 w-full bg-cover bg-center"
        style={{
          backgroundImage: community.bannerUrl
            ? `url(${community.bannerUrl})`
            : 'linear-gradient(135deg, rgba(77,212,255,0.25), rgba(124,92,255,0.25))',
        }}
      >
        <div className="absolute -bottom-6 left-4 flex size-14 items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--color-card)] bg-[var(--color-surface)] font-display text-lg font-bold">
          {community.logoUrl ? (
            <img src={community.logoUrl} alt="" className="size-full object-cover" />
          ) : (
            initialsOf(community.name)
          )}
        </div>
        {viewerRole && (
          <RoleBadge role={viewerRole} className="absolute right-3 top-3 shadow" />
        )}
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-8">
        <h3 className="font-display text-lg font-bold leading-tight group-hover:text-[var(--color-accent)]">
          {community.name}
        </h3>
        {location && (
          <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <MapPin className="size-3" /> {location}
          </p>
        )}
        {community.description && (
          <p className="mt-2 line-clamp-2 text-sm text-[var(--color-muted)]">
            {community.description}
          </p>
        )}
        {games.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {games.slice(0, 4).map((g) => (
              <span
                key={g.id}
                className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]"
              >
                {g.name}
              </span>
            ))}
            {games.length > 4 && (
              <span className="rounded-full px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
                +{games.length - 4}
              </span>
            )}
          </div>
        )}
        <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-[var(--color-muted)]">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {community._count?.followers ?? 0} followers
          </span>
          <span className="inline-flex items-center gap-1">
            <Trophy className="size-3.5" /> {community._count?.tournaments ?? 0} tournaments
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CommunityCardSkeleton() {
  return (
    <div className="gaming-card animate-pulse overflow-hidden rounded-2xl">
      <div className="h-24 bg-[var(--color-surface)]" />
      <div className="space-y-2 px-4 pb-4 pt-8">
        <div className="h-5 w-2/3 rounded bg-[var(--color-surface)]" />
        <div className="h-3 w-1/3 rounded bg-[var(--color-surface)]" />
        <div className="h-3 w-full rounded bg-[var(--color-surface)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--color-surface)]" />
      </div>
    </div>
  );
}
