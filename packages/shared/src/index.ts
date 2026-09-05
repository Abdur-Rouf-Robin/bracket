import { z } from 'zod';
import { mvpWeightsSchema, playerMatchStatsSchema } from './mvp';
import { matchMetaSchema } from './match-entry';

export {
  computePlayerMvpScore,
  computeTournamentMvpLeaderboard,
  mvpRoundMultiplier,
  mvpWeightsSchema,
  playerMatchStatsSchema,
  resolveMatchMvp,
  type CompletedMatchMvpInput,
  type MvpWeights,
  type PlayerMatchStatsInput,
  type PlayerStatRow,
  type TournamentMvpRow,
} from './mvp';

export {
  createDrawSeed,
  hashSeed,
  mulberry32,
  seededShuffle,
  type DrawAuditEntry,
} from './rng';

export { defaultRoundLabel, resolveRoundLabel } from './round-labels';

export const KNOCKOUT_BEST_OF_OPTIONS = [1, 3, 5, 7] as const;

export const TournamentFormat = {
  ROUND_ROBIN: 'ROUND_ROBIN',
  SINGLE_ELIMINATION: 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION: 'DOUBLE_ELIMINATION',
  GROUPS_KNOCKOUT: 'GROUPS_KNOCKOUT',
  SWISS: 'SWISS',
  LEADERBOARD: 'LEADERBOARD',
  FREE_FOR_ALL: 'FREE_FOR_ALL',
  TIME_TRIAL: 'TIME_TRIAL',
  SINGLE_RACE: 'SINGLE_RACE',
  GRAND_PRIX: 'GRAND_PRIX',
} as const;

export type TournamentFormat =
  (typeof TournamentFormat)[keyof typeof TournamentFormat];

export const StageMode = {
  SINGLE: 'SINGLE',
  TWO_STAGE: 'TWO_STAGE',
} as const;

export type StageMode = (typeof StageMode)[keyof typeof StageMode];

export const RankBy = {
  TOURNAMENT_POINTS: 'TOURNAMENT_POINTS',
  MATCH_WINS: 'MATCH_WINS',
  NET_RUN_RATE: 'NET_RUN_RATE',
  GAME_SET_WINS: 'GAME_SET_WINS',
  GAME_SET_WIN_PCT: 'GAME_SET_WIN_PCT',
  GAME_SET_DIFF: 'GAME_SET_DIFF',
  POINTS_SCORED: 'POINTS_SCORED',
  POINTS_DIFF: 'POINTS_DIFF',
  CUSTOM: 'CUSTOM',
} as const;

export type RankBy = (typeof RankBy)[keyof typeof RankBy];

export const RANK_BY_OPTIONS: { value: RankBy; label: string }[] = [
  { value: 'TOURNAMENT_POINTS', label: 'Tournament points (3-1-0)' },
  { value: 'MATCH_WINS', label: 'Match wins' },
  { value: 'NET_RUN_RATE', label: 'Net run rate (cricket)' },
  { value: 'GAME_SET_WINS', label: 'Game / set wins' },
  { value: 'GAME_SET_WIN_PCT', label: 'Game / set win %' },
  { value: 'GAME_SET_DIFF', label: 'Game / set W–L difference' },
  { value: 'POINTS_SCORED', label: 'Points scored' },
  { value: 'POINTS_DIFF', label: 'Points difference' },
  { value: 'CUSTOM', label: 'Custom' },
];

export const FINAL_STAGE_OPTIONS = [
  { value: 'SINGLE_ELIMINATION', label: 'Single Elimination' },
  { value: 'DOUBLE_ELIMINATION', label: 'Double Elimination' },
  { value: 'ROUND_ROBIN', label: 'Round Robin' },
  { value: 'SWISS', label: 'Swiss' },
] as const;

