import { isSameDay } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { COMMON_TIMEZONES } from '@bracket/shared';

/** Safe wrapper — falls back to UTC when the zone is unknown. */
export function fmtInTz(
  date: string | Date | null | undefined,
  timeZone: string | null | undefined,
  pattern: string,
): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  try {
    return formatInTimeZone(d, timeZone || 'UTC', pattern);
  } catch {
    return formatInTimeZone(d, 'UTC', pattern);
  }
}

/** "Sat, Sep 12 · 10:00 AM – Sun, Sep 13 · 6:00 PM (Asia/Dhaka)". */
export function formatEventDateRange(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
  timeZone: string,
  opts: { withZone?: boolean; short?: boolean } = {},
): string {
  if (!startAt && !endAt) return 'Dates TBA';
  const zoneSuffix = opts.withZone ? ` (${shortZone(timeZone)})` : '';
  const dayPattern = opts.short ? 'MMM d' : 'EEE, MMM d';
  if (startAt && endAt) {
    const s = new Date(startAt);
    const e = new Date(endAt);
    if (isSameDay(s, e)) {
      return `${fmtInTz(s, timeZone, dayPattern)} · ${fmtInTz(s, timeZone, 'h:mm a')} – ${fmtInTz(e, timeZone, 'h:mm a')}${zoneSuffix}`;
    }
    return `${fmtInTz(s, timeZone, dayPattern)} – ${fmtInTz(e, timeZone, `${dayPattern}, yyyy`)}${zoneSuffix}`;
  }
  const single = startAt ?? endAt!;
  return `${fmtInTz(single, timeZone, `${dayPattern}, yyyy · h:mm a`)}${zoneSuffix}`;
}

export function shortZone(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Options for the timezone select — includes the browser zone if not in the list. */
export function timezoneOptions(extra?: string) {
  const zones = new Set<string>(COMMON_TIMEZONES);
  if (extra) zones.add(extra);
  return Array.from(zones)
    .sort((a, b) => (a === 'UTC' ? -1 : b === 'UTC' ? 1 : a.localeCompare(b)))
    .map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));
}

/** Convert an ISO string into a `datetime-local` value in the given zone. */
export function isoToLocalInput(
  iso: string | null | undefined,
  timeZone: string,
): string {
  if (!iso) return '';
  return fmtInTz(iso, timeZone, "yyyy-MM-dd'T'HH:mm");
}

/** Convert a `datetime-local` value (interpreted in `timeZone`) to ISO UTC. */
export function localInputToIso(
  value: string,
  timeZone: string,
): string | null {
  if (!value) return null;
  try {
    const d = fromZonedTime(value, timeZone || 'UTC');
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    const naive = new Date(value);
    return Number.isNaN(naive.getTime()) ? null : naive.toISOString();
  }
}

export const ORDER_STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-[color-mix(in_srgb,var(--color-ok)_18%,transparent)] text-[var(--color-ok)] border-[var(--color-ok)]/40',
  PENDING: 'bg-[color-mix(in_srgb,#fbbf24_18%,transparent)] text-[#fbbf24] border-[#fbbf24]/40',
  REFUNDED: 'bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-line)]',
  CANCELLED: 'bg-[color-mix(in_srgb,var(--color-danger)_16%,transparent)] text-[var(--color-danger)] border-[var(--color-danger)]/40',
};

export const TOURNAMENT_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-line)]',
  ACTIVE: 'bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)] text-[var(--color-accent)] border-[var(--color-accent)]/40',
  COMPLETED: 'bg-[color-mix(in_srgb,var(--color-ok)_18%,transparent)] text-[var(--color-ok)] border-[var(--color-ok)]/40',
};

export const TOURNAMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Upcoming',
  ACTIVE: 'In progress',
  COMPLETED: 'Completed',
};

export function eventQueryKeys(slug: string, id?: string) {
  return {
    detail: ['event', slug] as const,
    dashboard: ['event-dashboard', id] as const,
    tickets: ['event-tickets', id] as const,
    orders: ['event-orders', id] as const,
    admins: ['event-admins', id] as const,
    checkInStats: ['event-checkin-stats', id] as const,
    tournaments: ['event-tournaments', id] as const,
  };
}
