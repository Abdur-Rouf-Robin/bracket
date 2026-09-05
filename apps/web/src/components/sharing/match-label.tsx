import type { Match, Tournament } from '@/lib/types';

const SIDE_LABELS: Record<string, string> = {
  WINNERS: 'Winners',
  LOSERS: 'Losers',
  FINAL: 'Final',
  GRAND_FINAL: 'Grand final',
  GROUP: 'Group',
  SWISS: 'Swiss',
  KNOCKOUT: 'Knockout',
  PLACEMENT: 'Placement',
};

/** Human label like "Group A · R2", "Semifinal", "Losers R3". */
export function matchLabel(m: Match, tournament: Pick<Tournament, 'groups' | 'matches' | 'settings'>): string {
  const custom = ((tournament.settings ?? {}) as { roundNames?: Record<string, string> }).roundNames;
  if (m.bracketSide === 'GROUP') {
    const g = tournament.groups.find((x) => x.id === m.groupId);
    return `${g ? g.name : 'Group'} · R${m.round}`;
  }
  if (m.bracketSide === 'SWISS') return `Round ${m.round}`;
  if (m.bracketSide === 'GRAND_FINAL') return m.key.includes('reset') ? 'Grand final reset' : 'Grand final';
  if (m.isPlacement || m.key.includes('3rd')) return m.key.includes('3rd') || m.placementRank === 3 ? '3rd place' : `Placement ${m.placementRank ?? ''}`.trim();
  if (m.bracketSide === 'WINNERS' || m.bracketSide === 'FINAL' || m.bracketSide === 'KNOCKOUT') {
    if (custom?.[String(m.round)]) return custom[String(m.round)]!;
    const rounds = tournament.matches
      .filter((x) => x.bracketSide === m.bracketSide && !x.isPlacement)
      .reduce((max, x) => Math.max(max, x.round), 0);
    const left = rounds - m.round;
    if (left === 0) return 'Final';
    if (left === 1) return 'Semifinal';
    if (left === 2) return 'Quarterfinal';
    return `Round ${m.round}`;
  }
  return `${SIDE_LABELS[m.bracketSide] ?? m.bracketSide} R${m.round}`;
}

/** Sort matches by scheduled time when present, else by side/round/position. */
export function sortByRoundThenTime<T extends Match>(matches: T[]): T[] {
  return [...matches].sort((a, b) => {
    if (a.scheduledAt && b.scheduledAt) return a.scheduledAt.localeCompare(b.scheduledAt);
    if (a.scheduledAt) return -1;
    if (b.scheduledAt) return 1;
    return a.round - b.round || a.position - b.position;
  });
}

export function teamName(t: { name: string } | null | undefined, fallback = 'TBD'): string {
  return t?.name ?? fallback;
}