export const SINGLE_STAGE_OPTIONS = [
  { value: 'FREE_FOR_ALL', label: 'Free for All' },
  { value: 'LEADERBOARD', label: 'Leaderboard' },
  { value: 'SWISS', label: 'Swiss' },
  { value: 'ROUND_ROBIN', label: 'Round Robin' },
  { value: 'DOUBLE_ELIMINATION', label: 'Double Elimination' },
  { value: 'SINGLE_ELIMINATION', label: 'Single Elimination' },
  { value: 'TIME_TRIAL', label: 'Time Trial' },
  { value: 'SINGLE_RACE', label: 'Single Race' },
  { value: 'GRAND_PRIX', label: 'Grand Prix' },
] as const;

export const FORMAT_META: Record<
  TournamentFormat,
  { label: string; category: string; blurb: string }
> = {
  SINGLE_ELIMINATION: {
    label: 'Single Elimination',
    category: 'Bracket',
    blurb: 'Lose once and you are out. Classic knockout tree.',
  },
  DOUBLE_ELIMINATION: {
    label: 'Double Elimination',
    category: 'Bracket',
    blurb: 'Must lose twice. Winners and losers brackets.',
  },
  ROUND_ROBIN: {
    label: 'Round Robin',
    category: 'League',
    blurb: 'Everyone plays everyone. Ranked by points.',
  },
  SWISS: {
    label: 'Swiss System',
    category: 'League',
    blurb: 'Pair similar records each round. Fewer games than round robin.',
  },
  GROUPS_KNOCKOUT: {
    label: 'Two-Stage (Groups + KO)',
    category: 'Hybrid',
    blurb: 'Group stage first, then knockout with advancers.',
  },
  LEADERBOARD: {
    label: 'Leaderboard',
    category: 'Ranking',
    blurb: 'Multiple scoring events. Cumulative points board.',
  },
  FREE_FOR_ALL: {
    label: 'Free for All',
    category: 'Ranking',
    blurb: 'Open ranking board — everyone competes for placement.',
  },
  TIME_TRIAL: {
    label: 'Time Trial',
    category: 'Racing',
    blurb: 'Each team posts a time. Fastest wins.',
  },
  SINGLE_RACE: {
    label: 'Single Race',
    category: 'Racing',
    blurb: 'One race for all teams. Finish order becomes the ranking.',
  },
  GRAND_PRIX: {
    label: 'Grand Prix',
    category: 'Racing',
    blurb: 'Series of races with championship points (F1-style).',
  },
};

export const TournamentStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
} as const;

export type TournamentStatus =
  (typeof TournamentStatus)[keyof typeof TournamentStatus];

export const MatchStatus = {
  PENDING: 'PENDING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
} as const;

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const BracketSide = {
  WINNERS: 'WINNERS',
  LOSERS: 'LOSERS',
  GROUP: 'GROUP',
  FINAL: 'FINAL',
  GRAND_FINAL: 'GRAND_FINAL',
  SWISS: 'SWISS',
} as const;

export type BracketSide = (typeof BracketSide)[keyof typeof BracketSide];

