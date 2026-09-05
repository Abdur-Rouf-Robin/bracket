'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  CreditCard,
  Hourglass,
  ListOrdered,
  Lock,
  MailCheck,
  Users,
} from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  COUNTRY_OPTIONS,
  SKILL_LEVELS,
  formatMoney,
  validateCustomFields,
} from '@bracket/shared';
import type {
  CustomFieldValue,
  RegistrationFieldDef,
  RegistrationFormConfig,
  RegistrationStatusValue,
} from '@bracket/shared';
import {
  FieldRow,
  Pill,
  StatusPill,
  formatDateTime,
} from '@/components/registrations/registration-ui';

type PlayerDraft = { name: string };

type StatusResponse = {
  id: string;
  tournament: { id: string; slug: string; name: string; startAt: string | null };
  teamName: string;
  status: RegistrationStatusValue;
  waitlistPosition: number | null;
  paymentStatus: 'FREE' | 'UNPAID' | 'PAID' | 'REFUNDED';
  amountCents: number;
  currency: string;
  email: string | null;
  team: { id: string; name: string; checkedIn: boolean; withdrawn: boolean } | null;
  createdAt: string;
  checkIn: { required: boolean; opensAt: string | null; closesAt: string | null; isOpenNow: boolean };
};

const CLOSED_COPY: Record<string, string> = {
  HOST_LIST: 'This tournament uses a host-managed participant list. Contact the organizer to join.',
  NOT_PUBLIC: 'The sign-up page for this tournament is not public.',
  COMPLETED: 'Registration is closed — the tournament has finished.',
  BRACKET_GENERATED: 'Registration is closed — the bracket has already been generated.',
  NOT_OPEN_YET: 'Registration has not opened yet.',
  CLOSED: 'Registration has closed.',
  FULL: 'The tournament is full.',
};

