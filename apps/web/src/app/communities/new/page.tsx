'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  COMMUNITY_AUDIENCE_OPTIONS,
  COMMUNITY_BANNER_SPEC,
  COMMUNITY_SOCIAL_KEYS,
  COMMUNITY_SOCIAL_LABELS,
  COUNTRY_OPTIONS,
  slugifyCommunityName,
  type CommunitySocialKey,
} from '@bracket/shared';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ImageUrlField } from '@/components/image-url-field';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Community } from '@/lib/types-platform';
import { cn } from '@/lib/utils';

type SlugCheck = { slug: string; available: boolean; suggestion: string | null };

export default function NewCommunityPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [audience, setAudience] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [description, setDescription] = useState('');
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/communities/new');
  }, [loading, user, router]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugifyCommunityName(name));
  }, [name, slugTouched]);

  const [slugToCheck, setSlugToCheck] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSlugToCheck(slug), 350);
    return () => clearTimeout(t);
  }, [slug]);

  const { data: slugCheck } = useQuery({
    queryKey: ['community-slug-check', slugToCheck],
    enabled: slugToCheck.length >= 2,
    queryFn: () => api<SlugCheck>(`/communities/slug-check?slug=${encodeURIComponent(slugToCheck)}`),
  });

  const countryOptions = useMemo(
    () => COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.name })),
    [],
  );

  const create = useMutation({
    mutationFn: () => {
      const cleanSocials = Object.fromEntries(
        Object.entries(socials).filter(([, v]) => v.trim()),
      );
      return api<Community>('/communities', {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          audience,
          location: location.trim() || null,
          countryCode: countryCode || null,
          websiteUrl: cleanSocials.website?.trim()
            ? normalizeUrl(cleanSocials.website)
            : null,
          socials: cleanSocials,
          logoUrl: logoUrl.trim() || null,
          bannerUrl: bannerUrl.trim() || null,
          isPublic,
        }),
      });
    },
    onSuccess: (c) => {
      toast.success('Community created');
      void qc.invalidateQueries({ queryKey: ['communities-mine'] });
      router.push(`/c/${c.slug}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not create community'),
  });

  const slugState =
    slug.length < 2
      ? null
      : slugCheck && slugCheck.slug === slugifyCommunityName(slug)
        ? slugCheck.available
          ? 'available'
          : 'taken'
        : 'checking';

  const canSubmit = name.trim().length >= 2 && slugState !== 'taken' && !create.isPending;

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
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/communities" className="text-sm text-[var(--color-muted)] hover:underline">
          ← All communities
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Start a community</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          A community is a home for your organization&apos;s tournaments, events, rankings and
          announcements. You can invite admins, collaborators and affiliates later.
        </p>

        <form
          className="mt-8 space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) create.mutate();
          }}
        >
          <section className="panel-card space-y-4 rounded-2xl p-5">
            <h2 className="font-display text-lg font-bold">Basics</h2>
            <div>
              <Label htmlFor="name">Community name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dhaka Esports League"
                maxLength={80}
                required
              />
            </div>
            <div>
              <Label htmlFor="slug">URL</Label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-[var(--color-muted)]">/c/</span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugifyCommunityName(e.target.value));
                  }}
                  placeholder="your-community"
                  maxLength={60}
                />
              </div>
              <p
                className={cn(
                  'mt-1 text-xs',
                  slugState === 'available' && 'text-[var(--color-ok)]',
                  slugState === 'taken' && 'text-[var(--color-danger)]',
                  (!slugState || slugState === 'checking') && 'text-[var(--color-muted)]',
                )}
              >
                {slugState === 'available' && 'This URL is available.'}
                {slugState === 'taken' &&
                  `Already taken.${slugCheck?.suggestion ? ` Try "${slugCheck.suggestion}".` : ''}`}
                {slugState === 'checking' && 'Checking availability…'}
                {!slugState && 'Lowercase letters, numbers and hyphens.'}
              </p>
            </div>
            <div>
              <Label>Who is it for?</Label>
              <div className="flex flex-wrap gap-2">
                {COMMUNITY_AUDIENCE_OPTIONS.map((opt) => {
                  const active = audience.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={cn(
                        'choice-btn rounded-full px-3 py-1.5 text-sm transition',
                        active && 'choice-btn-active',
                      )}
                      onClick={() =>
                        setAudience((a) => (active ? a.filter((x) => x !== opt) : [...a, opt]))
                      }
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="field-textarea min-h-[120px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell people what you run, how often, and how to get involved."
                maxLength={4000}
              />
            </div>
          </section>

          <section className="panel-card space-y-4 rounded-2xl p-5">
            <h2 className="font-display text-lg font-bold">Location</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="location">City / region</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Dhaka"
                  maxLength={120}
                />
              </div>
              <div>
                <Label>Country</Label>
                <Select
                  value={countryCode}
                  onChange={setCountryCode}
                  placeholder="Select country"
                  options={countryOptions}
                />
              </div>
            </div>
          </section>

          <section className="panel-card space-y-4 rounded-2xl p-5">
            <h2 className="font-display text-lg font-bold">Links</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {COMMUNITY_SOCIAL_KEYS.map((key: CommunitySocialKey) => (
                <div key={key}>
                  <Label htmlFor={`social-${key}`}>{COMMUNITY_SOCIAL_LABELS[key]}</Label>
                  <Input
                    id={`social-${key}`}
                    value={socials[key] ?? ''}
                    onChange={(e) => setSocials((s) => ({ ...s, [key]: e.target.value }))}
                    placeholder={placeholderFor(key)}
                    maxLength={500}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="panel-card space-y-4 rounded-2xl p-5">
            <h2 className="font-display text-lg font-bold">Branding</h2>
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
          </section>

          <section className="panel-card rounded-2xl p-5">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--color-accent)]"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span>
                <span className="font-medium">Public community</span>
                <span className="mt-0.5 block text-[var(--color-muted)]">
                  Listed in discovery and visible to everyone. Turn off to make it visible to
                  members only.
                </span>
              </span>
            </label>
          </section>

          <div className="flex items-center justify-end gap-3">
            <Link href="/communities">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={!canSubmit}>
              {create.isPending ? 'Creating…' : 'Create community'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function placeholderFor(key: CommunitySocialKey): string {
  switch (key) {
    case 'twitter':
      return 'https://x.com/yourhandle';
    case 'discord':
      return 'https://discord.gg/invite';
    case 'youtube':
      return 'https://youtube.com/@channel';
    case 'twitch':
      return 'https://twitch.tv/channel';
    case 'instagram':
      return 'https://instagram.com/handle';
    case 'facebook':
      return 'https://facebook.com/page';
    case 'website':
      return 'https://example.com';
  }
}

function normalizeUrl(value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}