export const tournamentSettingsSchema = z.object({
  stageMode: z.enum(['SINGLE', 'TWO_STAGE']).default('SINGLE'),
  breakTiesWithPlacement: z.boolean().default(false),
  meetingsPerPair: z.number().int().min(1).max(4).default(1),
  participantsPerGroup: z.number().int().min(2).max(32).default(4),
  advancePerGroup: z.number().int().min(1).max(8).default(2),
  rankBy: z
    .enum([
      'TOURNAMENT_POINTS',
      'MATCH_WINS',
      'NET_RUN_RATE',
      'GAME_SET_WINS',
      'GAME_SET_WIN_PCT',
      'GAME_SET_DIFF',
      'POINTS_SCORED',
      'POINTS_DIFF',
      'CUSTOM',
    ])
    .default('TOURNAMENT_POINTS'),
  finalStageFormat: z
    .enum([
      'SINGLE_ELIMINATION',
      'DOUBLE_ELIMINATION',
      'ROUND_ROBIN',
      'SWISS',
    ])
    .default('SINGLE_ELIMINATION'),
  singleStageFormat: z
    .enum([
      'FREE_FOR_ALL',
      'LEADERBOARD',
      'SWISS',
      'ROUND_ROBIN',
      'DOUBLE_ELIMINATION',
      'SINGLE_ELIMINATION',
      'TIME_TRIAL',
      'SINGLE_RACE',
      'GRAND_PRIX',
    ])
    .default('SINGLE_ELIMINATION'),
  showCustomRoundLabels: z.boolean().default(false),
  roundLabels: z.record(z.string()).optional().default({}),
  hideSeedNumbers: z.boolean().default(false),
  hideBracketPreviewPublic: z.boolean().default(false),
  quickAdvanceWinnersOnly: z.boolean().default(false),
  allowMatchAttachments: z.boolean().default(false),
  enableToss: z.boolean().default(false),
  registrationMode: z
    .enum(['HOST_LIST', 'OPEN_SIGNUP'])
    .default('HOST_LIST'),
  requireTeamRegistration: z.boolean().default(false),
  maxParticipants: z.number().int().min(2).max(512).default(32),
  playersPerTeam: z.number().int().min(1).max(20).default(1),
  substituteSlots: z.number().int().min(0).max(10).default(0),
  playerNamesEditable: z.boolean().default(true),
  allowSubstitutes: z.boolean().default(false),
  tentative: z.boolean().default(false),
  enableMatchVoting: z.boolean().default(false),
  enableBracketPredictions: z.boolean().default(false),
  swissRounds: z.number().int().min(2).max(12).default(4),
  raceCount: z.number().int().min(1).max(24).default(5),
  eventCount: z.number().int().min(1).max(24).default(3),
  knockoutBestOf: z.number().int().min(1).max(7).default(1),
  doubleElimBracketReset: z.boolean().default(true),
  useHeadToHead: z.boolean().default(true),
  useBuchholzSwiss: z.boolean().default(true),
  // International competition rules
  requireCheckIn: z.boolean().default(false),
  lockRosterAfterGenerate: z.boolean().default(false),
  groupDrawMode: z
    .enum(['SERPENTINE', 'POT', 'BALANCED', 'RANDOM'])
    .default('SERPENTINE'),
  useFairPlayTiebreaker: z.boolean().default(false),
  forfeitScoreWinner: z.number().int().min(0).default(3),
  forfeitScoreLoser: z.number().int().min(0).default(0),
  advanceBestThirds: z.boolean().default(false),
  bestThirdsCount: z.number().int().min(1).max(16).default(4),
  twoLeggedKnockout: z.boolean().default(false),
  twoLeggedGroup: z.boolean().default(false),
  twoLeggedAwayGoals: z.boolean().default(false),
  knockoutExtraTime: z.boolean().default(false),
  knockoutPenalties: z.boolean().default(true),
  auditableDraw: z.boolean().default(false),
  drawSeed: z.string().optional(),
  drawAuditLog: z
    .array(
      z.object({
        at: z.string(),
        operation: z.string(),
        seed: z.string(),
        seedHash: z.number(),
        inputOrder: z.array(z.string()),
        outputOrder: z.array(z.string()),
      }),
    )
    .optional()
    .default([]),

  // Sharing & media
  enableShareableMatchImages: z.boolean().default(true),
  // Registration constraints
  requireVerifiedEmail: z.boolean().default(false),
  restrictByCountry: z.boolean().default(false),
  allowedCountries: z.array(z.string().min(2).max(8)).default([]),
  // Predictions
  allowCustomPredictionFields: z.boolean().default(false),
  allowAnonymousPredictions: z.boolean().default(false),
  predictionCustomFields: z
    .array(
      z.object({
        id: z.string().min(1).max(32),
        label: z.string().min(1).max(80),
        type: z.enum(['text', 'number']).default('text'),
      }),
    )
    .optional()
    .default([]),
  // Permissions
  allowParticipantsReportScores: z.boolean().default(true),
  // Discovery
  excludeFromSearchEngines: z.boolean().default(false),
  browsableInIndex: z.boolean().default(true),
  // Notifications
  notifyMatchAvailable: z.boolean().default(true),
  sendFinalResultsEmail: z.boolean().default(false),
  // UI tabs
  showAnnouncementTab: z.boolean().default(true),
  showStandings: z.boolean().default(true),
  // MVP / player awards
  enableMvp: z.boolean().default(true),
  mvpMode: z.enum(['AUTO', 'MANUAL']).default('AUTO'),
  mvpWeights: mvpWeightsSchema.optional(),
  mvpRoundMultipliers: z.record(z.number()).optional().default({}),
  swissPairingMode: z.enum(['SIMPLE', 'FIDE_DUTCH']).default('SIMPLE'),
  // Seeding
  seedingMode: z
    .enum(['TRADITIONAL', 'LIST_ORDER'])
    .default('TRADITIONAL'),

  // ---------------------------------------------------------------------
  // Standings & scoring (Score7 / Challonge parity)
  // ---------------------------------------------------------------------
  /** Ordered tiebreak criteria applied after `rankBy`. */
  standingsCriteria: z
    .array(
      z.enum([
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
      ]),
    )
    .default(['POINTS', 'SCORE_DIFF', 'SCORE_FOR', 'HEAD_TO_HEAD']),
  /** Visible columns in the standings table, in display order. */
  standingsColumns: z
    .array(
      z.enum([
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
      ]),
    )
    .default([
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
    ]),
  pointsLoss: z.number().int().min(-10).max(10).default(0),
  /** Set-based scoring (tennis, volleyball, padel, table tennis). */
  setBasedScoring: z.boolean().default(false),
  setsBestOf: z.number().int().min(1).max(9).default(3),
  /** Placement matches decide ranks 3..N (0 = none, 3 = third-place only). */
  placementMatchesThrough: z.number().int().min(0).max(16).default(0),
  /** Cup & consolation: losers of KO round 1 play a separate consolation bracket. */
  consolationBracket: z.boolean().default(false),
  /** Swiss: CLASSIC pairs round by round; POTS pre-generates fixtures (UCL style). */
  swissMode: z.enum(['CLASSIC', 'POTS']).default('CLASSIC'),
  /** Double elimination: allow some participants to start in the losers bracket. */
  splitParticipantsStartInLosers: z.boolean().default(false),
  /** Teams picked to start in the losers bracket (used by generate when the body omits them). */
  losersStartTeamIds: z.array(z.string()).max(128).optional(),
  bracketNames: z
    .object({
      winners: z.string().max(40).optional(),
      losers: z.string().max(40).optional(),
      consolation: z.string().max(40).optional(),
      final: z.string().max(40).optional(),
    })
    .optional()
    .default({}),

  // ---------------------------------------------------------------------
  // Registration lifecycle
  // ---------------------------------------------------------------------
  signupPagePublic: z.boolean().default(true),
  autoApproveRegistrations: z.boolean().default(true),
  waitlistEnabled: z.boolean().default(true),
  registrationOpensAt: z.string().optional().nullable(),
  registrationClosesAt: z.string().optional().nullable(),
  registrationFields: z
    .array(
      z.object({
        id: z.string().min(1).max(32),
        label: z.string().min(1).max(120),
        type: z
          .enum(['text', 'textarea', 'number', 'email', 'phone', 'select', 'checkbox', 'url'])
          .default('text'),
        required: z.boolean().default(false),
        options: z.array(z.string().max(80)).optional(),
        helpText: z.string().max(240).optional(),
      }),
    )
    .default([]),
  waiverText: z.string().max(8000).optional().nullable(),
  entryFeeCents: z.number().int().min(0).max(100000000).default(0),
  currency: z.string().length(3).default('USD'),
  checkInOpensMinutesBefore: z.number().int().min(0).max(2880).default(60),
  collectSkillLevel: z.boolean().default(false),
  enableMatchComments: z.boolean().default(true),
  participantConfirmationRequired: z.boolean().default(false),

  // ---------------------------------------------------------------------
  // Branding, sharing & display
  // ---------------------------------------------------------------------
  brandPrimaryColor: z.string().max(16).optional().nullable(),
  brandSecondaryColor: z.string().max(16).optional().nullable(),
  hideBranding: z.boolean().default(false),
  viewPasswordEnabled: z.boolean().default(false),
  participantAccessPages: z.boolean().default(true),
  tvDisplayIntervalSeconds: z.number().int().min(5).max(300).default(20),
  embedTheme: z.enum(['dark', 'light', 'auto']).default('auto'),
  embedDefaultTab: z.string().max(32).default('bracket'),
  rulesMarkdown: z.string().max(20000).optional().nullable(),
  descriptionTranslations: z.record(z.string().max(4000)).optional().default({}),
  sponsors: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        logoUrl: z.string().max(2048).optional().nullable(),
        url: z.string().max(2048).optional().nullable(),
      }),
    )
    .default([]),
  streamUrl: z.string().max(2048).optional().nullable(),
  socialLinks: z.record(z.string().max(2048)).optional().default({}),
  prizePool: z.string().max(240).optional().nullable(),
});

