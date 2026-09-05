'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, MailWarning } from 'lucide-react';
import { ACCOUNT_TIMEZONES, LOCALE_OPTIONS } from '@bracket/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AccountUser } from '@/lib/types-platform';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Pill } from '@/components/registrations/registration-ui';

export function AccountPanel() {
  const { token, refreshUser } = useAuth();
  const accountQuery = useQuery({
    queryKey: ['account'],
    enabled: !!token,
    queryFn: () => api<AccountUser>('/account', { token }),
  });
  const account = accountQuery.data;

  const [timezone, setTimezone] = useState('UTC');
  const [locale, setLocale] = useState('en');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (account && !hydrated) {
      setTimezone(account.timezone || 'UTC');
      setLocale(account.locale || 'en');
      setHydrated(true);
    }
  }, [account, hydrated]);

  const browserTz =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  const tzOptions = Array.from(
    new Set([...(browserTz ? [browserTz] : []), ...ACCOUNT_TIMEZONES, timezone]),
  ).map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }));

  const save = useMutation({
    mutationFn: () =>
      api<AccountUser>('/account', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ timezone, locale }),
      }),
    onSuccess: async () => {
      toast.success('Account settings saved');
      await accountQuery.refetch();
      await refreshUser();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resend = useMutation({
    mutationFn: () => api('/account/verification/send', { method: 'POST', token }),
    onSuccess: () => toast.success('Verification email sent — check your inbox'),
    onError: (err: Error) => toast.error(err.message),
  });

  if (accountQuery.isLoading || !account) {
    return <p className="text-sm text-[var(--color-muted)]">Loading account…</p>;
  }

  const dirty = timezone !== (account.timezone || 'UTC') || locale !== (account.locale || 'en');

  return (
    <div className="space-y-6">
      <section className="gaming-card rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">Email</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Input value={account.email} readOnly className="max-w-sm opacity-80" />
          {account.emailVerified ? (
            <Pill tone="ok">
              <BadgeCheck className="size-3.5" /> Verified
            </Pill>
          ) : (
            <Pill tone="warn">
              <MailWarning className="size-3.5" /> Not verified
            </Pill>
          )}
        </div>
        {!account.emailVerified && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--color-muted)]">
            <span>Some tournaments require a verified email before you can sign up.</span>
            <Button
              type="button"
              variant="secondary"
              className="h-8 text-xs"
              disabled={resend.isPending}
              onClick={() => resend.mutate()}
            >
              Resend verification
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Changing your email address is not available yet — contact support if you need it moved.
        </p>
      </section>

      <form
        className="gaming-card space-y-5 rounded-2xl p-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="font-display text-lg font-semibold">Preferences</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Timezone</Label>
            <Select value={timezone} onChange={(v) => v && setTimezone(v)} options={tzOptions} />
            {browserTz && browserTz !== timezone && (
              <button
                type="button"
                className="mt-1 text-xs text-[var(--color-accent)] hover:underline"
                onClick={() => setTimezone(browserTz)}
              >
                Use browser timezone ({browserTz})
              </button>
            )}
          </div>
          <div>
            <Label>Language</Label>
            <Select
              value={locale}
              onChange={(v) => v && setLocale(v)}
              options={LOCALE_OPTIONS.map((l) => ({ value: l.value, label: l.label }))}
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">More languages coming soon.</p>
          </div>
        </div>
        <dl className="grid gap-3 border-t border-[var(--color-line)] pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Plan</dt>
            <dd className="font-medium">
              Free forever
              {account.planExpiresAt ? (
                <span className="block text-xs text-[var(--color-muted)]">
                  until {new Date(account.planExpiresAt).toLocaleDateString()}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Role</dt>
            <dd className="font-medium">{account.role === 'ADMIN' ? 'Site admin' : 'Member'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Member since</dt>
            <dd className="font-medium">
              {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}
            </dd>
          </div>
        </dl>
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save preferences'}
          </Button>
        </div>
      </form>
    </div>
  );
}
