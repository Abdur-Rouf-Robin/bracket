// Contracts for the standings-config feature area (Score7-style standings
// customization). Pure constants + helpers; the Zod enums live in
// `tournamentSettingsSchema` (index.ts) and must stay in sync with these lists.

export const STANDINGS_CRITERIA = [
  'POINTS',
  'WINS',
  'HEAD_TO_HEAD',
  'SCORE_DIFF',
  'SCORE_FOR',
  'SCORE_AGAINST',
  'SETS_WON',
  'SET_DIFF',
  'GAMES_PLAYED',
  'BUCHHOLZ',
  'MEDIAN_BUCHHOLZ',
  'SONNEBORN_BERGER',
  'FAIR_PLAY',
  'NET_RUN_RATE',
  'DRAW_LOTS',
] as const;

export type StandingsCriterion = (typeof STANDINGS_CRITERIA)[number];

export const STANDINGS_COLUMNS = [
  'RANK',
  'TEAM',
  'PLAYED',
  'WINS',
  'DRAWS',
  'LOSSES',
  'SCORE_FOR',
  'SCORE_AGAINST',
  'SCORE_DIFF',
  'SETS',
  'POINTS',
  'ADJUSTMENTS',
  'FORM',
  'NET_RUN_RATE',
  'BUCHHOLZ',
  'FAIR_PLAY',
] as const;

export type StandingsColumn = (typeof STANDINGS_COLUMNS)[number];

export const DEFAULT_STANDINGS_CRITERIA: StandingsCriterion[] = [
  'POINTS',
  'SCORE_DIFF',
  'SCORE_FOR',
  'HEAD_TO_HEAD',
];

export const DEFAULT_STANDINGS_COLUMNS: StandingsColumn[] = [
  'RANK',
  'TEAM',
  'PLAYED',
  'WINS',
  'DRAWS',
  'LOSSES',
  'SCORE_FOR',
  'SCORE_AGAINST',
  'SCORE_DIFF',
  'POINTS',
];

export type StandingsCriterionMeta = {
  label: string;
  /** Short lower-case phrase used in "Ranked by points, then …" sentences. */
  phrase: string;
  description: string;
  /** Criteria that only make sense for a subset of formats / sports. */
  hint?: string;
};

export const STANDINGS_CRITERIA_META: Record<StandingsCriterion, StandingsCriterionMeta> = {
  POINTS: {
    label: 'Points',
    phrase: 'points',
    description: 'Tournament points from wins, draws, losses and manual adjustments.',
  },
  WINS: {
    label: 'Wins',
    phrase: 'wins',
    description: 'Total number of matches won.',
  },
  HEAD_TO_HEAD: {
    label: 'Head-to-head',
    phrase: 'head-to-head record',
    description:
      'Mini-table using only the matches between the tied teams: points, then score difference, then score for.',
  },
  SCORE_DIFF: {
    label: 'Score difference',
    phrase: 'score difference',
    description: 'Goals / points scored minus conceded across all matches.',
  },
  SCORE_FOR: {
    label: 'Score for',
    phrase: 'score for',
    description: 'Total goals / points scored.',
  },
  SCORE_AGAINST: {
    label: 'Score against',
    phrase: 'fewest conceded',
    description: 'Fewer goals / points conceded ranks higher.',
  },
  SETS_WON: {
    label: 'Sets won',
    phrase: 'sets won',
    description: 'Total sets won (set-based scoring).',
    hint: 'Set-based sports',
  },
  SET_DIFF: {
    label: 'Set difference',
    phrase: 'set difference',
    description: 'Sets won minus sets lost (set-based scoring).',
    hint: 'Set-based sports',
  },
  GAMES_PLAYED: {
    label: 'Games played',
    phrase: 'fewer games played',
    description: 'With equal points, the team that has played fewer matches ranks higher.',
  },
  BUCHHOLZ: {
    label: 'Buchholz',
    phrase: 'Buchholz score',
    description: 'Sum of the points of every opponent faced (strength of schedule).',
    hint: 'Swiss',
  },
  MEDIAN_BUCHHOLZ: {
    label: 'Median Buchholz',
    phrase: 'median Buchholz',
    description: "Buchholz with the highest and lowest opponent score removed.",
    hint: 'Swiss',
  },
  SONNEBORN_BERGER: {
    label: 'Sonneborn-Berger',
    phrase: 'Sonneborn-Berger',
    description:
      'Sum of the points of opponents you beat plus half the points of opponents you drew with.',
    hint: 'Swiss / chess',
  },
  FAIR_PLAY: {
    label: 'Fair play',
    phrase: 'fair play',
    description: 'Fewer discipline points (cards) ranks higher.',
  },
  NET_RUN_RATE: {
    label: 'Net run rate',
    phrase: 'net run rate',
    description: 'Cricket net run rate.',
    hint: 'Cricket',
  },
  DRAW_LOTS: {
    label: 'Drawing of lots',
    phrase: 'drawing of lots',
    description: 'Deterministic random draw seeded by the tournament — same result every time.',
  },
};

export type StandingsColumnMeta = {
  label: string;
  /** Short header used in the table. */
  short: string;
  description: string;
  /** Columns that cannot be hidden. */
  locked?: boolean;
};