export type TournamentSettings = z.infer<typeof tournamentSettingsSchema>;

/** Starters, subs, and max roster size from tournament settings. */
export function rosterLimits(
  settings: Pick<
    TournamentSettings,
    | 'playersPerTeam'
    | 'allowSubstitutes'
    | 'substituteSlots'
    | 'requireTeamRegistration'
  >,
) {
  const starters = settings.playersPerTeam ?? 1;
  const substituteSlots =
    settings.allowSubstitutes ? (settings.substituteSlots ?? 0) : 0;
  const maxRoster = starters + substituteSlots;
  return {
    starters,
    substituteSlots,
    maxRoster: Math.max(starters, maxRoster),
    minRoster: settings.requireTeamRegistration ? starters : 0,
  };
}

export const DEFAULT_TOURNAMENT_SETTINGS: TournamentSettings =
  tournamentSettingsSchema.parse({});

export const GROUP_DRAW_MODES = [
  { value: 'SERPENTINE', label: 'Serpentine (by seed)' },
  { value: 'POT', label: 'Pot draw (UEFA-style)' },
  { value: 'BALANCED', label: 'Random balanced serpentine' },
  { value: 'RANDOM', label: 'Random groups' },
] as const;

export const SHUFFLE_POOL_COLORS = [
  { key: 'YELLOW', label: 'Yellow', hex: '#EAB308' },
  { key: 'BLUE', label: 'Blue', hex: '#3B82F6' },
  { key: 'RED', label: 'Red', hex: '#EF4444' },
  { key: 'GREEN', label: 'Green', hex: '#22C55E' },
  { key: 'PURPLE', label: 'Purple', hex: '#A855F7' },
  { key: 'ORANGE', label: 'Orange', hex: '#F97316' },
] as const;