function calendarUrl(name: string, startAt: string | null, url: string) {
  if (!startAt) return null;
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: name,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: url,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function RegisterPageInner() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const search = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, token, loading: authLoading } = useAuth();

  const registrationParam = search.get('registration');
  const [viewRegistrationId, setViewRegistrationId] = useState<string | null>(registrationParam);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    if (search.get('paid') === '1') {
      toast.success('Payment received — thanks! Your registration is being confirmed.');
    } else if (search.get('cancelled') === '1') {
      toast('Checkout cancelled. You can pay later from this page.');
    }
    if (search.get('paid') || search.get('cancelled')) {
      const next = new URLSearchParams(search.toString());
      next.delete('paid');
      next.delete('cancelled');
      router.replace(`/t/${slug}/register${next.size ? `?${next.toString()}` : ''}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const configQuery = useQuery({
    queryKey: ['registration-config', slug, token ?? 'anon'],
    enabled: !authLoading,
    queryFn: () =>
      api<RegistrationFormConfig>(`/t/${slug}/registration`, { token: token ?? undefined }),
  });
  const config = configQuery.data;

  useEffect(() => {
    if (!viewRegistrationId && config?.viewer.existingRegistration) {
      setViewRegistrationId(config.viewer.existingRegistration.id);
    }
  }, [config, viewRegistrationId]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href={`/t/${slug}`}
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          ← Back to {config?.tournament.name ?? 'tournament'}
        </Link>

        {configQuery.isLoading && (
          <p className="mt-6 text-[var(--color-muted)]">Loading sign-up page…</p>
        )}
        {configQuery.error && (
          <p className="mt-6 text-[var(--color-danger)]">
            {configQuery.error instanceof Error
              ? configQuery.error.message
              : 'Could not load sign-up page'}
          </p>
        )}

        {config && (
          <>
            <Hero config={config} />
            {viewRegistrationId ? (
              <RegistrationStatusView
                slug={slug}
                registrationId={viewRegistrationId}
                config={config}
                token={token}
                userId={user?.id}
                initialCheckoutUrl={checkoutUrl}
                onWithdrawn={() => {
                  setViewRegistrationId(null);
                  setCheckoutUrl(null);
                  qc.invalidateQueries({ queryKey: ['registration-config', slug] });
                }}
              />
            ) : (
              <SignupForm
                slug={slug}
                config={config}
                token={token}
                onSubmitted={(id, url) => {
                  setCheckoutUrl(url);
                  setViewRegistrationId(id);
                  qc.invalidateQueries({ queryKey: ['registration-config', slug] });
                  qc.invalidateQueries({ queryKey: ['tournament', slug] });
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Hero({ config }: { config: RegistrationFormConfig }) {
  const t = config.tournament;
  return (
    <section className="gaming-card mt-4 overflow-hidden rounded-2xl p-6">
      <div className="flex flex-wrap items-center gap-5">
        {t.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.logoUrl}
            alt=""
            className="size-20 rounded-xl border border-[var(--color-line)] object-cover"
          />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-xl bg-[var(--color-accent)]/15 font-display text-2xl font-bold text-[var(--color-accent)]">
            {t.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Sign up
          </p>
          <h1 className="font-display truncate text-3xl font-bold">{t.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-muted)]">
            {t.game && <span>{t.game.name}</span>}
            {t.startAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {formatDateTime(t.startAt, t.timezone)}
                {t.timezone && t.timezone !== 'UTC' ? ` (${t.timezone})` : ''}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {config.approvedCount}/{config.maxParticipants} registered
              {config.waitlistCount > 0 ? ` · ${config.waitlistCount} waitlisted` : ''}
            </span>
          </div>
        </div>
      </div>
      <StatusBanner config={config} />
    </section>
  );
}

function StatusBanner({ config }: { config: RegistrationFormConfig }) {
  const existing = config.viewer.existingRegistration;
  if (existing) {
    return (
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-3 text-sm">
        <CheckCircle2 className="size-4 text-[var(--color-accent)]" />
        <span>You&apos;re already registered.</span>
        <StatusPill status={existing.status} waitlistPosition={existing.waitlistPosition} />
      </div>
    );
  }
  if (config.isOpen) {
    const full = config.spotsLeft <= 0;
    return (
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-ok)]/30 bg-[var(--color-ok)]/5 p-3 text-sm">
        <Pill tone={full ? 'warn' : 'ok'}>{full ? 'Waitlist open' : 'Registration open'}</Pill>
        <span className="text-[var(--color-muted)]">
          {full
            ? 'The tournament is full — you can join the waitlist.'
            : `${config.spotsLeft} spot${config.spotsLeft === 1 ? '' : 's'} left`}
          {config.registrationClosesAt
            ? ` · closes ${formatDateTime(config.registrationClosesAt, config.tournament.timezone)}`
            : ''}
        </span>
      </div>
    );
  }
  const reason = config.reason ?? 'CLOSED';
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[var(--color-line)] p-3 text-sm">
      <Lock className="size-4 text-[var(--color-muted)]" />
      <Pill tone={reason === 'NOT_OPEN_YET' ? 'info' : 'muted'}>
        {reason === 'NOT_OPEN_YET' ? 'Opens soon' : reason === 'FULL' ? 'Full' : 'Closed'}
      </Pill>
      <span className="text-[var(--color-muted)]">
        {CLOSED_COPY[reason]}
        {reason === 'NOT_OPEN_YET' && config.registrationOpensAt
          ? ` Opens ${formatDateTime(config.registrationOpensAt, config.tournament.timezone)}.`
          : ''}
      </span>
    </div>
  );
}

function SignupForm({
  slug,
  config,
  token,
  onSubmitted,
}: {
  slug: string;
  config: RegistrationFormConfig;
  token: string | null;
  onSubmitted: (registrationId: string, checkoutUrl: string | null) => void;
}) {
  const soloMode = config.playersPerTeam === 1 && !config.requireTeamRegistration;
  const starters = config.playersPerTeam;
  const subs = config.allowSubstitutes ? config.substituteSlots : 0;
  const showRoster = !soloMode;

  const [teamName, setTeamName] = useState('');
  const [players, setPlayers] = useState<PlayerDraft[]>(() =>
    Array.from({ length: showRoster ? starters : 0 }, () => ({ name: '' })),
  );
  const [captainIdx, setCaptainIdx] = useState(0);
  const [email, setEmail] = useState(config.viewer.email ?? '');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState(config.viewer.countryCode ?? '');
  const [skillLevel, setSkillLevel] = useState('');
  const [custom, setCustom] = useState<Record<string, CustomFieldValue>>({});
  const [acceptWaiver, setAcceptWaiver] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    if (config.viewer.email && !email) setEmail(config.viewer.email);
    if (config.viewer.countryCode && !countryCode) setCountryCode(config.viewer.countryCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.viewer.email, config.viewer.countryCode]);

  const countryOptions = useMemo(() => {
    const allowed = config.restrictByCountry && config.allowedCountries.length
      ? COUNTRY_OPTIONS.filter((c) => config.allowedCountries.includes(c.code))
      : COUNTRY_OPTIONS;
    return allowed.map((c) => ({ value: c.code, label: c.name }));
  }, [config.restrictByCountry, config.allowedCountries]);

  const waiver = config.waiverText?.trim() ?? '';
  const fee = config.entryFeeCents;

  const mutation = useMutation({
    mutationFn: async () => {
      const roster = showRoster
        ? players
            .map((p, i) => ({ name: p.name.trim(), isCaptain: i === captainIdx }))
            .filter((p) => p.name.length > 0)
        : [];
      return api<{ registration: { id: string }; checkoutUrl: string | null }>(
        `/t/${slug}/registrations`,
        {
          method: 'POST',
          token: token ?? undefined,
          body: JSON.stringify({
            teamName: teamName.trim(),
            players: roster,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            countryCode: countryCode || undefined,
            skillLevel: skillLevel || undefined,
            customFields: custom,
            acceptWaiver,
          }),
        },
      );
    },
    onSuccess: (res) => {
      toast.success(
        fee > 0 && res.checkoutUrl
          ? 'Registration saved — complete payment to confirm your spot.'
          : 'Registration submitted!',
      );
      onSubmitted(res.registration.id, res.checkoutUrl);
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.status === 403 && /verif/i.test(err.message)) {
        setNeedsVerification(true);
      }
      setError(err.message);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    const errors: Record<string, string> = {};
    if (!teamName.trim()) errors.teamName = soloMode ? 'Enter your name' : 'Enter a team name';
    if (!config.viewer.loggedIn && !email.trim()) errors.email = 'Email is required';
    if (showRoster) {
      const filled = players.filter((p) => p.name.trim()).length;
      if (config.requireTeamRegistration && filled < starters) {
        errors.players = `Enter at least ${starters} player name${starters === 1 ? '' : 's'}`;
      }
    }
    if (config.restrictByCountry && !countryCode) errors.countryCode = 'Select your country';
    if (config.collectSkillLevel && !skillLevel) errors.skillLevel = 'Select your skill level';
    const cf = validateCustomFields(config.registrationFields, custom);
    Object.assign(errors, cf.errors);
    if (waiver && !acceptWaiver) errors.acceptWaiver = 'Accept the waiver to continue';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError('Please fix the highlighted fields.');
      return;
    }
    mutation.mutate();
  }

  async function sendVerification() {
    try {
      await api('/account/verification/send', { method: 'POST', token: token ?? undefined });
      setVerificationSent(true);
      toast.success('Verification email sent — check your inbox.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send verification email');
    }
  }

  if (!config.isOpen) return null;

  if (config.requireVerifiedEmail && (!config.viewer.loggedIn || !config.viewer.emailVerified)) {
    return (
      <section className="gaming-card mt-6 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 size-5 text-[var(--color-accent)]" />
          <div>
            <h2 className="font-display text-lg font-semibold">Verified email required</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              The host only accepts registrations from accounts with a verified email address.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {!config.viewer.loggedIn ? (
                <>
                  <Link href={`/login?next=${encodeURIComponent(`/t/${slug}/register`)}`}>
                    <Button>Sign in</Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="secondary">Create account</Button>
                  </Link>
                </>
              ) : (
                <Button onClick={sendVerification} disabled={verificationSent}>
                  {verificationSent ? 'Email sent — check your inbox' : 'Send verification email'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="gaming-card mt-6 space-y-6 rounded-2xl p-6">
      <div>
        <h2 className="font-display text-lg font-semibold">
          {config.spotsLeft <= 0 ? 'Join the waitlist' : 'Your details'}
        </h2>
        <p className="mt-0.5 text-sm text-[var(--color-muted)]">
          {config.autoApprove && fee === 0
            ? 'Registrations are approved automatically.'
            : 'The host reviews each registration before it is confirmed.'}
        </p>
      </div>

      <FieldRow label={soloMode ? 'Your name' : 'Team name'}>
        <Input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          maxLength={80}
          placeholder={soloMode ? config.viewer.name ?? 'Display name' : 'e.g. Night Owls'}
          required
        />
        {fieldErrors.teamName && <FieldError>{fieldErrors.teamName}</FieldError>}
      </FieldRow>

      {showRoster && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--color-muted)]">
              Roster · {starters} starter{starters === 1 ? '' : 's'}
              {subs > 0 ? ` + up to ${subs} sub${subs === 1 ? '' : 's'}` : ''}
            </label>
            <span className="text-xs text-[var(--color-muted)]">Pick a captain</span>
          </div>
          <div className="space-y-2">
            {players.map((p, i) => {
              const isSub = i >= starters;
              return (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="captain"
                    title="Captain"
                    className="size-4 accent-[var(--color-accent)]"
                    checked={captainIdx === i}
                    onChange={() => setCaptainIdx(i)}
                  />
                  <Input
                    value={p.name}
                    onChange={(e) => {
                      const next = [...players];
                      next[i] = { name: e.target.value };
                      setPlayers(next);
                    }}
                    maxLength={80}
                    placeholder={isSub ? `Substitute ${i - starters + 1}` : `Player ${i + 1}`}
                    required={config.requireTeamRegistration && !isSub}
                  />
                  {isSub && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 shrink-0 px-2 text-xs text-[var(--color-danger)]"
                      onClick={() => {
                        setPlayers((prev) => prev.filter((_, j) => j !== i));
                        if (captainIdx === i) setCaptainIdx(0);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {players.length < starters + subs && (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 h-8 text-xs"
              onClick={() => setPlayers((prev) => [...prev, { name: '' }])}
            >
              + Add {players.length >= starters ? 'substitute' : 'player'}
            </Button>
          )}
          {fieldErrors.players && <FieldError>{fieldErrors.players}</FieldError>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow
          label="Email"
          hint={config.viewer.loggedIn ? 'Confirmation is sent to your account email.' : undefined}
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required={!config.viewer.loggedIn}
            readOnly={config.viewer.loggedIn && !!config.viewer.email}
            className={config.viewer.loggedIn && config.viewer.email ? 'opacity-70' : ''}
          />
          {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
        </FieldRow>
        <FieldRow label="Phone (optional)">
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 000 0000"
          />
        </FieldRow>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow
          label={config.restrictByCountry ? 'Country (region-locked)' : 'Country (optional)'}
          hint={
            config.restrictByCountry
              ? 'Only participants from the listed regions can register.'
              : undefined
          }
        >
          <Select
            value={countryCode}
            onChange={setCountryCode}
            options={countryOptions}
            placeholder="Select country"
          />
          {fieldErrors.countryCode && <FieldError>{fieldErrors.countryCode}</FieldError>}
        </FieldRow>
        {config.collectSkillLevel && (
          <FieldRow label="Skill level">
            <Select
              value={skillLevel}
              onChange={setSkillLevel}
              options={SKILL_LEVELS.map((s) => ({ value: s.value, label: s.label }))}
              placeholder="Select level"
            />
            {fieldErrors.skillLevel && <FieldError>{fieldErrors.skillLevel}</FieldError>}
          </FieldRow>
        )}
      </div>

      {config.registrationFields.length > 0 && (
        <div className="space-y-4 border-t border-[var(--color-line)] pt-4">
          <p className="text-sm font-semibold">Additional questions</p>
          {config.registrationFields.map((field) => (
            <CustomFieldInput
              key={field.id}
              field={field}
              value={custom[field.id]}
              error={fieldErrors[field.id]}
              onChange={(v) => setCustom((prev) => ({ ...prev, [field.id]: v }))}
            />
          ))}
        </div>
      )}

      {waiver && (
        <div className="border-t border-[var(--color-line)] pt-4">
          <p className="text-sm font-semibold">Waiver &amp; rules</p>
          <textarea
            readOnly
            value={waiver}
            className="field-textarea mt-2 h-40 resize-y font-mono text-xs leading-relaxed"
          />
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--color-accent)]"
              checked={acceptWaiver}
              onChange={(e) => setAcceptWaiver(e.target.checked)}
            />
            <span>I have read and accept the waiver above.</span>
          </label>
          {fieldErrors.acceptWaiver && <FieldError>{fieldErrors.acceptWaiver}</FieldError>}
        </div>
      )}

      {fee > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]/50 p-4 text-sm">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-[var(--color-accent)]" />
            <span className="font-medium">Entry fee</span>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold">{formatMoney(fee, config.currency)}</p>
            <p className="text-xs text-[var(--color-muted)]">Paid securely via Stripe after submit</p>
          </div>
        </div>
      )}

      {needsVerification && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
          <p className="font-medium">Verify your email to register</p>
          <Button type="button" className="mt-2 h-8 text-xs" onClick={sendVerification}>
            Send verification email
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? 'Submitting…'
            : config.spotsLeft <= 0
              ? 'Join waitlist'
              : fee > 0
                ? `Register & pay ${formatMoney(fee, config.currency)}`
                : 'Register'}
        </Button>
        {!config.viewer.loggedIn && (
          <p className="text-xs text-[var(--color-muted)]">
            Registering as a guest.{' '}
            <Link
              href={`/login?next=${encodeURIComponent(`/t/${slug}/register`)}`}
              className="text-[var(--color-accent)] hover:underline"
            >
              Sign in
            </Link>{' '}
            to manage your registration later.
          </p>
        )}
      </div>
    </form>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-[var(--color-danger)]">{children}</p>;
}

function CustomFieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: RegistrationFieldDef;
  value: CustomFieldValue | undefined;
  error?: string;
  onChange: (v: CustomFieldValue) => void;
}) {
  const label = `${field.label}${field.required ? ' *' : ''}`;
  if (field.type === 'checkbox') {
    return (
      <div>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--color-accent)]"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>
            {label}
            {field.helpText && (
              <span className="block text-xs text-[var(--color-muted)]">{field.helpText}</span>
            )}
          </span>
        </label>
        {error && <FieldError>{error}</FieldError>}
      </div>
    );
  }
  return (
    <FieldRow label={label} hint={field.helpText}>
      {field.type === 'textarea' ? (
        <textarea
          className="field-textarea min-h-24"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          maxLength={2000}
        />
      ) : field.type === 'select' ? (
        <Select
          value={typeof value === 'string' ? value : ''}
          onChange={(v) => onChange(v)}
          options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
          placeholder="Choose…"
        />
      ) : (
        <Input
          type={
            field.type === 'number'
              ? 'number'
              : field.type === 'email'
                ? 'email'
                : field.type === 'phone'
                  ? 'tel'
                  : field.type === 'url'
                    ? 'url'
                    : 'text'
          }
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) =>
            onChange(field.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)
          }
        />
      )}
      {error && <FieldError>{error}</FieldError>}
    </FieldRow>
  );
}

function RegistrationStatusView({
  slug,
  registrationId,
  config,
  token,
  userId,
  initialCheckoutUrl,
  onWithdrawn,
}: {
  slug: string;
  registrationId: string;
  config: RegistrationFormConfig;
  token: string | null;
  userId?: string;
  initialCheckoutUrl: string | null;
  onWithdrawn: () => void;
}) {
  const qc = useQueryClient();
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(initialCheckoutUrl);

  const statusQuery = useQuery({
    queryKey: ['registration-status', slug, registrationId],
    queryFn: () => api<StatusResponse>(`/t/${slug}/registrations/${registrationId}/status`),
    refetchInterval: (q) => (q.state.data?.paymentStatus === 'UNPAID' ? 5000 : false),
  });
  const s = statusQuery.data;

  const withdraw = useMutation({
    mutationFn: () => api(`/t/${slug}/registrations/mine`, { method: 'DELETE', token: token! }),
    onSuccess: () => {
      toast.success('Registration withdrawn.');
      qc.invalidateQueries({ queryKey: ['tournament', slug] });
      onWithdrawn();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const retryCheckout = useMutation({
    mutationFn: () =>
      api<{ checkoutUrl: string | null }>(`/t/${slug}/registrations/${registrationId}/checkout`, {
        method: 'POST',
        token: token!,
      }),
    onSuccess: (res) => {
      if (res.checkoutUrl) {
        setCheckoutUrl(res.checkoutUrl);
        window.location.href = res.checkoutUrl;
      } else {
        toast.error('Payments are not configured for this tournament yet.');
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (statusQuery.isLoading) {
    return <p className="mt-6 text-[var(--color-muted)]">Loading your registration…</p>;
  }
  if (!s) {
    return (
      <p className="mt-6 text-[var(--color-danger)]">
        {statusQuery.error instanceof Error ? statusQuery.error.message : 'Registration not found'}
      </p>
    );
  }

  const isOwnRegistration = !!userId && config.viewer.existingRegistration?.id === s.id;
  const unpaid = s.paymentStatus === 'UNPAID';
  const pageUrl = typeof window !== 'undefined' ? `${window.location.origin}/t/${slug}` : `/t/${slug}`;
  const calUrl = calendarUrl(s.tournament.name, s.tournament.startAt, pageUrl);

  let icon = <Hourglass className="size-10 text-amber-300" />;
  let headline = 'Awaiting host approval';
  let sub = 'The host will review your registration. We\u2019ll email you when it changes.';
  if (unpaid) {
    icon = <CreditCard className="size-10 text-amber-300" />;
    headline = 'Payment pending';
    sub = `Complete the ${formatMoney(s.amountCents, s.currency)} entry fee to confirm your spot.`;
  } else if (s.status === 'APPROVED') {
    icon = <CheckCircle2 className="size-10 text-[var(--color-ok)]" />;
    headline = "You're in!";
    sub = `${s.teamName} is confirmed for ${s.tournament.name}.`;
  } else if (s.status === 'WAITLISTED') {
    icon = <ListOrdered className="size-10 text-[var(--color-accent)]" />;
    headline = `Waitlisted #${s.waitlistPosition ?? '?'}`;
    sub = 'You\u2019ll be promoted automatically if a spot opens up.';
  } else if (s.status === 'REJECTED') {
    icon = <Lock className="size-10 text-[var(--color-danger)]" />;
    headline = 'Registration declined';
    sub = 'The host did not accept this registration.';
  } else if (s.status === 'WITHDRAWN') {
    icon = <Lock className="size-10 text-[var(--color-muted)]" />;
    headline = 'Withdrawn';
    sub = 'This registration was withdrawn.';
  }

  return (
    <section className="gaming-card mt-6 rounded-2xl p-6">
      <div className="flex flex-wrap items-start gap-4">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold">{headline}</h2>
            <StatusPill status={s.status} waitlistPosition={s.waitlistPosition} />
            {s.amountCents > 0 && (
              <Pill tone={s.paymentStatus === 'PAID' ? 'ok' : 'warn'}>
                {s.paymentStatus === 'PAID' ? 'Paid' : s.paymentStatus.toLowerCase()}
              </Pill>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{sub}</p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Participant</dt>
              <dd className="font-medium">{s.teamName}</dd>
            </div>
            {s.email && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Contact</dt>
                <dd className="font-medium">{s.email}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Submitted</dt>
              <dd className="font-medium">{formatDateTime(s.createdAt)}</dd>
            </div>
            {s.checkIn.required && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Check-in</dt>
                <dd className="font-medium">
                  {s.team?.checkedIn
                    ? 'Checked in'
                    : s.checkIn.isOpenNow
                      ? 'Open now — check in from the tournament page'
                      : s.checkIn.opensAt
                        ? `Opens ${formatDateTime(s.checkIn.opensAt, config.tournament.timezone)}`
                        : 'Required'}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {unpaid && (checkoutUrl ? (
          <a href={checkoutUrl}>
            <Button>Pay {formatMoney(s.amountCents, s.currency)}</Button>
          </a>
        ) : token ? (
          <Button onClick={() => retryCheckout.mutate()} disabled={retryCheckout.isPending}>
            {retryCheckout.isPending ? 'Opening checkout…' : `Pay ${formatMoney(s.amountCents, s.currency)}`}
          </Button>
        ) : null)}
        <Link href={`/t/${slug}`}>
          <Button variant={unpaid ? 'secondary' : 'primary'}>Back to tournament</Button>
        </Link>
        {calUrl && (
          <a href={calUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary">
              <CalendarPlus className="mr-1.5 size-4" /> Add to calendar
            </Button>
          </a>
        )}
        {isOwnRegistration && token && s.status !== 'WITHDRAWN' && s.status !== 'REJECTED' && (
          <Button
            variant="ghost"
            className="text-[var(--color-danger)]"
            disabled={withdraw.isPending}
            onClick={() => {
              if (confirm('Withdraw your registration from this tournament?')) withdraw.mutate();
            }}
          >
            Withdraw
          </Button>
        )}
      </div>
    </section>
  );
}

export default function TournamentRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen">
          <SiteHeader />
          <p className="p-8 text-[var(--color-muted)]">Loading…</p>
        </div>
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}
