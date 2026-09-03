import type { TournamentSettings } from './index';

export function defaultRoundLabel(round: number, totalRounds?: number): string {
  if (totalRounds) {
    const teamsLeft = 2 ** (totalRounds - round + 1);
    if (teamsLeft <= 2) return 'Final';
    if (teamsLeft === 4) return 'Semi-finals';
    if (teamsLeft === 8) return 'Quarter-finals';
    if (teamsLeft >= 16) return `Round of ${teamsLeft}`;
  }
  return `Round ${round}`;
}

/** Resolve display label for a bracket round using tournament settings. */
export function resolveRoundLabel(
  round: number,
  settings?: Pick<TournamentSettings, 'showCustomRoundLabels' | 'roundLabels'> | null,
  totalRounds?: number,
): string {
  if (settings?.showCustomRoundLabels && settings.roundLabels?.[String(round)]) {
    return settings.roundLabels[String(round)]!;
  }
  return defaultRoundLabel(round, totalRounds);
}