export const COUNTRY_OPTIONS = [
  { code: 'BD', name: 'Bangladesh' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'UAE' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'OTHER', name: 'Other' },
] as const;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

/** Public tournament signup (open registration). */
export const tournamentSignupSchema = z.object({
  teamName: z.string().min(1).max(80),
  players: z.array(z.string().min(1).max(80)).optional().default([]),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const userRoleSchema = z.enum(['USER', 'ADMIN']);

export const adminCreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: userRoleSchema.optional().default('USER'),
});

export const adminUpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: userRoleSchema.optional(),
  password: z.string().min(8).optional(),
});

export const adminUpdateTournamentSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED']).optional(),
  isPublic: z.boolean().optional(),
});

export const adminCreateGameSchema = z.object({
  name: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  sortOrder: z.number().int().min(0).max(9999).optional().default(100),
  active: z.boolean().optional().default(true),
});

export const adminUpdateGameSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  category: z.string().min(1).max(40).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
});

export const venueTypeSchema = z.enum(['ONLINE', 'PHYSICAL']);

export const venueFieldsSchema = {
  venueType: venueTypeSchema.optional().nullable(),
  venueName: z.string().max(120).optional().nullable(),
  venueAddress: z.string().max(240).optional().nullable(),
  venueUrl: z.string().max(2048).optional().nullable(),
};