export const STANDINGS_COLUMNS_META: Record<StandingsColumn, StandingsColumnMeta> = {
  RANK: { label: 'Rank', short: '#', description: 'Position in the table.', locked: true },
  TEAM: { label: 'Team', short: 'Team', description: 'Team / participant name.', locked: true },
  PLAYED: { label: 'Played', short: 'P', description: 'Matches played.' },
  WINS: { label: 'Wins', short: 'W', description: 'Matches won.' },
  DRAWS: { label: 'Draws', short: 'D', description: 'Matches drawn.' },
  LOSSES: { label: 'Losses', short: 'L', description: 'Matches lost.' },
  SCORE_FOR: { label: 'Score for', short: 'GF', description: 'Goals / points scored.' },
  SCORE_AGAINST: { label: 'Score against', short: 'GA', description: 'Goals / points conceded.' },
  SCORE_DIFF: { label: 'Score difference', short: '+/-', description: 'Scored minus conceded.' },
  SETS: { label: 'Sets', short: 'Sets', description: 'Sets won – lost (set-based scoring).' },
  POINTS: { label: 'Points', short: 'Pts', description: 'Tournament points.' },
  ADJUSTMENTS: {
    label: 'Adjustments',
    short: 'Adj',
    description: 'Manual point corrections applied by the organizer.',
  },
  FORM: { label: 'Form', short: 'Form', description: 'Last five results.' },
  NET_RUN_RATE: { label: 'Net run rate', short: 'NRR', description: 'Cricket net run rate.' },
  BUCHHOLZ: { label: 'Buchholz', short: 'Bh', description: 'Sum of opponents’ points.' },
  FAIR_PLAY: { label: 'Fair play', short: 'FP', description: 'Discipline points (lower is better).' },
};

/** Criteria that only make sense for a given format / sport. */
export function relevantCriteriaFor(input: {
  format?: string | null;
  setBasedScoring?: boolean;
  isCricket?: boolean;
}): StandingsCriterion[] {
  return STANDINGS_CRITERIA.filter((c) => {
    if ((c === 'SETS_WON' || c === 'SET_DIFF') && !input.setBasedScoring) return false;
    if (c === 'NET_RUN_RATE' && !input.isCricket) return false;
    return true;
  });
}

/** Human sentence for the standings footnote, e.g. "Ranked by points, then score difference, then …". */
export function describeStandingsCriteria(
  primaryLabel: string,
  criteria: readonly StandingsCriterion[],
): string {
  const phrases = criteria
    .map((c) => STANDINGS_CRITERIA_META[c]?.phrase)
    .filter((p): p is string => !!p)
    .filter((p) => p.toLowerCase() !== primaryLabel.toLowerCase());
  if (!phrases.length) return `Ranked by ${primaryLabel}.`;
  return `Ranked by ${primaryLabel}, then ${phrases.join(', then ')}.`;
}

export type SetScoreInput = { home: number; away: number };

export type SetsSummary = {
  homeSetsWon: number;
  awaySetsWon: number;
  winner: 'home' | 'away' | null;
  /** `null` when the sets form a valid, decided series. */
  error: string | null;
};

/**
 * Client-side mirror of the engine's `resolveSetsResult` so forms can validate
 * before hitting the API. Required wins = ceil(bestOf / 2).
 */
export function summarizeSets(sets: SetScoreInput[], bestOf?: number | null): SetsSummary {
  let home = 0;
  let away = 0;
  const needed = bestOf && bestOf > 0 ? Math.ceil(bestOf / 2) : null;
  if (!sets.length) {
    return { homeSetsWon: 0, awaySetsWon: 0, winner: null, error: 'Enter at least one set' };
  }
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]!;
    if (s.home < 0 || s.away < 0) {
      return { homeSetsWon: home, awaySetsWon: away, winner: null, error: `Set ${i + 1}: scores cannot be negative` };
    }
    if (s.home === s.away) {
      return { homeSetsWon: home, awaySetsWon: away, winner: null, error: `Set ${i + 1} cannot be tied` };
    }
    if (needed != null && (home >= needed || away >= needed)) {
      return {
        homeSetsWon: home,
        awaySetsWon: away,
        winner: null,
        error: `Series was already decided after set ${i} — remove the extra set(s)`,
      };
    }
    if (s.home > s.away) home += 1;
    else away += 1;
  }
  if (needed != null) {
    if (sets.length > (bestOf ?? 0)) {
      return { homeSetsWon: home, awaySetsWon: away, winner: null, error: `Best of ${bestOf} allows at most ${bestOf} sets` };
    }
    if (home !== needed && away !== needed) {
      return {
        homeSetsWon: home,
        awaySetsWon: away,
        winner: null,
        error: `One side must win ${needed} set${needed === 1 ? '' : 's'} (best of ${bestOf})`,
      };
    }
  } else if (home === away) {
    return { homeSetsWon: home, awaySetsWon: away, winner: null, error: 'Sets are level — add the deciding set' };
  }
  return { homeSetsWon: home, awaySetsWon: away, winner: home > away ? 'home' : 'away', error: null };
}

/** "6-4 3-6 7-5" */
export function formatSets(sets: readonly SetScoreInput[] | null | undefined): string {
  return (sets ?? []).map((s) => `${s.home}-${s.away}`).join(' ');
}

/** Placement-match options that make sense for a bracket of `teamCount` participants. */
export function placementMatchOptions(
  teamCount: number,
): { value: number; label: string }[] {
  const options: { value: number; label: string }[] = [
    { value: 0, label: 'None' },
    { value: 3, label: '3rd place match' },
  ];
  if (teamCount >= 5) options.push({ value: 8, label: 'Placement matches through 8th' });
  if (teamCount >= 9) options.push({ value: 16, label: 'Placement matches through 16th' });
  return options;
}
