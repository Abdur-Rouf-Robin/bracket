'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { slugifyEventName } from '@bracket/shared';
import { ImageUrlField } from '@/components/image-url-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Community } from '@/lib/types-platform';
import type { EventDetail } from './event-types';
import { browserTimeZone, isoToLocalInput, localInputToIso, timezoneOptions } from './event-utils';

export type EventFormValues = {
  name: string;
  slug?: string;
  description: string | null;
  startAt: string | null;
  endAt: string | null;
  timezone: string;
  venueType: 'ONLINE' | 'PHYSICAL' | null;
  venueName: string | null;
  venueAddress: string | null;
  venueUrl: string | null;
  streamUrl: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  isPublic: boolean;
  communityId: string | null;
};

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="panel-card flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-[var(--color-accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-medium text-[var(--color-ink)]">{label}</span>
        {hint && <span className="mt-0.5 block text-[var(--color-muted)]">{hint}</span>}
      </span>
    </label>
  );
}

export function EventForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  showSlug = true,
}: {
  initial?: Partial<EventDetail> | null;
  submitLabel: string;
  pending?: boolean;
  error?: string;
  onSubmit: (values: EventFormValues) => void;
  showSlug?: boolean;
}) {
  const { token } = useAuth();
  const isEdit = !!initial?.id;

  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [timezone, setTimezone] = useState(initial?.timezone ?? browserTimeZone());
  const [startLocal, setStartLocal] = useState(() =>
    isoToLocalInput(initial?.startAt, initial?.timezone ?? browserTimeZone()),
  );
  const [endLocal, setEndLocal] = useState(() =>
    isoToLocalInput(initial?.endAt, initial?.timezone ?? browserTimeZone()),
  );
  const [venueType, setVenueType] = useState<'ONLINE' | 'PHYSICAL' | ''>(
    (initial?.venueType as 'ONLINE' | 'PHYSICAL' | null) ?? '',
  );
  const [venueName, setVenueName] = useState(initial?.venueName ?? '');
  const [venueAddress, setVenueAddress] = useState(initial?.venueAddress ?? '');
  const [venueUrl, setVenueUrl] = useState(initial?.venueUrl ?? '');
  const [streamUrl, setStreamUrl] = useState(initial?.streamUrl ?? '');
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? '');
  const [bannerUrl, setBannerUrl] = useState(initial?.bannerUrl ?? '');
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? true);
  const [communityId, setCommunityId] = useState(initial?.communityId ?? '');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!slugTouched) setSlug(slugifyEventName(name));
  }, [name, slugTouched]);

  // Communities I can post to (endpoint owned by another workstream; hide if missing).
  const { data: communities } = useQuery({
    queryKey: ['communities-mine'],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      try {
        const res = await api<Community[] | { items: Community[] }>('/communities/mine', { token });
        return Array.isArray(res) ? res : res.items ?? [];
      } catch {
        return null;
      }
    },
  });

  const tzOptions = useMemo(() => timezoneOptions(timezone), [timezone]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError('');
    if (name.trim().length < 2) {
      setLocalError('Name must be at least 2 characters');
      return;
    }
    const startAt = localInputToIso(startLocal, timezone);
    const endAt = localInputToIso(endLocal, timezone);
    if (startAt && endAt && new Date(endAt) < new Date(startAt)) {
      setLocalError('End must be after start');
      return;
    }
    onSubmit({
      name: name.trim(),
      slug: showSlug && slug.trim() ? slug.trim() : undefined,
      description: description.trim() || null,
      startAt,
      endAt,
      timezone,
      venueType: venueType || null,
      venueName: venueName.trim() || null,
      venueAddress: venueType === 'PHYSICAL' ? venueAddress.trim() || null : null,
      venueUrl: venueUrl.trim() || null,
      streamUrl: streamUrl.trim() || null,
      logoUrl: logoUrl.trim() || null,
      bannerUrl: bannerUrl.trim() || null,
      isPublic,
      communityId: communityId || null,
    });
  }

  const shownError = localError || error;

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Basics</h2>
        <div>
          <Label htmlFor="ev-name">Event name</Label>
          <Input
            id="ev-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Summer Showdown 2026"
            required
          />
        </div>
        {showSlug && (
          <div>
            <Label htmlFor="ev-slug">URL slug</Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-[var(--color-muted)]">/e/</span>
              <Input
                id="ev-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugifyEventName(e.target.value));
                }}
                placeholder="summer-showdown-2026"
              />
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Lowercase letters, numbers and dashes. Left blank → generated from the name.
            </p>
          </div>
        )}
        <div>
          <Label htmlFor="ev-desc">About this event</Label>
          <textarea
            id="ev-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="field-textarea w-full"
            placeholder="Schedule, prizes, rules, what to bring…"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">When</h2>
        <div>
          <Label>Timezone</Label>
          <Select value={timezone} onChange={setTimezone} options={tzOptions} placeholder="Timezone" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ev-start">Starts</Label>
            <Input
              id="ev-start"
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ev-end">Ends</Label>
            <Input
              id="ev-end"
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Where</h2>
        <div className="grid grid-cols-2 gap-2">
          {(['ONLINE', 'PHYSICAL'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVenueType(venueType === v ? '' : v)}
              className={`panel-card rounded-xl px-4 py-3 text-left text-sm transition ${
                venueType === v
                  ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30'
                  : 'hover:border-[var(--color-accent)]/40'
              }`}
            >
              <span className="block font-medium text-[var(--color-ink)]">
                {v === 'ONLINE' ? 'Online' : 'In person'}
              </span>
              <span className="block text-xs text-[var(--color-muted)]">
                {v === 'ONLINE' ? 'Discord, stream, LAN-less' : 'Venue with an address'}
              </span>
            </button>
          ))}
        </div>
        {venueType && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ev-venue-name">
                {venueType === 'ONLINE' ? 'Platform / server name' : 'Venue name'}
              </Label>
              <Input
                id="ev-venue-name"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder={venueType === 'ONLINE' ? 'Discord — Bracket Arena' : 'Convention Center Hall B'}
              />
            </div>
            {venueType === 'PHYSICAL' ? (
              <div>
                <Label htmlFor="ev-venue-address">Address</Label>
                <Input
                  id="ev-venue-address"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="123 Main St, City"
                />
              </div>
            ) : null}
            <div className={venueType === 'ONLINE' ? '' : 'sm:col-span-2'}>
              <Label htmlFor="ev-venue-url">{venueType === 'ONLINE' ? 'Join link' : 'Website'}</Label>
              <Input
                id="ev-venue-url"
                type="url"
                value={venueUrl}
                onChange={(e) => setVenueUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Media</h2>
        <div>
          <Label htmlFor="ev-stream">Stream URL</Label>
          <Input
            id="ev-stream"
            type="url"
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            placeholder="https://twitch.tv/yourchannel or a YouTube link"
          />
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            YouTube and Twitch links embed a live player on the event page.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageUrlField
            label="Logo"
            hint="Square, at least 256×256."
            value={logoUrl}
            onChange={setLogoUrl}
            token={token ?? undefined}
          />
          <ImageUrlField
            label="Banner"
            hint="Wide, 1600×500 recommended."
            value={bannerUrl}
            onChange={setBannerUrl}
            token={token ?? undefined}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Visibility</h2>
        {communities && communities.length > 0 && (
          <div>
            <Label>Host community (optional)</Label>
            <Select
              value={communityId}
              onChange={setCommunityId}
              options={[
                { value: '', label: 'No community' },
                ...communities.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Community collaborators can help manage the event; attached tournaments inherit the community.
            </p>
          </div>
        )}
        <Toggle
          checked={isPublic}
          onChange={setIsPublic}
          label="Listed publicly"
          hint="Show in the /events directory once published. Unlisted events are still reachable via their link."
        />
      </section>

      {shownError && <p className="text-sm text-[var(--color-danger)]">{shownError}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