export const createTournamentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, hyphens')
    .optional(),
  gameId: z.string().cuid().optional().nullable(),
  isPublic: z.boolean().optional().default(true),
  startAt: z.string().datetime().optional().nullable(),
  ...venueFieldsSchema,
  pointsWin: z.number().int().min(0).optional().default(3),
  pointsDraw: z.number().int().min(0).optional().default(1),
  allowPercent: z.boolean().optional().default(true),
  backgroundImageUrl: z.string().url().max(2048).optional().nullable(),
  logoUrl: z.string().url().max(2048).optional().nullable(),
  settings: tournamentSettingsSchema.partial().optional(),
});

export const updateTournamentSchema = createTournamentSchema.partial().extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED']).optional(),
});

export const bulkTeamsSchema = z.object({
  teams: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        groupName: z.string().min(1).max(40).optional(),
        logoUrl: z.string().url().max(2048).optional().nullable(),
        teamPhotoUrl: z.string().url().max(2048).optional().nullable(),
        players: z
          .array(
            z.union([
              z.string().min(1).max(80),
              z.object({
                name: z.string().min(1).max(80),
                photoUrl: z.string().url().max(2048).optional().nullable(),
                isCaptain: z.boolean().optional().default(false),
              }),
            ]),
          )
          .optional(),
      }),
    )
    .min(2)
    .max(128),
});

const rosterPlayerSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1).max(80).optional(),
  photoUrl: z.string().url().max(2048).optional().nullable(),
  isCaptain: z.boolean().optional(),
  isSub: z.boolean().optional(),
  delete: z.boolean().optional(),
});

export const teamRosterSchema = z.object({
  logoUrl: z.string().url().max(2048).optional().nullable(),
  teamPhotoUrl: z.string().url().max(2048).optional().nullable(),
  fairPlayPoints: z.number().int().min(0).max(999).optional(),
  players: z.array(rosterPlayerSchema).optional(),
});

/** @deprecated alias — use teamRosterSchema */
export const teamMediaSchema = teamRosterSchema;

export const generateBracketSchema = z.object({
  format: z
    .enum([
      'ROUND_ROBIN',
      'SINGLE_ELIMINATION',
      'DOUBLE_ELIMINATION',
      'GROUPS_KNOCKOUT',
      'SWISS',
      'LEADERBOARD',
      'FREE_FOR_ALL',
      'TIME_TRIAL',
      'SINGLE_RACE',
      'GRAND_PRIX',
    ])
    .optional(),
  groupCount: z.number().int().min(2).max(16).optional(),
  advancePerGroup: z.number().int().min(1).max(8).optional(),
  swissRounds: z.number().int().min(2).max(12).optional(),
  raceCount: z.number().int().min(1).max(24).optional(),
  eventCount: z.number().int().min(1).max(24).optional(),
  useSavedSettings: z.boolean().optional().default(true),
  /** Double elimination: teams that start directly in the losers bracket. */
  losersStartTeamIds: z.array(z.string()).max(128).optional(),
  placementMatchesThrough: z.number().int().min(0).max(16).optional(),
  consolationBracket: z.boolean().optional(),
});

export const matchResultSchema = z.object({
  homeScore: z.number().min(0).optional().default(0),
  awayScore: z.number().min(0).optional().default(0),
  homePercent: z.number().min(0).max(100).optional().nullable(),
  awayPercent: z.number().min(0).max(100).optional().nullable(),
  winnerTeamId: z.string().cuid().optional().nullable(),
  isDraw: z.boolean().optional().default(false),
  isNoResult: z.boolean().optional().default(false),
  force: z.boolean().optional().default(false),
  winnersOnly: z.boolean().optional().default(false),
  isForfeit: z.boolean().optional().default(false),
  forfeitSide: z.enum(['home', 'away']).optional(),
  etHomeScore: z.number().min(0).optional().nullable(),
  etAwayScore: z.number().min(0).optional().nullable(),
  penHomeScore: z.number().min(0).optional().nullable(),
  penAwayScore: z.number().min(0).optional().nullable(),
  mvpPlayerId: z.string().cuid().optional().nullable(),
  playerStats: z.array(playerMatchStatsSchema).optional().default([]),
  matchMeta: matchMetaSchema,
  /** Set-based scoring: per-set game points, e.g. tennis 6-4 3-6 7-5. */
  sets: z
    .array(z.object({ home: z.number().min(0), away: z.number().min(0) }))
    .max(9)
    .optional(),
});

