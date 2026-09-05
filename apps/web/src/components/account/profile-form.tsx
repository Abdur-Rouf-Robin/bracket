'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { COUNTRY_OPTIONS, USERNAME_REGEX } from '@bracket/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AccountUser } from '@/lib/types-platform';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ImageUrlField } from '@/components/image-url-field';
import { Avatar } from '@/components/account/avatar';

export function ProfileForm() {
  const { token, refreshUser } = useAuth();
  const accountQuery = useQuery({
    queryKey: ['account'],
    enabled: !!token,
    queryFn: () => api<AccountUser>('/account', { token }),
  });
  const account = accountQuery.data;

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (account && !hydrated) {
      setName(account.name ?? '');
      setUsername(account.username ?? '');
      setAvatarUrl(account.avatarUrl ?? '');
      setBio(account.bio ?? '');
      setCountryCode(account.countryCode ?? '');
      setHydrated(true);
    }
  }, [account, hydrated]);

  const normalizedUsername = username.trim().toLowerCase();
  const usernameChanged = normalizedUsername !== (account?.username ?? '');
  const usernameValid = !normalizedUsername || USERNAME_REGEX.test(normalizedUsername);

  const availability = useQuery({
    queryKey: ['username-available', normalizedUsername],
    enabled: !!token && usernameChanged && usernameValid && normalizedUsername.length >= 3,
    staleTime: 10_000,
    queryFn: () =>
      api<{ available: boolean; reason: string | null }>(
        `/account/username-available?username=${encodeURIComponent(normalizedUsername)}`,
        { token },
      ),
  });

  const save = useMutation({
    mutationFn: () =>
      api<AccountUser>('/account', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          name: name.trim(),
          username: normalizedUsername || null,
          avatarUrl: avatarUrl.trim() || null,
          bio: bio.trim() || null,
          countryCode: countryCode || null,
        }),
      }),
    onSuccess: async () => {
      toast.success('Profile saved');
      await accountQuery.refetch();
      await refreshUser();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (accountQuery.isLoading || !account) {
    return <p className="text-sm text-[var(--color-muted)]">Loading profile…</p>;
  }

  const dirty =
    name.trim() !== account.name ||
    normalizedUsername !== (account.username ?? '') ||
    avatarUrl.trim() !== (account.avatarUrl ?? '') ||
    bio.trim() !== (account.bio ?? '') ||
    (countryCode || '') !== (account.countryCode ?? '');

  return (
    <form
      className="gaming-card space-y-5 rounded-2xl p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!usernameValid) {
          toast.error('Username must be 3–24 lowercase letters, numbers or underscores');
          return;
        }
        if (usernameChanged && availability.data && !availability.data.available) {
          toast.error(availability.data.reason ?? 'Username unavailable');
          return;
        }
        save.mutate();
      }}
    >
      <div className="flex items-center gap-4">
        <Avatar name={name || account.name} src={avatarUrl || null} size="lg" />
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">{name || account.name}</p>
          <p className="text-sm text-[var(--color-muted)]">
            {normalizedUsername ? (
              <Link href={`/u/${normalizedUsername}`} className="text-[var(--color-accent)] hover:underline">
                @{normalizedUsername}
              </Link>
            ) : (
              'Pick a username to get a public profile page'
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Display name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
        </div>
        <div>
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-2 text-sm text-[var(--color-muted)]">@</span>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              maxLength={24}
              className="pl-7"
              placeholder="yourname"
              autoComplete="off"
            />
            {usernameChanged && normalizedUsername && (
              <span className="absolute right-3 top-2.5">
                {!usernameValid ? (
                  <X className="size-4 text-[var(--color-danger)]" />
                ) : availability.isFetching ? (
                  <span className="text-xs text-[var(--color-muted)]">…</span>
                ) : availability.data?.available ? (
                  <Check className="size-4 text-[var(--color-ok)]" />
                ) : availability.data ? (
                  <X className="size-4 text-[var(--color-danger)]" />
                ) : null}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {!usernameValid
              ? '3–24 lowercase letters, numbers or underscores.'
              : usernameChanged && availability.data && !availability.data.available
                ? availability.data.reason
                : `Your public profile: /u/${normalizedUsername || 'username'}`}
          </p>
        </div>
      </div>

      <ImageUrlField
        label="Avatar"
        hint="Square images look best. Upload or paste a URL."
        value={avatarUrl}
        onChange={setAvatarUrl}
        token={token ?? undefined}
      />

      <div>
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          className="field-textarea min-h-24"
          value={bio}
          maxLength={300}
          placeholder="Tell other players a bit about yourself…"
          onChange={(e) => setBio(e.target.value)}
        />
        <p className="mt-1 text-right text-xs text-[var(--color-muted)]">{bio.length}/300</p>
      </div>

      <div className="sm:max-w-xs">
        <Label>Country</Label>
        <Select
          value={countryCode}
          onChange={setCountryCode}
          options={COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.name }))}
          placeholder="Not set"
        />
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Used for region-locked tournaments.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-line)] pt-4">
        {dirty && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setHydrated(false);
            }}
          >
            Discard
          </Button>
        )}
        <Button type="submit" disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}
