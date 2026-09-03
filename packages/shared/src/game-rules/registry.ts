import type { GameProfile, GameRuleModule } from './types';

const mobaDefaults: Partial<GameRuleModule> = {
  subcategory: 'moba',
  matchEntry: 'esports-series',
  settings: {
    singleStageFormat: 'DOUBLE_ELIMINATION',
    knockoutBestOf: 3,
    doubleElimBracketReset: true,
    rankBy: 'MATCH_WINS',
    useHeadToHead: true,
    breakTiesWithPlacement: true,
  },
  pointsWin: 3,
  pointsDraw: 1,
  mvpWeights: {
    goals: 0,
    assists: 2,
    points: 0,
    kills: 3,
    deaths: -1,
    rating: 5,
    winBonus: 2,
  },
  mvpStatFields: ['kills', 'deaths', 'assists', 'rating'],
};

const fpsSeriesDefaults: Partial<GameRuleModule> = {
  subcategory: 'shooting',
  matchEntry: 'esports-series',
  settings: {
    stageMode: 'TWO_STAGE',
    singleStageFormat: 'SWISS',
    finalStageFormat: 'SINGLE_ELIMINATION',
    swissRounds: 5,
    useBuchholzSwiss: true,
    knockoutBestOf: 3,
    rankBy: 'MATCH_WINS',
    useHeadToHead: true,
  },
  pointsWin: 3,
  pointsDraw: 1,
  mvpWeights: {
    goals: 0,
    assists: 1,
    points: 0,
    kills: 3,
    deaths: -1,
    rating: 4,
    winBonus: 2,
  },
  mvpStatFields: ['kills', 'deaths', 'assists', 'rating'],
};

const brDefaults: Partial<GameRuleModule> = {
  subcategory: 'shooting',
  matchEntry: 'score',
  battleRoyale: true,
  settings: {
    singleStageFormat: 'LEADERBOARD',
    eventCount: 6,
    rankBy: 'POINTS_SCORED',
    useHeadToHead: false,
  },
  pointsWin: 0,
  pointsDraw: 0,
  mvpWeights: {
    goals: 0,
    assists: 0,
    points: 2,
    kills: 3,
    deaths: -0.5,
    rating: 0,
    winBonus: 5,
  },
  mvpStatFields: ['kills', 'points', 'deaths'],
};

