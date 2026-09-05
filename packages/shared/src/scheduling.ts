// Contracts for the scheduling feature area (stations, referees, match times,
// automated scheduling). Shared by the API (validation) and the web app.
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const scheduleDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const scheduleClockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');

export const scheduleDaySchema = z
  .object({
    date: scheduleDateSchema,
    startTime: scheduleClockTimeSchema,
    endTime: scheduleClockTimeSchema,
  })
  .refine((d) => d.startTime < d.endTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

export const refereeAvailabilityWindowSchema = z
  .object({
    date: scheduleDateSchema,
    startTime: scheduleClockTimeSchema,
    endTime: scheduleClockTimeSchema,
  })
  .refine((d) => d.startTime < d.endTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

export type ScheduleDay = z.infer<typeof scheduleDaySchema>;
export type RefereeAvailabilityWindow = z.infer<
  typeof refereeAvailabilityWindowSchema
>;

// ---------------------------------------------------------------------------
// Tournament.scheduleConfig
// ---------------------------------------------------------------------------

/**
 * Persisted on Tournament.scheduleConfig. Station ids and referees are NOT part
 * of this schema (they are derived from the Station / Referee tables at
 * generation time), except for the optional `stationIds` allow-list which the
 * generate form uses to restrict which open stations are used (empty = all).
 */
export const scheduleConfigSchema = z.object({
  days: z.array(scheduleDaySchema).max(60).default([]),
  slotMinutes: z.number().int().min(5).max(720).default(30),
  breakMinutes: z.number().int().min(0).max(240).default(0),
  restMinutes: z.number().int().min(0).max(1440).optional().nullable(),
  maxMatchesPerTeamPerDay: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .nullable(),
  timezone: z.string().min(1).max(64).default('UTC'),
  respectRounds: z.boolean().default(true),
  stageOrder: z.enum(['groups-first']).default('groups-first'),
  useReferees: z.boolean().default(true),
  stationIds: z.array(z.string()).optional(),
});

export type ScheduleConfigInput = z.infer<typeof scheduleConfigSchema>;

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfigInput = {
  days: [],
  slotMinutes: 30,
  breakMinutes: 0,
  restMinutes: null,
  maxMatchesPerTeamPerDay: null,
  timezone: 'UTC',
  respectRounds: true,
  stageOrder: 'groups-first',
  useReferees: true,
};

// ---------------------------------------------------------------------------
// Stations / referees
// ---------------------------------------------------------------------------

export const STATION_STATUSES = ['OPEN', 'IN_USE', 'CLOSED'] as const;
export type StationStatusValue = (typeof STATION_STATUSES)[number];

export const stationSchema = z.object({
  name: z.string().trim().min(1).max(60),
  privateDetails: z.string().trim().max(500).optional().nullable(),
  status: z.enum(STATION_STATUSES).optional(),
  order: z.number().int().min(0).optional(),
});
export const stationUpdateSchema = stationSchema.partial();
export const scheduleReorderSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export const refereeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160).optional().nullable(),
  availability: z.array(refereeAvailabilityWindowSchema).max(60).optional(),
  order: z.number().int().min(0).optional(),
});
export const refereeUpdateSchema = refereeSchema.partial();

export type StationInput = z.infer<typeof stationSchema>;
export type StationUpdateInput = z.infer<typeof stationUpdateSchema>;
export type ScheduleReorderInput = z.infer<typeof scheduleReorderSchema>;
export type RefereeInput = z.infer<typeof refereeSchema>;
export type RefereeUpdateInput = z.infer<typeof refereeUpdateSchema>;

// ---------------------------------------------------------------------------
// Match slot / bulk operations
// ---------------------------------------------------------------------------

export const matchSlotSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
  durationMinutes: z.number().int().min(1).max(1440).optional().nullable(),
  stationId: z.string().optional().nullable(),
  refereeId: z.string().optional().nullable(),
  /** Legacy free-text station label (kept in sync with stationRef.name). */
  station: z.string().trim().max(80).optional().nullable(),
});
export type MatchSlotInput = z.infer<typeof matchSlotSchema>;

export const autoScheduleSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  clearExisting: z.boolean().optional().default(false),
  keepLocked: z.boolean().optional().default(true),
  config: scheduleConfigSchema.partial().optional(),
});
export type AutoScheduleInput = z.infer<typeof autoScheduleSchema>;

