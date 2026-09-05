'use client';

import Link from 'next/link';
import {
  Facebook,
  Globe,
  Instagram,
  Lock,
  MapPin,
  MessageCircle,
  Plus,
  Settings,
  Twitch,
  Twitter,
  Youtube,
} from 'lucide-react';
import { COMMUNITY_SOCIAL_LABELS, communityRoleAtLeast } from '@bracket/shared';
import { Button } from '@/components/ui/button';
import type { Community, CommunityRole } from '@/lib/types-platform';
import { countryName } from './community-card';
import { FollowButton } from './follow-button';
import { RoleBadge } from './role-badge';
import { initialsOf } from './types';

const SOCIAL_ICONS: Record<string, typeof Globe> = {
  twitter: Twitter,
  discord: MessageCircle,
  youtube: Youtube,
  twitch: Twitch,
  instagram: Instagram,
  facebook: Facebook,
  website: Globe,
};

function normalizeUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('@')) return value;
  return `https://${value}`;
}

export function CommunityHeader({
  community,
  viewerRole,
  isFollowing,
  followers,
}: {
  community: Community;
  viewerRole: CommunityRole | null;
  isFollowing: boolean;
  followers: number;
}) {
  const socials = Object.entries(community.socials ?? {}).filter(([, v]) => !!v);
  if (community.websiteUrl && !community.socials?.website) {
    socials.push(['website', community.websiteUrl]);
  }
  const location = [community.location, countryName(community.countryCode)]
    .filter(Boolean)
    .join(', ');
  const canManage = communityRoleAtLeast(viewerRole, 'COLLABORATOR');
  const canCreate = communityRoleAtLeast(viewerRole, 'AFFILIATE');

  return (
    <header className="gaming-card overflow-hidden rounded-2xl">
      <div
        className="relative aspect-[1920/820] max-h-[360px] w-full bg-cover bg-center"
        style={{
          backgroundImage: community.bannerUrl
            ? `url(${community.bannerUrl})`
            : 'linear-gradient(135deg, rgba(77,212,255,0.35), rgba(124,92,255,0.35) 60%, rgba(34,40,49,1))',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-card)] via-transparent to-transparent" />
      </div>
      <div className="relative px-5 pb-5 sm:px-8">
        <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-[var(--color-card)] bg-[var(--color-surface)] font-display text-2xl font-bold shadow-lg">
              {community.logoUrl ? (
                <img src={community.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                initialsOf(community.name)
              )}
            </div>
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold sm:text-3xl">{community.name}</h1>
                {!community.isPublic && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
                    <Lock className="size-3" /> Private
                  </span>
                )}
                <RoleBadge role={viewerRole} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--color-muted)]">
                {location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {location}
                  </span>
                )}
                {community.audience?.length > 0 && (
                  <span>{community.audience.join(' · ')}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:pb-1">
            <FollowButton
              communityId={community.id}
              slug={community.slug}
              isFollowing={isFollowing}
              followers={followers}
            />
            {canCreate && (
              <Link href={`/tournaments/new?community=${community.id}`}>
                <Button variant="secondary" className="gap-1.5">
                  <Plus className="size-4" /> Create tournament
                </Button>
              </Link>
            )}
            {canManage && (
              <Link href={`/c/${community.slug}/manage`}>
                <Button variant="secondary" className="gap-1.5">
                  <Settings className="size-4" /> Manage
                </Button>
              </Link>
            )}
          </div>
        </div>
        {socials.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {socials.map(([key, value]) => {
              const Icon = SOCIAL_ICONS[key] ?? Globe;
              const label =
                COMMUNITY_SOCIAL_LABELS[key as keyof typeof COMMUNITY_SOCIAL_LABELS] ?? key;
              return (
                <a
                  key={key}
                  href={normalizeUrl(value)}
                  target="_blank"
                  rel="noreferrer"
                  title={label}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] transition hover:border-[var(--color-accent)]/40 hover:text-[var(--color-ink)]"
                >
                  <Icon className="size-4" />
                  <span className="sr-only">{label}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
