'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import { ImageUrlField } from '@/components/image-url-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Community } from '@/lib/types-platform';
import { cn } from '@/lib/utils';

type SlugCheck = { slug: string; available: boolean; suggestion: string | null };

export function ManageCommunitySettings({
  community,
  onSaved,
}: {
  community: Community;
  onSaved: (next: Community) => void;
}) {
  const { token } = useAuth();
  const [name, setName] = useState(community.name);
  const [slug, setSlug] = useState(community.slug);
  const [slugTouched, setSlugTouched] = useState(true);
  const [audience, setAudience] = useState<string[]>(community.audience ?? []);
  const [location, setLocation] = useState(community.location ?? '');
  const [countryCode, setCountryCode] = useState(community.countryCode ?? '');
  const [description, setDescription] = useState(community.description ?? '');
  const [socials, setSocials] = useState<Record<string, string>>(community.socials ?? {});
  const [logoUrl, setLogoUrl] = useState(community.logoUrl ?? '');
  const [bannerUrl, setBannerUrl] = useState(community.bannerUrl ?? '');
  const [isPublic, setIsPublic] = useState(community.isPublic);

  const [slugToCheck, setSlugToCheck] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSlugToCheck(slug), 350);
    return () => clearTimeout(t);
  }, [slug]);

  const { data: slugCheck } = useQuery({
    queryKey: ['community-slug-check', slugToCheck, community.id],
    enabled: slugToCheck.length >= 2 && slugToCheck !== community.slug,
    queryFn: () =>
      api<SlugCheck>(
        `/communities/slug-check?slug=${encodeURIComponent(slugToCheck)}&excludeId=${community.id}`,
      ),
  });

  const countryOptions = useMemo(
    () => COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.name })),
    [],
  );

  const save = useMutation({
    mutationFn: () => {
      const cleanSocials = Object.fromEntries(
        Object.entries(socials).filter(([, v]) => v.trim()),
      );
      return api<Community>(`/communities/${community.id}`, {
        method: 'PATCH',
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
    onSuccess: (next) => {
      toast.success('Community settings saved');
      onSaved(next);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save'),
  });

  const slugState =
    slug.length < 2
      ? null
      : slug === community.slug
        ? 'available'
        : slugCheck && slugCheck.slug === slugifyCommunityName(slug)
          ? slugCheck.available
            ? 'available'
            : 'taken'
          : 'checking';

  const canSubmit = name.trim().length >= 2 && slugState !== 'taken' && !save.isPending;

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) save.mutate();
      }}
    >
      <section className="panel-card space-y-4 rounded-2xl p-5">
        <h3 className="font-display text-lg font-bold">Basics</h3>
        <div>
          <Label htmlFor="c-name">Community name</Label>
          <Input
            id="c-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugifyCommunityName(e.target.value));
            }}
            maxLength={80}
            required
          />
        </div>
        <div>
          <Label htmlFor="c-slug">URL</Label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-[var(--color-muted)]">/c/</span>
            <Input
              id="c-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugifyCommunityName(e.target.value));
              }}
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
          <Label htmlFor="c-desc">Description</Label>
          <textarea
            id="c-desc"
            className="field-textarea min-h-[120px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
          />
        </div>
      </section>

      <section className="panel-card space-y-4 rounded-2xl p-5">
        <h3 className="font-display text-lg font-bold">Location</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="c-location">City / region</Label>
            <Input
              id="c-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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
        <h3 className="font-display text-lg font-bold">Links</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {COMMUNITY_SOCIAL_KEYS.map((key: CommunitySocialKey) => (
            <div key={key}>
              <Label htmlFor={`c-social-${key}`}>{COMMUNITY_SOCIAL_LABELS[key]}</Label>
              <Input
                id={`c-social-${key}`}
                value={socials[key] ?? ''}
                onChange={(e) => setSocials((s) => ({ ...s, [key]: e.target.value }))}
                maxLength={500}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel-card space-y-4 rounded-2xl p-5">
        <h3 className="font-display text-lg font-bold">Branding</h3>
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
              Listed in discovery. Turn off to keep it members-only.
            </span>
          </span>
        </label>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit}>
          {save.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}

function normalizeUrl(value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}
