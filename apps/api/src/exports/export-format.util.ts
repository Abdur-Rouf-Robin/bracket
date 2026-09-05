import { formatInTimeZone } from 'date-fns-tz';
import { resolveRoundLabel, type TournamentSettings } from '@bracket/shared';
import type { ExportMatch, ExportTournament } from './public-access.service';

export function stageLabel(side: string, settings?: TournamentSettings): string {
  const names = settings?.bracketNames ?? {};
  switch (side) {
    case 'GROUP':
      return 'Group stage';
    case 'WINNERS':
      return names.winners || 'Winners';
    case 'LOSERS':
      return names.losers || 'Losers';
    case 'FINAL':
      return names.final || 'Final';
    case 'GRAND_FINAL':
      return 'Grand final';
    case 'SWISS':
      return 'Swiss';
    default:
      return side;
  }
}

/** Number of rounds in the winners bracket (used for "Quarter-finals" etc). */
export function knockoutRoundCount(matches: Pick<ExportMatch, 'bracketSide' | 'round'>[]): number {
  const rounds = matches
    .filter((m) => m.bracketSide === 'WINNERS')
    .map((m) => m.round);
  const finals = matches.filter((m) => m.bracketSide === 'FINAL' || m.bracketSide === 'GRAND_FINAL');
  const max = rounds.length ? Math.max(...rounds) : 0;
  return max + (finals.length ? 1 : 0);
}

export function roundLabelFor(
  match: Pick<ExportMatch, 'bracketSide' | 'round'>,
  settings: TournamentSettings,
  totalKnockoutRounds: number,
): string {
  if (match.bracketSide === 'GROUP' || match.bracketSide === 'SWISS') {
    const leg = match.round > 100 ? Math.floor(match.round / 100) + 1 : 1;
    const base = match.round > 100 ? match.round % 100 : match.round;
    return leg > 1 ? `Round ${base} (leg ${leg})` : `Round ${base}`;
  }
  if (match.bracketSide === 'LOSERS') return `Losers round ${match.round}`;
  if (match.bracketSide === 'GRAND_FINAL') return 'Grand final';
  if (match.bracketSide === 'FINAL') return 'Final';
  return resolveRoundLabel(match.round, settings, totalKnockoutRounds || undefined);
}

export function formatScheduled(
  date: Date | null | undefined,
  tz: string,
  pattern = 'yyyy-MM-dd HH:mm',
): string {
  if (!date) return '';
  try {
    return formatInTimeZone(date, tz || 'UTC', pattern);
  } catch {
    return date.toISOString();
  }
}

export function formatSets(sets: unknown): string {
  if (!Array.isArray(sets)) return '';
  return sets
    .map((s) => {
      const row = s as { home?: number; away?: number };
      return `${row.home ?? 0}-${row.away ?? 0}`;
    })
    .join(' ');
}

export function scoreText(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function matchStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'READY':
      return 'Ready';
    case 'IN_PROGRESS':
      return 'In progress';
    case 'COMPLETED':
      return 'Completed';
    default:
      return status;
  }
}

export function stationName(m: ExportMatch): string {
  return m.stationRef?.name ?? m.station ?? '';
}

export function safeFilename(s: string): string {
  return s.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').toLowerCase();
}

export function tournamentTz(t: ExportTournament): string {
  return t.timezone || 'UTC';
}