export const bulkShiftSchema = z.object({
  date: scheduleDateSchema.optional(),
  minutes: z.number().int().min(-1440).max(1440),
});
export type BulkShiftInput = z.infer<typeof bulkShiftSchema>;

// ---------------------------------------------------------------------------
// Response shapes (API → web)
// ---------------------------------------------------------------------------

export type ScheduleConflictKind =
  | 'TEAM_OVERLAP'
  | 'TEAM_REST'
  | 'STATION_OVERLAP'
  | 'REFEREE_OVERLAP'
  | 'DEPENDENCY_ORDER';

export type ScheduleConflictDto = {
  kind: ScheduleConflictKind;
  matchIds: string[];
  message: string;
  teamId?: string | null;
  stationId?: string | null;
  refereeId?: string | null;
};

export type ScheduleTeamDto = {
  id: string;
  name: string;
  seed?: number | null;
  logoUrl?: string | null;
  poolColor?: string | null;
};

export type ScheduleStationDto = {
  id: string;
  name: string;
  status: StationStatusValue;
  order: number;
  privateDetails?: string | null;
};

export type ScheduleMatchDto = {
  id: string;
  key: string;
  round: number;
  position: number;
  bracketSide: string;
  groupId: string | null;
  groupName?: string | null;
  status: string;
  isBye: boolean;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeam: ScheduleTeamDto | null;
  awayTeam: ScheduleTeamDto | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  isDraw: boolean;
  scheduledAt: string | null;
  endAt: string | null;
  durationMinutes: number | null;
  stationId: string | null;
  station: ScheduleStationDto | null;
  /** Legacy label (Match.station). */
  stationLabel: string | null;
  refereeId: string | null;
  /** Only present when the viewer manages the tournament. */
  referee?: { id: string; name: string } | null;
  feederMatchIds: string[];
};

export type ScheduleTournamentDto = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
};

export type PublicScheduleResponse = {
  tournament: ScheduleTournamentDto;
  canManage: boolean;
  days: { date: string; matches: ScheduleMatchDto[] }[];
  unscheduled: ScheduleMatchDto[];
  stations: ScheduleStationDto[];
  conflicts: ScheduleConflictDto[];
};

export type StationQueueEntry = {
  station: ScheduleStationDto;
  current: ScheduleMatchDto | null;
  upNext: ScheduleMatchDto[];
  recentlyCompleted: ScheduleMatchDto[];
};

export type StationQueueResponse = {
  tournament: ScheduleTournamentDto;
  generatedAt: string;
  stations: StationQueueEntry[];
  unassigned: ScheduleMatchDto[];
};

export type ScheduleAssignmentDto = {
  matchId: string;
  startAt: string;
  endAt: string;
  stationId: string;
  refereeId?: string | null;
};

export type AutoScheduleResponse = {
  dryRun: boolean;
  assignments: ScheduleAssignmentDto[];
  unscheduled: { matchId: string; reason: string }[];
  conflicts: ScheduleConflictDto[];
  summary: {
    scheduled: number;
    total: number;
    firstStart: string | null;
    lastEnd: string | null;
    days: string[];
  };
  matches: ScheduleMatchDto[];
};

export type RefereeDto = {
  id: string;
  name: string;
  email: string | null;
  userId: string | null;
  availability: RefereeAvailabilityWindow[];
  order: number;
  hasAccessLink: boolean;
  assignedCount: number;
  createdAt?: string;
};

export type RefereePortalResponse = {
  referee: { id: string; name: string; email: string | null };
  tournament: ScheduleTournamentDto & { format: string | null; status: string };
  matches: ScheduleMatchDto[];
};

export type ScheduleConfigResponse = {
  config: ScheduleConfigInput;
  stations: ScheduleStationDto[];
  referees: RefereeDto[];
  timezone: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCHEDULE_TIMEZONES: string[] = [
  'UTC',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Phoenix',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Atlantic/Reykjavik',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Athens',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Manila',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export const BRACKET_SIDE_LABELS: Record<string, string> = {
  GROUP: 'Group',
  SWISS: 'Swiss',
  WINNERS: 'Winners',
  LOSERS: 'Losers',
  FINAL: 'Final',
  GRAND_FINAL: 'Grand Final',
};