/** Platform-supported games only — shooting, MOBA, football sim, CoC, outdoor. */
export const GAME_RULES: GameRuleModule[] = [
  {
    id: 'pubg',
    seedName: 'PUBG',
    name: 'PUBG',
    category: 'Esports',
    blurb: 'Battle royale — multi-match leaderboard, placement + kill points.',
    aliases: ['playerunknown', 'pubg pc'],
    ...brDefaults,
  } as GameRuleModule,
  {
    id: 'pubg-mobile',
    seedName: 'PUBG Mobile',
    name: 'PUBG Mobile',
    category: 'Esports',
    blurb: 'Mobile BR — leaderboard series, cumulative match points.',
    aliases: ['pubgm'],
    ...brDefaults,
  } as GameRuleModule,
  {
    id: 'free-fire',
    seedName: 'Free Fire',
    name: 'Free Fire',
    category: 'Esports',
    blurb: 'Squad BR — leaderboard or groups → finals with kill/placement points.',
    aliases: ['garena free fire', 'ff'],
    ...brDefaults,
    settings: {
      ...brDefaults.settings,
      stageMode: 'TWO_STAGE',
      singleStageFormat: 'SINGLE_ELIMINATION',
      finalStageFormat: 'SINGLE_ELIMINATION',
      participantsPerGroup: 4,
      advancePerGroup: 2,
      eventCount: 4,
    },
  } as GameRuleModule,
  {
    id: 'cod-mobile',
    seedName: 'Call of Duty Mobile',
    name: 'Call of Duty Mobile',
    category: 'Esports',
    blurb: 'BR or team modes — leaderboard points or Bo3 series.',
    aliases: ['cod mobile', 'call of duty'],
    ...brDefaults,
    settings: {
      stageMode: 'TWO_STAGE',
      singleStageFormat: 'SINGLE_ELIMINATION',
      finalStageFormat: 'SINGLE_ELIMINATION',
      participantsPerGroup: 4,
      advancePerGroup: 2,
      knockoutBestOf: 3,
      rankBy: 'MATCH_WINS',
      eventCount: 4,
    },
    mvpStatFields: ['kills', 'deaths', 'points', 'rating'],
  } as GameRuleModule,
  {
    id: 'valorant',
    seedName: 'Valorant',
    name: 'Valorant',
    category: 'Esports',
    blurb: 'VCT-style Swiss → single elim Bo3, map wins + K/D MVP.',
    aliases: [],
    ...fpsSeriesDefaults,
  } as GameRuleModule,
  {
    id: 'cs2',
    seedName: 'Counter-Strike 2',
    name: 'Counter-Strike 2',
    category: 'Esports',
    blurb: 'MR12 maps — Swiss or double elim, Bo3 playoffs.',
    aliases: ['counter strike', 'csgo', 'cs:go', 'cs 2'],
    ...fpsSeriesDefaults,
    settings: {
      ...fpsSeriesDefaults.settings,
      singleStageFormat: 'DOUBLE_ELIMINATION',
      doubleElimBracketReset: true,
    },
  } as GameRuleModule,
  {
    id: 'dota-2',
    seedName: 'Dota 2',
    name: 'Dota 2',
    category: 'Esports',
    blurb: 'Groups or double elim, Bo3/Bo5 MOBA series.',
    aliases: ['dota2', 'dota'],
    ...mobaDefaults,
    settings: {
      ...mobaDefaults.settings,
      stageMode: 'TWO_STAGE',
      singleStageFormat: 'ROUND_ROBIN',
      finalStageFormat: 'DOUBLE_ELIMINATION',
      participantsPerGroup: 4,
      advancePerGroup: 2,
    },
  } as GameRuleModule,
  {
    id: 'mobile-legends',
    seedName: 'Mobile Legends',
    name: 'Mobile Legends',
    category: 'Esports',
    blurb: 'MPL-style double elim or groups → Bo3 MOBA series.',
    aliases: ['mlbb', 'mobile legends bang bang'],
    ...mobaDefaults,
  } as GameRuleModule,
  {
    id: 'league-of-legends',
    seedName: 'League of Legends',
    name: 'League of Legends',
    category: 'Esports',
    blurb: 'LoL esports — Swiss/groups → knockout Bo3/Bo5.',
    aliases: ['lol', 'league'],
    ...mobaDefaults,
    settings: {
      ...mobaDefaults.settings,
      stageMode: 'TWO_STAGE',
      singleStageFormat: 'SWISS',
      finalStageFormat: 'SINGLE_ELIMINATION',
      swissRounds: 5,
      useBuchholzSwiss: true,
    },
  } as GameRuleModule,
  {
    id: 'fc26',
    seedName: 'EA FC 26 / FIFA',
    name: 'EA FC 26 / FIFA',
    category: 'Esports',
    subcategory: 'football-sim',
    matchEntry: 'football',
    blurb: 'Groups → knockout, goal difference, Bo3 playoffs optional.',
    aliases: ['fifa', 'ea fc', 'fc 26', 'fc25', 'fc 25'],
    settings: {
      stageMode: 'TWO_STAGE',
      singleStageFormat: 'SINGLE_ELIMINATION',
      finalStageFormat: 'SINGLE_ELIMINATION',
      participantsPerGroup: 4,
      advancePerGroup: 2,
      knockoutBestOf: 3,
      rankBy: 'POINTS_SCORED',
      useHeadToHead: true,
      breakTiesWithPlacement: true,
      knockoutExtraTime: true,
      knockoutPenalties: true,
    },
    pointsWin: 3,
    pointsDraw: 1,
    mvpWeights: {
      goals: 4,
      assists: 2,
      points: 0,
      kills: 0,
      deaths: 0,
      rating: 3,
      winBonus: 2,
    },
    mvpStatFields: ['goals', 'assists', 'rating'],
  },
  {
    id: 'efootball',
    seedName: 'eFootball',
    name: 'eFootball',
    category: 'Esports',
    subcategory: 'football-sim',
    matchEntry: 'football',
    blurb: 'Konami eFootball — league or knockout, goals + assists MVP.',
    aliases: ['pes', 'pro evolution'],
    settings: {
      stageMode: 'TWO_STAGE',
      singleStageFormat: 'ROUND_ROBIN',
      finalStageFormat: 'SINGLE_ELIMINATION',
      participantsPerGroup: 4,
      advancePerGroup: 2,
      rankBy: 'POINTS_SCORED',
      useHeadToHead: true,
      knockoutExtraTime: true,
      knockoutPenalties: true,
    },
    pointsWin: 3,
    pointsDraw: 1,
    mvpWeights: {
      goals: 4,
      assists: 2,
      points: 0,
      kills: 0,
      deaths: 0,
      rating: 3,
      winBonus: 2,
    },
    mvpStatFields: ['goals', 'assists', 'rating'],
  },
  {
    id: 'clash-of-clans',
    seedName: 'Clash of Clans',
    name: 'Clash of Clans',
    category: 'Esports',
    subcategory: 'strategy',
    matchEntry: 'coc-war',
    blurb: 'Clan wars — stars, destruction %, 24h attack window.',
    aliases: ['coc', 'clash'],
    settings: {
      stageMode: 'TWO_STAGE',
      singleStageFormat: 'ROUND_ROBIN',
      finalStageFormat: 'SINGLE_ELIMINATION',
      participantsPerGroup: 4,
      advancePerGroup: 2,
      meetingsPerPair: 1,
      rankBy: 'MATCH_WINS',
      useHeadToHead: true,
      knockoutBestOf: 1,
    },
    pointsWin: 3,
    pointsDraw: 1,
    mvpWeights: {
      goals: 3,
      assists: 0,
      points: 1,
      kills: 0,
      deaths: 0,
      rating: 2,
      winBonus: 2,
    },
    mvpStatFields: ['goals', 'points', 'rating'],
  },
  {
    id: 'cricket',
    seedName: 'Cricket',
    name: 'Cricket',
    category: 'Outdoor',
    subcategory: 'outdoor',
    matchEntry: 'cricket',
    blurb: 'Ball-by-ball scoreboard, NRR standings, ICC points (2-1-0).',
    aliases: [],
    settings: {
      stageMode: 'TWO_STAGE',
      singleStageFormat: 'SINGLE_ELIMINATION',
      finalStageFormat: 'SINGLE_ELIMINATION',
      participantsPerGroup: 4,
      advancePerGroup: 2,
      meetingsPerPair: 1,
      rankBy: 'NET_RUN_RATE',
      useHeadToHead: true,
      enableToss: true,
      knockoutBestOf: 1,
    },
    pointsWin: 2,
    pointsDraw: 1,
    mvpWeights: {
      goals: 1,
      assists: 3,
      points: 0,
      kills: 0,
      deaths: 0,
      rating: 4,
      winBonus: 2,
    },
    mvpStatFields: ['goals', 'assists', 'rating'],
  },
  {
    id: 'football',
    seedName: 'Football / Soccer',
    name: 'Football / Soccer',
    category: 'Outdoor',
    subcategory: 'outdoor',
    matchEntry: 'football',
    blurb: 'Real-world football — 3-1-0, H2H, ET & penalties in knockout.',
    aliases: ['soccer', 'outdoor football'],
    settings: {
      stageMode: 'TWO_STAGE',
      singleStageFormat: 'SINGLE_ELIMINATION',
      finalStageFormat: 'SINGLE_ELIMINATION',
      participantsPerGroup: 4,
      advancePerGroup: 2,
      rankBy: 'MATCH_WINS',
      useHeadToHead: true,
      enableToss: true,
      knockoutBestOf: 1,
      knockoutExtraTime: true,
      knockoutPenalties: true,
      useFairPlayTiebreaker: true,
    },
    pointsWin: 3,
    pointsDraw: 1,
    mvpWeights: {
      goals: 4,
      assists: 2,
      points: 0,
      kills: 0,
      deaths: 0,
      rating: 2,
      winBonus: 2,
    },
    mvpStatFields: ['goals', 'assists', 'yellowCards', 'redCards', 'rating'],
  },
  {
    id: 'badminton',
    seedName: 'Badminton',
    name: 'Badminton',
    category: 'Outdoor',
    subcategory: 'outdoor',
    matchEntry: 'set-sport',
    blurb: 'Best-of-3 sets — set win % and set difference in standings.',
    aliases: ['shuttle'],
    settings: {
      singleStageFormat: 'ROUND_ROBIN',
      rankBy: 'GAME_SET_WIN_PCT',
      useHeadToHead: true,
      breakTiesWithPlacement: true,
      knockoutBestOf: 1,
    },
    pointsWin: 3,
    pointsDraw: 0,
    mvpWeights: {
      goals: 0,
      assists: 0,
      points: 3,
      kills: 0,
      deaths: 0,
      rating: 2,
      winBonus: 2,
    },
    mvpStatFields: ['points', 'rating'],
  },
];

