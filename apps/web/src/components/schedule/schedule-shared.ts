import { formatInTimeZone } from 'date-fns-tz';
import type { ScheduleMatchDto } from '@bracket/shared';
import { BRACKET_SIDE_LABELS } from '@bracket/shared';
import { API_URL } from '@/lib/api';

/** Query keys are prefixed with ['tournament', slug] so useTournamentLive invalidates them. */
export const scheduleKeys = {
  schedule: (slug: string, auth: boolean) => ['tournament', slug, 'schedule', auth ? 'auth' : 'anon'] as const,
  stations: (slug: string, mode: string) => ['tournament', slug, 'stations', mode] as const,
  queue: (slug: string) => ['tournament', slug, 'station-queue'] as const,
  referees: (slug: string) => ['tournament', slug, 'referees'] as const,
  config: (slug: string) => ['tournament', slug, 'schedule-config'] as const,
};

export function icsUrl(slug: string) {
  return `${API_URL}/t/${slug}/schedule.ics`;
}

export function safeTz(tz: string | null | undefined): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

export function fmtTime(iso: string | null | undefined, tz: string, pattern = 'HH:mm') {
  if (!iso) return '—';
  try {
    return formatInTimeZone(new Date(iso), safeTz(tz), pattern);
  } catch {
    return '—';
  }
}

export function fmtDateTime(iso: string | null | undefined, tz: string) {
  return fmtTime(iso, tz, 'EEE d MMM HH:mm');
}

/** YYYY-MM-DD → "Sat 6 Jun" (date keys are already in the tournament tz). */
export function fmtDayKey(date: string, pattern = 'EEE d MMM') {
  try {
    return formatInTimeZone(new Date(`${date}T12:00:00Z`), 'UTC', pattern);
  } catch {
    return date;
  }
}

export function dayKeyOf(iso: string, tz: string) {
  return fmtTime(iso, tz, 'yyyy-MM-dd');
}

export function roundLabel(m: Pick<ScheduleMatchDto, 'round' | 'bracketSide' | 'groupName'>) {
  const side = BRACKET_SIDE_LABELS[m.bracketSide] ?? m.bracketSide;
  if (m.bracketSide === 'GROUP') {
    return `${m.groupName ?? 'Group'} · R${m.round}`;
  }
  if (m.bracketSide === 'FINAL' || m.bracketSide === 'GRAND_FINAL') return side;
  return `${side} R${m.round}`;
}

export function teamName(t: { name: string } | null | undefined) {
  return t?.name ?? 'TBD';
}

export function statusClasses(status: string) {
  switch (status) {
    case 'READY':
      return 'border-[var(--color-accent)]/60 bg-[color-mix(in_srgb,var(--color-accent)_10%,var(--color-card))]';
    case 'COMPLETED':
      return 'border-[var(--color-line)] bg-[var(--color-surface)] opacity-80';
    default:
      return 'border-[var(--color-line)] bg-[var(--color-card)]';
  }
}

export function statusBadge(status: string) {
  switch (status) {
    case 'READY':
      return 'badge badge-accent';
    case 'COMPLETED':
      return 'badge badge-neutral';
    default:
      return 'badge badge-neutral';
  }
}

export function scoreLine(m: ScheduleMatchDto) {
  if (m.status !== 'COMPLETED' || m.homeScore == null || m.awayScore == null) return null;
  return `${m.homeScore}–${m.awayScore}`;
}

export const STAGE_OPTIONS = [
  { value: '', label: 'All stages' },
  { value: 'GROUP', label: 'Groups' },
  { value: 'SWISS', label: 'Swiss' },
  { value: 'WINNERS', label: 'Winners bracket' },
  { value: 'LOSERS', label: 'Losers bracket' },
  { value: 'FINAL', label: 'Final' },
  { value: 'GRAND_FINAL', label: 'Grand final' },
];

export function conflictLabel(kind: string) {
  switch (kind) {
    case 'TEAM_OVERLAP':
      return 'Team double-booked';
    case 'TEAM_REST':
      return 'Not enough rest';
    case 'STATION_OVERLAP':
      return 'Station double-booked';
    case 'REFEREE_OVERLAP':
      return 'Referee double-booked';
    case 'DEPENDENCY_ORDER':
      return 'Before feeder match';
    default:
      return kind;
  }
}

export function toDatetimeLocal(iso: string | null | undefined, tz: string) {
  if (!iso) return '';
  return fmtTime(iso, tz, "yyyy-MM-dd'T'HH:mm");
}