export const matchScheduleSchema = z.object({
  scheduledAt: z.string().datetime().optional().nullable(),
  station: z.string().max(40).optional().nullable(),
});

export const matchAttachmentSchema = z.object({
  attachmentUrl: z.string().url().max(2048).optional().nullable(),
  attachmentName: z.string().max(120).optional().nullable(),
});

export const matchVoteSchema = z.object({
  teamId: z.string().cuid(),
});

export const bracketPredictionSchema = z.object({
  picks: z.record(z.string(), z.string().cuid()),
  customFields: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  guestName: z.string().min(1).max(80).optional(),
  guestKey: z.string().min(8).max(64).optional(),
});

export const checkInSchema = z.object({
  checkedIn: z.boolean(),
});

export const eventResultsSchema = z.object({
  eventKey: z.string().min(1),
  results: z
    .array(
      z.object({
        teamId: z.string().cuid(),
        value: z.number(),
        position: z.number().int().min(1).optional().nullable(),
      }),
    )
    .min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type TournamentSignupInput = z.infer<typeof tournamentSignupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminUpdateTournamentInput = z.infer<typeof adminUpdateTournamentSchema>;
export type AdminCreateGameInput = z.infer<typeof adminCreateGameSchema>;
export type AdminUpdateGameInput = z.infer<typeof adminUpdateGameSchema>;
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
export type BulkTeamsInput = z.infer<typeof bulkTeamsSchema>;
export type TeamRosterInput = z.infer<typeof teamRosterSchema>;
export type TeamMediaInput = TeamRosterInput;
export type GenerateBracketInput = z.infer<typeof generateBracketSchema>;
export type MatchResultInput = z.infer<typeof matchResultSchema>;
export type MatchScheduleInput = z.infer<typeof matchScheduleSchema>;
export type MatchAttachmentInput = z.infer<typeof matchAttachmentSchema>;
export type MatchVoteInput = z.infer<typeof matchVoteSchema>;
export type BracketPredictionInput = z.infer<typeof bracketPredictionSchema>;
export type EventResultsInput = z.infer<typeof eventResultsSchema>;

export interface FormatSuggestion {
  format: TournamentFormat;
  label: string;
  reason: string;
  recommended: boolean;
  category: string;
}

export const REALTIME_EVENTS = {
  MATCH_UPDATED: 'match.updated',
  STANDINGS_UPDATED: 'standings.updated',
  BRACKET_UPDATED: 'bracket.updated',
  DRAW_STEP: 'draw.step',
  DRAW_COMPLETE: 'draw.complete',
  CRICKET_UPDATED: 'cricket.updated',
} as const;

export {
  CricketExtraType,
  CricketFormat,
  CricketInningsEndReason,
  CricketInningsStatus,
  CricketMatchMode,
  CricketWicketType,
  cricketBallSchema,
  cricketChangeBowlerSchema,
  cricketSetBatsmenSchema,
  cricketCreateStandaloneSchema,
  cricketDeclareSchema,
  cricketDlsSchema,
  cricketEndInningsSchema,
  cricketStartSuperOverSchema,
  cricketFollowOnSchema,
  cricketAbandonSchema,
  cricketManualReportSchema,
  cricketInningsReportSchema,
  cricketTossSchema,
  cricketStandaloneTossSchema,
  CricketTossDecision,
  cricketRosterPlayerSchema,
  cricketSetupSchema,
  cricketStandaloneStartInningsSchema,
  cricketStartInningsSchema,
  detectSport,
  formatCricketOvers,
  parseCricketOvers,
  teamsFromCricketToss,
  lastCompletedOverBowlerId,
  defaultBowlerLimits,
  resolveBowlerLimits,
  CRICKET_FORMAT_PRESETS,
  cricketFormatPreset,
  cricketFormatEnum,
  powerplayLegalBalls,
  dismissalCountsAsWicket,
  cricketFollowOnState,
  cricketChaseTarget,
  aggregateTeamRuns,
  bowlingLegalBallsByBowler,
  bowlingLegalBallsFromRows,
  maxLegalOversForBowler,
  canSelectBowler,
  type BowlerLimitSettings,
  type CricketBallInput,
  type CricketBattingRow,
  type CricketBowlingRow,
  type CricketChangeBowlerInput,
  type CricketSetBatsmenInput,
  type CricketCreateStandaloneInput,
  type CricketDeclareInput,
  type CricketDlsInput,
  type CricketEndInningsInput,
  type CricketFallOfWicket,
  type CricketBallEvent,
  type CricketInningsView,
  type CricketScoreboard,
  type CricketSetupInput,
  type CricketStandaloneStartInningsInput,
  type CricketStartInningsInput,
  type CricketStartSuperOverInput,
  type CricketFollowOnInput,
  type CricketFollowOnState,
  type CricketAbandonInput,
  type CricketManualReportInput,
  type CricketInningsReportInput,
  type CricketTossInput,
  type CricketStandaloneTossInput,
} from './cricket';

export {
  computeBattingPoints,
  computeBowlingPoints,
  computeDlsRevisedTarget,
  computeLeaguePoints,
  computeNetRunRate,
  computeProjectedScore,
  computeRequiredRunRate,
  computeRunRate,
  isDuck,
  isGoldenDuck,
  resourceRemaining,
  type DlsInput,
  type DlsResult,
} from './cricket-stats';

export const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export function formatsSupportShareImage(
  format: string | null | undefined,
): boolean {
  return (
    format === 'SINGLE_ELIMINATION' ||
    format === 'DOUBLE_ELIMINATION' ||
    format === 'ROUND_ROBIN' ||
    format === 'SWISS'
  );
}

export {
  GAME_PROFILES,
  applyGameProfile,
  profileForGameName,
  resolveGameProfile,
  GAME_RULES,
  BATTLE_ROYALE_GAME_IDS,
  SUPPORTED_GAME_SEED_NAMES,
  battleRoyalePlacementPoints,
  gameRuleForGameName,
  type GameProfile,
  type GameRuleModule,
  type GameSubcategory,
  type MvpStatField,
} from './game-profiles';

export {
  applyFormatPlan,
  suggestFormatPlans,
  type FormatPlan,
} from './format-suggestions';

export {
  MATCH_ENTRY_FIELDS,
  MatchEntryMode,
  matchMetaSchema,
  type MatchEntryField,
  type MatchMeta,
} from './match-entry';

export {
  buildShareCardPayload,
  defaultRoundLabelForShare,
  resolveShareCardDisplayMode,
  resolveWinnerSide,
  type ShareCardDisplayMode,
  type ShareCardPayload,
  type ShareCardTeam,
} from './share-card';

export {
  captainFromPlayers,
  formatShareDateTime,
  formatVenue,
  SHARE_IMAGE_ASSET_SPECS,
  type AnySharePayload,
  type CongratsSharePayload,
  type MvpSharePayload,
  type PrematchSharePayload,
  type ResultSharePayload,
  type ShareTeamVisual,
  type ShareTournamentVisual,
} from './share-images';

export {
  fairPlayPointsFromCards,
  rollupTeamFairPlayFromStats,
} from './fair-play';

export type { DrawCeremonyPlan, DrawCeremonyStep } from './draw-ceremony';

// Feature-area contracts. Each file is owned by one workstream — add new
// schemas/types there rather than in this file.
export * from './communities';
export * from './event-hub';
export * from './scheduling';
export * from './standings-config';
export * from './registration';
export * from './sharing';
export * from './billing';
export * from './account';
