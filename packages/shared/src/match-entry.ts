import { z } from 'zod';

/** How match results are entered in the manage UI. */
export const MatchEntryMode = {
  SCORE: 'score',
  CRICKET: 'cricket',
  FOOTBALL: 'football',
  ESPORTS_SERIES: 'esports-series',
  COC_WAR: 'coc-war',
  SET_SPORT: 'set-sport',
} as const;

export type MatchEntryMode =
  (typeof MatchEntryMode)[keyof typeof MatchEntryMode];

export const matchMetaSchema = z
  .object({
    /** Clash of Clans — war prep/attack window start (ISO datetime). */
    attackStartAt: z.string().datetime().optional().nullable(),
    /** Clash of Clans — war duration in hours (default 24). */
    warHours: z.number().min(1).max(48).optional().nullable(),
    /** Esports — maps won in series (when bestOf > 1). */
    homeMapsWon: z.number().min(0).optional().nullable(),
    awayMapsWon: z.number().min(0).optional().nullable(),
    /** Esports — optional MVP / standout player note. */
    mvpNote: z.string().max(120).optional().nullable(),
    /** Football — first-half scores (full-time still in homeScore/awayScore). */
    htHomeScore: z.number().min(0).optional().nullable(),
    htAwayScore: z.number().min(0).optional().nullable(),
    /** Cricket — manual full match report summary (runs/wkts/overs per innings). */
    cricketReport: z
      .object({
        firstBattingTeamId: z.string(),
        innings: z.array(
          z.object({
            inningsNumber: z.number().int().min(1).max(2),
            battingTeamId: z.string(),
            runs: z.number().int().min(0),
            wickets: z.number().int().min(0),
            overs: z.string(),
            extras: z.number().int().min(0).optional(),
          }),
        ),
      })
      .optional()
      .nullable(),
    /** Cricket — pre-match toss (winner + bat/bowl). */
    cricketToss: z
      .object({
        winnerTeamId: z.string(),
        decision: z.enum(['BAT', 'BOWL']),
      })
      .optional()
      .nullable(),
  })
  .optional()
  .nullable();

export type MatchMeta = z.infer<typeof matchMetaSchema>;

export type MatchEntryField = {
  key: string;
  label: string;
  type: 'number' | 'percent' | 'datetime' | 'text';
  min?: number;
  max?: number;
  hint?: string;
};

export const MATCH_ENTRY_FIELDS: Record<MatchEntryMode, MatchEntryField[]> = {
  score: [
    { key: 'homeScore', label: 'Home score', type: 'number', min: 0 },
    { key: 'awayScore', label: 'Away score', type: 'number', min: 0 },
  ],
  cricket: [],
  football: [
    { key: 'homeScore', label: 'Full-time goals', type: 'number', min: 0 },
    { key: 'awayScore', label: 'Full-time goals', type: 'number', min: 0 },
    { key: 'htHomeScore', label: 'Half-time (home)', type: 'number', min: 0, hint: 'Optional' },
    { key: 'htAwayScore', label: 'Half-time (away)', type: 'number', min: 0, hint: 'Optional' },
  ],
  'esports-series': [
    { key: 'homeScore', label: 'Maps / games won', type: 'number', min: 0 },
    { key: 'awayScore', label: 'Maps / games won', type: 'number', min: 0 },
    { key: 'homeMapsWon', label: 'Home series score', type: 'number', min: 0, hint: 'If Bo3/Bo5' },
    { key: 'awayMapsWon', label: 'Away series score', type: 'number', min: 0, hint: 'If Bo3/Bo5' },
  ],
  'coc-war': [
    { key: 'homeScore', label: 'Stars (home clan)', type: 'number', min: 0, max: 3, hint: '0–3 stars' },
    { key: 'awayScore', label: 'Stars (away clan)', type: 'number', min: 0, max: 3, hint: '0–3 stars' },
    { key: 'homePercent', label: 'Destruction % (home)', type: 'percent', min: 0, max: 100 },
    { key: 'awayPercent', label: 'Destruction % (away)', type: 'percent', min: 0, max: 100 },
    { key: 'attackStartAt', label: 'Attack window start', type: 'datetime' },
    { key: 'warHours', label: 'War duration (hours)', type: 'number', min: 1, max: 48 },
  ],
  'set-sport': [
    { key: 'homeScore', label: 'Sets won', type: 'number', min: 0, max: 5 },
    { key: 'awayScore', label: 'Sets won', type: 'number', min: 0, max: 5 },
    { key: 'homePercent', label: 'Games/points won (home)', type: 'number', min: 0, hint: 'Optional tiebreak' },
    { key: 'awayPercent', label: 'Games/points won (away)', type: 'number', min: 0, hint: 'Optional tiebreak' },
  ],
};