export const GAME_RULES_BY_ID = new Map(GAME_RULES.map((g) => [g.id, g]));

export const BATTLE_ROYALE_GAME_IDS = new Set(
  GAME_RULES.filter((g) => g.battleRoyale).map((g) => g.id),
);

export const SUPPORTED_GAME_SEED_NAMES = GAME_RULES.map((g) => g.seedName);

export function battleRoyalePlacementPoints(
  placement: number,
  kills = 0,
  opts?: { placementTable?: number[]; pointsPerKill?: number },
): number {
  const table =
    opts?.placementTable ??
    [15, 12, 10, 8, 6, 5, 4, 3, 2, 1, 1, 1, 0, 0, 0, 0];
  const killPts = opts?.pointsPerKill ?? 1;
  const idx = Math.max(0, Math.min(table.length - 1, placement - 1));
  return (table[idx] ?? 0) + kills * killPts;
}

export function gameRuleById(id: string): GameRuleModule | undefined {
  return GAME_RULES_BY_ID.get(id);
}

export function gameRuleForGameName(name: string): GameRuleModule | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  for (const rule of GAME_RULES) {
    if (rule.seedName.toLowerCase() === n) return rule;
    if (rule.name.toLowerCase() === n) return rule;
    for (const alias of rule.aliases) {
      if (n.includes(alias)) return rule;
    }
  }
  for (const rule of GAME_RULES) {
    const idToken = rule.id.replace(/-/g, ' ');
    if (n.includes(idToken)) return rule;
  }
  if (n.includes('pubg') && !n.includes('mobile')) {
    return GAME_RULES_BY_ID.get('pubg');
  }
  if (n.includes('mobile legends') || n.includes('mlbb')) {
    return GAME_RULES_BY_ID.get('mobile-legends');
  }
  if (n.includes('league of legends') || n === 'lol') {
    return GAME_RULES_BY_ID.get('league-of-legends');
  }
  if (n.includes('dota')) return GAME_RULES_BY_ID.get('dota-2');
  if (n.includes('counter-strike') || n.includes('cs2')) {
    return GAME_RULES_BY_ID.get('cs2');
  }
  if (n.includes('fifa') || n.includes('ea fc') || n.includes('fc 26')) {
    return GAME_RULES_BY_ID.get('fc26');
  }
  if (n.includes('football') || n.includes('soccer')) {
    return GAME_RULES_BY_ID.get('football');
  }
  return undefined;
}

export function toGameProfile(rule: GameRuleModule): GameProfile {
  const {
    id,
    name,
    category,
    blurb,
    matchEntry,
    settings,
    pointsWin,
    pointsDraw,
    mvpWeights,
    mvpStatFields,
    subcategory,
    battleRoyale,
  } = rule;
  return {
    id,
    name,
    category,
    blurb,
    matchEntry,
    settings,
    pointsWin,
    pointsDraw,
    mvpWeights,
    mvpStatFields,
    subcategory,
    battleRoyale,
  };
}

export const GAME_PROFILES: GameProfile[] = GAME_RULES.map(toGameProfile);
