import {
  generateDoubleElimination,
  generateGroupsKnockout,
  generateRoundRobin,
  generateSingleElimination,
  generateSwiss,
  type EngineGroup,
  type EngineTeam,
  type GeneratedMatch,
} from '@bracket/bracket-engine';

export type PreviewFormat =
  | 'SINGLE_ELIMINATION'
  | 'DOUBLE_ELIMINATION'
  | 'ROUND_ROBIN'
  | 'SWISS'
  | 'GROUPS_KNOCKOUT'
  | 'FREE_FOR_ALL'
  | 'LEADERBOARD'
  | 'RACING';

export const PREVIEW_FORMAT_OPTIONS: { value: PreviewFormat; label: string }[] = [
  { value: 'SINGLE_ELIMINATION', label: 'Single elimination' },
  { value: 'DOUBLE_ELIMINATION', label: 'Double elimination' },
  { value: 'ROUND_ROBIN', label: 'Round robin' },
  { value: 'SWISS', label: 'Swiss' },
  { value: 'GROUPS_KNOCKOUT', label: 'Groups + knockout' },
];

/** Maps a preview format to the API `TournamentFormat` used when saving. */
export function apiFormatFor(format: PreviewFormat): string {
  switch (format) {
    case 'RACING':
      return 'SINGLE_RACE';
    default:
      return format;
  }
}

export type PreviewOptions = {
  randomize?: boolean;
  thirdPlace?: boolean;
  bracketReset?: boolean;
  groupCount?: number;
  advancePerGroup?: number;
  meetings?: number;
  swissRounds?: number;
  seed?: number;
};

export type PreviewResult = {
  format: PreviewFormat;
  teams: EngineTeam[];
  groups: EngineGroup[];
  matches: GeneratedMatch[];
  /** Number of scheduled matches for formats without a fixed tree (Swiss). */
  totalMatchEstimate: number;
};

export const SAMPLE_TEAMS = [
  'Northside FC',
  'Riverbank United',
  'Iron Wolves',
  'Harbor Kings',
  'Summit Rovers',
  'Golden Foxes',
  'Delta Storm',
  'Crescent Eagles',
];

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseParticipants(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const name = line.replace(/^\s*\d+[.)]\s*/, '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function toEngineTeams(names: string[], randomize = false, seed = Date.now()): EngineTeam[] {
  const list = names.map((name, i) => ({ id: `t${i + 1}`, name, seed: i + 1 }));
  if (!randomize) return list;
  const rnd = mulberry(seed);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list.map((t, i) => ({ ...t, seed: i + 1 }));
}

export function matchCount(format: PreviewFormat, n: number, opts: PreviewOptions = {}): number {
  if (n < 2) return 0;
  switch (format) {
    case 'SINGLE_ELIMINATION':
      return n - 1 + (opts.thirdPlace ? 1 : 0);
    case 'DOUBLE_ELIMINATION':
      return 2 * n - 2 + (opts.bracketReset === false ? 0 : 1);
    case 'ROUND_ROBIN':
      return ((n * (n - 1)) / 2) * (opts.meetings ?? 1);
    case 'SWISS':
      return Math.floor(n / 2) * (opts.swissRounds ?? Math.ceil(Math.log2(n)));
    case 'GROUPS_KNOCKOUT': {
      const g = Math.max(2, opts.groupCount ?? Math.max(2, Math.round(n / 4)));
      const adv = opts.advancePerGroup ?? 2;
      const sizes = Array.from({ length: g }, (_, i) => Math.floor(n / g) + (i < n % g ? 1 : 0));
      const groupMatches = sizes.reduce((acc, k) => acc + (k * (k - 1)) / 2, 0);
      const ko = Math.max(2, g * adv) - 1;
      return groupMatches + ko;
    }
    default:
      return 1;
  }
}

export function buildPreview(
  format: PreviewFormat,
  names: string[],
  opts: PreviewOptions = {},
): PreviewResult {
  const teams = toEngineTeams(names, opts.randomize, opts.seed);
  const n = teams.length;
  const empty: PreviewResult = { format, teams, groups: [], matches: [], totalMatchEstimate: 0 };
  if (n < 2) return empty;

  switch (format) {
    case 'SINGLE_ELIMINATION':
      return {
        ...empty,
        matches: generateSingleElimination(teams, { breakTiesWithPlacement: !!opts.thirdPlace }),
        totalMatchEstimate: matchCount(format, n, opts),
      };
    case 'DOUBLE_ELIMINATION':
      return {
        ...empty,
        matches: generateDoubleElimination(teams, {
          doubleElimBracketReset: opts.bracketReset !== false,
        }),
        totalMatchEstimate: matchCount(format, n, opts),
      };
    case 'ROUND_ROBIN': {
      const base = generateRoundRobin(teams);
      const meetings = Math.max(1, opts.meetings ?? 1);
      const rounds = Math.max(...base.map((m) => m.round), 0);
      const all: GeneratedMatch[] = [...base];
      for (let k = 1; k < meetings; k++) {
        all.push(
          ...base.map((m) => ({
            ...m,
            key: `${m.key}-m${k + 1}`,
            round: m.round + rounds * k,
            homeTeamId: k % 2 === 1 ? m.awayTeamId : m.homeTeamId,
            awayTeamId: k % 2 === 1 ? m.homeTeamId : m.awayTeamId,
          })),
        );
      }
      return { ...empty, matches: all, totalMatchEstimate: all.length };
    }
    case 'SWISS':
      return {
        ...empty,
        matches: generateSwiss(teams, opts.swissRounds ?? Math.ceil(Math.log2(n))),
        totalMatchEstimate: matchCount(format, n, opts),
      };
    case 'GROUPS_KNOCKOUT': {
      const groupCount = Math.max(2, Math.min(opts.groupCount ?? Math.max(2, Math.round(n / 4)), Math.floor(n / 2)));
      const result = generateGroupsKnockout(teams, groupCount, opts.advancePerGroup ?? 2);
      return {
        format,
        teams: result.teams,
        groups: result.groups,
        matches: result.matches,
        totalMatchEstimate: result.matches.length,
      };
    }
    default:
      return empty;
  }
}
