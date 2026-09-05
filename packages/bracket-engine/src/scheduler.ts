/**
 * Automated match scheduler (Score7-style) + conflict detection.
 *
 * Pure & deterministic: no I/O, no randomness. Timezone handling is done with
 * the platform `Intl` API so this package stays dependency-free.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScheduleDayWindow = {
  /** YYYY-MM-DD in the schedule timezone */
  date: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
};

export type ScheduleRefereeInput = {
  id: string;
  /** Empty / undefined → always available. */
  availability?: ScheduleDayWindow[];
};

export type ScheduleConfig = {
  days: ScheduleDayWindow[];
  /** Match duration incl. changeover. */
  slotMinutes: number;
  /** Gap between consecutive slots. */
  breakMinutes?: number;
  /** Minimum gap between two matches of the same team (default slotMinutes). */
  restMinutes?: number | null;
  maxMatchesPerTeamPerDay?: number | null;
  stationIds: string[];
  referees?: ScheduleRefereeInput[];
  /** IANA timezone the day windows are expressed in. */
  timezone: string;
  /**
   * true (default): every match of round r (same stage/side/group) must end
   * before round r+1 starts. false: only the direct feeder matches must end.
   */
  respectRounds?: boolean;
  stageOrder?: 'groups-first';
};

export type SchedulableMatch = {
  id: string;
  round: number;
  bracketSide: string;
  groupId?: string | null;
  position?: number;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  /** Matches whose winner/loser feeds into this one. */
  feederMatchIds: string[];
  isBye?: boolean;
  /** Already manually scheduled — keep as is. */
  locked?: { startAt: string; stationId?: string | null; refereeId?: string | null } | null;
};

export type ScheduleAssignment = {
  matchId: string;
  startAt: string;
  endAt: string;
  stationId: string;
  refereeId?: string | null;
};

export type ScheduleConflictKind =
  | 'TEAM_OVERLAP'
  | 'TEAM_REST'
  | 'STATION_OVERLAP'
  | 'REFEREE_OVERLAP'
  | 'DEPENDENCY_ORDER';

export type ScheduleConflict = {
  kind: ScheduleConflictKind;
  matchIds: string[];
  message: string;
  teamId?: string | null;
  stationId?: string | null;
  refereeId?: string | null;
};

export type ScheduleResult = {
  assignments: ScheduleAssignment[];
  unscheduled: { matchId: string; reason: string }[];
  conflicts: ScheduleConflict[];
};

export type ScheduledMatchLike = {
  matchId: string;
  startAt: string;
  endAt: string;
  stationId?: string | null;
  refereeId?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  feederMatchIds?: string[];
};

export type TimeSlot = {
  /** YYYY-MM-DD of the day window the slot belongs to. */
  date: string;
  startMs: number;
  endMs: number;
};

const MINUTE = 60_000;

// ---------------------------------------------------------------------------
// Timezone helpers (Intl-based, no dependencies)
// ---------------------------------------------------------------------------

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat | null {
  const cached = dtfCache.get(timeZone);
  if (cached) return cached;
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(timeZone, f);
    return f;
  } catch {
    return null;
  }
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(utcMs: number, formatter: Intl.DateTimeFormat): number {
  const parts = formatter.formatToParts(new Date(utcMs));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const hour = get('hour') % 24;
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return asUtc - utcMs;
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC instant (ms). Equivalent to
 * date-fns-tz `fromZonedTime`. Invalid time zones fall back to UTC.
 */
export function zonedTimeToUtcMs(
  date: string,
  time: string,
  timeZone: string,
): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  const formatter = getFormatter(timeZone);
  if (!formatter) return guess;
  const off1 = tzOffsetMs(guess, formatter);
  let utc = guess - off1;
  const off2 = tzOffsetMs(utc, formatter);
  if (off2 !== off1) utc = guess - off2;
  return utc;
}

/** YYYY-MM-DD of an instant as seen in `timeZone`. */
export function dateKeyInZone(iso: string | number | Date, timeZone: string): string {
  const ms = typeof iso === 'number' ? iso : new Date(iso).getTime();
  const formatter = getFormatter(timeZone);
  if (!formatter) return new Date(ms).toISOString().slice(0, 10);
  const parts = formatter.formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

/** Build chronological time slots from the day windows of a config. */
export function buildTimeSlots(
  config: Pick<
    ScheduleConfig,
    'days' | 'slotMinutes' | 'breakMinutes' | 'timezone'
  >,
): TimeSlot[] {
  const slotMs = Math.max(1, config.slotMinutes) * MINUTE;
  const stepMs = slotMs + Math.max(0, config.breakMinutes ?? 0) * MINUTE;
  const slots: TimeSlot[] = [];
  const days = [...config.days].sort((a, b) =>
    a.date === b.date
      ? a.startTime.localeCompare(b.startTime)
      : a.date.localeCompare(b.date),
  );
  for (const day of days) {
    const start = zonedTimeToUtcMs(day.date, day.startTime, config.timezone);
    const end = zonedTimeToUtcMs(day.date, day.endTime, config.timezone);
    if (!(end > start)) continue;
    for (let s = start; s + slotMs <= end; s += stepMs) {
      slots.push({ date: day.date, startMs: s, endMs: s + slotMs });
    }
  }
  slots.sort((a, b) => a.startMs - b.startMs);
  return slots;
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

const KNOCKOUT_SIDE_RANK: Record<string, number> = {
  WINNERS: 0,
  LOSERS: 1,
  FINAL: 2,
  GRAND_FINAL: 3,
};

function stageRank(side: string): number {
  return side === 'GROUP' || side === 'SWISS' ? 0 : 1;
}

function computeDepths(matches: SchedulableMatch[]): Map<string, number> {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    const m = byId.get(id);
    if (!m) return -1;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let d = 0;
    for (const f of m.feederMatchIds ?? []) {
      if (byId.has(f)) d = Math.max(d, visit(f) + 1);
    }
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const m of matches) visit(m.id);
  return depth;
}

/** Deterministic processing order: groups first, then knockout by dependency depth/round. */
export function orderMatchesForScheduling(
  matches: SchedulableMatch[],
): SchedulableMatch[] {
  const depth = computeDepths(matches);
  return [...matches].sort((a, b) => {
    const sa = stageRank(a.bracketSide);
    const sb = stageRank(b.bracketSide);
    if (sa !== sb) return sa - sb;
    if (sa === 0) {
      if (a.round !== b.round) return a.round - b.round;
      const ga = a.groupId ?? '';
      const gb = b.groupId ?? '';
      if (ga !== gb) return ga < gb ? -1 : 1;
    } else {
      const da = depth.get(a.id) ?? 0;
      const db = depth.get(b.id) ?? 0;
      if (da !== db) return da - db;
      if (a.round !== b.round) return a.round - b.round;
      const ra = KNOCKOUT_SIDE_RANK[a.bracketSide] ?? 9;
      const rb = KNOCKOUT_SIDE_RANK[b.bracketSide] ?? 9;
      if (ra !== rb) return ra - rb;
    }
    const pa = a.position ?? 0;
    const pb = b.position ?? 0;
    if (pa !== pb) return pa - pb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

type Interval = { startMs: number; endMs: number; matchId: string };

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function roundKey(m: SchedulableMatch): string {
  const stage = stageRank(m.bracketSide) === 0 ? `G:${m.groupId ?? ''}` : `K:${m.bracketSide}`;
  return `${stage}#${m.round}`;
}

function roundGroupKey(m: SchedulableMatch): string {
  return stageRank(m.bracketSide) === 0 ? `G:${m.groupId ?? ''}` : `K:${m.bracketSide}`;
}

export function generateSchedule(
  matches: SchedulableMatch[],
  config: ScheduleConfig,
): ScheduleResult {
  const slotMinutes = Math.max(1, config.slotMinutes);
  const slotMs = slotMinutes * MINUTE;
  const restMs =
    Math.max(0, config.restMinutes ?? slotMinutes) * MINUTE;
  const maxPerDay = config.maxMatchesPerTeamPerDay ?? null;
  const respectRounds = config.respectRounds !== false;
  const stationIds = [...config.stationIds];
  const referees = (config.referees ?? []).map((r) => ({
    id: r.id,
    windows: (r.availability ?? []).map((w) => ({
      startMs: zonedTimeToUtcMs(w.date, w.startTime, config.timezone),
      endMs: zonedTimeToUtcMs(w.date, w.endTime, config.timezone),
    })),
  }));
  const slots = buildTimeSlots(config);

  const stationBusy = new Map<string, Interval[]>();
  const teamBusy = new Map<string, Interval[]>();
  const teamDaily = new Map<string, number>(); // `${teamId}|${date}`
  const refBusy = new Map<string, Interval[]>();
  const matchEnd = new Map<string, number>();
  const roundEnds = new Map<string, number>(); // roundKey → latest end
  const assignments: ScheduleAssignment[] = [];
  const unscheduled: { matchId: string; reason: string }[] = [];
  let refCursor = 0;

  const push = (map: Map<string, Interval[]>, key: string, iv: Interval) => {
    const list = map.get(key);
    if (list) list.push(iv);
    else map.set(key, [iv]);
  };

  const record = (m: SchedulableMatch, a: ScheduleAssignment) => {
    const startMs = Date.parse(a.startAt);
    const endMs = Date.parse(a.endAt);
    const iv = { startMs, endMs, matchId: m.id };
    if (a.stationId) push(stationBusy, a.stationId, iv);
    for (const t of [m.homeTeamId, m.awayTeamId]) {
      if (!t) continue;
      push(teamBusy, t, iv);
      const k = `${t}|${dateKeyInZone(startMs, config.timezone)}`;
      teamDaily.set(k, (teamDaily.get(k) ?? 0) + 1);
    }
    if (a.refereeId) push(refBusy, a.refereeId, iv);
    matchEnd.set(m.id, endMs);
    const rk = roundKey(m);
    roundEnds.set(rk, Math.max(roundEnds.get(rk) ?? 0, endMs));
    assignments.push(a);
  };

  const candidates = matches.filter((m) => !m.isBye);
  const ordered = orderMatchesForScheduling(candidates);

  // Locked matches occupy resources first.
  for (const m of ordered) {
    if (!m.locked?.startAt) continue;
    const startMs = Date.parse(m.locked.startAt);
    if (Number.isNaN(startMs)) continue;
    record(m, {
      matchId: m.id,
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(startMs + slotMs).toISOString(),
      stationId: m.locked.stationId ?? '',
      refereeId: m.locked.refereeId ?? null,
    });
  }

  const byId = new Map(candidates.map((m) => [m.id, m]));

  for (const m of ordered) {
    if (m.locked?.startAt && !Number.isNaN(Date.parse(m.locked.startAt))) continue;

    if (slots.length === 0) {
      unscheduled.push({ matchId: m.id, reason: 'No time slots configured' });
      continue;
    }
    if (stationIds.length === 0) {
      unscheduled.push({ matchId: m.id, reason: 'No open stations' });
      continue;
    }

    // Earliest allowed start from dependencies.
    let earliest = 0;
    let missingFeeder = false;
    for (const f of m.feederMatchIds ?? []) {
      const end = matchEnd.get(f);
      if (end !== undefined) earliest = Math.max(earliest, end);
      else if (byId.has(f)) missingFeeder = true;
    }
    if (respectRounds) {
      const gk = roundGroupKey(m);
      for (const [rk, end] of roundEnds) {
        const [g, r] = rk.split('#');
        if (g === gk && Number(r) < m.round) earliest = Math.max(earliest, end);
      }
    }

    const teams = [m.homeTeamId, m.awayTeamId].filter(
      (t): t is string => !!t,
    );

    let placed = false;
    const rejected = { dependency: 0, team: 0, daily: 0, station: 0 };

    for (const slot of slots) {
      if (slot.startMs < earliest) {
        rejected.dependency++;
        continue;
      }
      let ok = true;
      for (const t of teams) {
        for (const iv of teamBusy.get(t) ?? []) {
          if (overlaps(slot.startMs - restMs, slot.endMs + restMs, iv.startMs, iv.endMs)) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (!ok) {
        rejected.team++;
        continue;
      }
      if (maxPerDay != null) {
        for (const t of teams) {
          if ((teamDaily.get(`${t}|${slot.date}`) ?? 0) >= maxPerDay) {
            ok = false;
            break;
          }
        }
        if (!ok) {
          rejected.daily++;
          continue;
        }
      }
      const station = stationIds.find(
        (sid) =>
          !(stationBusy.get(sid) ?? []).some((iv) =>
            overlaps(slot.startMs, slot.endMs, iv.startMs, iv.endMs),
          ),
      );
      if (!station) {
        rejected.station++;
        continue;
      }

      let refereeId: string | null = null;
      if (referees.length) {
        for (let i = 0; i < referees.length; i++) {
          const r = referees[(refCursor + i) % referees.length];
          const available =
            r.windows.length === 0 ||
            r.windows.some(
              (w) => w.startMs <= slot.startMs && slot.endMs <= w.endMs,
            );
          if (!available) continue;
          const busy = (refBusy.get(r.id) ?? []).some((iv) =>
            overlaps(slot.startMs, slot.endMs, iv.startMs, iv.endMs),
          );
          if (busy) continue;
          refereeId = r.id;
          refCursor = (refCursor + i + 1) % referees.length;
          break;
        }
      }

      record(m, {
        matchId: m.id,
        startAt: new Date(slot.startMs).toISOString(),
        endAt: new Date(slot.endMs).toISOString(),
        stationId: station,
        refereeId,
      });
      placed = true;
      break;
    }

    if (!placed) {
      let reason = 'No free slot left';
      if (missingFeeder && rejected.dependency === slots.length) {
        reason = 'Feeder match could not be scheduled';
      } else if (rejected.dependency === slots.length) {
        reason = 'All slots are before the earliest allowed start (dependencies / round order)';
      } else if (rejected.station > 0 && rejected.team === 0 && rejected.daily === 0) {
        reason = 'All stations are busy in the remaining slots';
      } else if (rejected.daily > 0 && rejected.station === 0 && rejected.team === 0) {
        reason = 'Team reached the daily match limit';
      } else if (rejected.team > 0 && rejected.station === 0 && rejected.daily === 0) {
        reason = 'Team rest rule blocks every remaining slot';
      } else {
        reason = `No slot satisfies constraints (station busy: ${rejected.station}, team rest: ${rejected.team}, daily limit: ${rejected.daily}, too early: ${rejected.dependency})`;
      }
      unscheduled.push({ matchId: m.id, reason });
    }
  }

  assignments.sort(
    (a, b) =>
      Date.parse(a.startAt) - Date.parse(b.startAt) ||
      a.stationId.localeCompare(b.stationId) ||
      a.matchId.localeCompare(b.matchId),
  );

  const conflicts = detectConflicts(
    assignments.map((a) => {
      const m = byId.get(a.matchId);
      return {
        ...a,
        homeTeamId: m?.homeTeamId ?? null,
        awayTeamId: m?.awayTeamId ?? null,
        feederMatchIds: m?.feederMatchIds ?? [],
      };
    }),
    restMs / MINUTE,
  );

  return { assignments, unscheduled, conflicts };
}

// ---------------------------------------------------------------------------
// Conflicts
// ---------------------------------------------------------------------------

export function detectConflicts(
  scheduled: ScheduledMatchLike[],
  restMinutes = 0,
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const restMs = Math.max(0, restMinutes) * MINUTE;
  const items = scheduled
    .map((s) => ({
      ...s,
      startMs: Date.parse(s.startAt),
      endMs: Date.parse(s.endAt),
    }))
    .filter((s) => !Number.isNaN(s.startMs) && !Number.isNaN(s.endMs))
    .sort((a, b) => a.startMs - b.startMs);
  const byId = new Map(items.map((i) => [i.matchId, i]));

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      const over = overlaps(a.startMs, a.endMs, b.startMs, b.endMs);

      if (over && a.stationId && a.stationId === b.stationId) {
        conflicts.push({
          kind: 'STATION_OVERLAP',
          matchIds: [a.matchId, b.matchId],
          stationId: a.stationId,
          message: 'Two matches overlap on the same station',
        });
      }
      if (over && a.refereeId && a.refereeId === b.refereeId) {
        conflicts.push({
          kind: 'REFEREE_OVERLAP',
          matchIds: [a.matchId, b.matchId],
          refereeId: a.refereeId,
          message: 'Referee is assigned to two overlapping matches',
        });
      }
      const teamsA = [a.homeTeamId, a.awayTeamId].filter((t): t is string => !!t);
      const teamsB = new Set(
        [b.homeTeamId, b.awayTeamId].filter((t): t is string => !!t),
      );
      for (const t of teamsA) {
        if (!teamsB.has(t)) continue;
        if (over) {
          conflicts.push({
            kind: 'TEAM_OVERLAP',
            matchIds: [a.matchId, b.matchId],
            teamId: t,
            message: 'Team plays two matches at the same time',
          });
        } else if (restMs > 0) {
          const gap = Math.max(b.startMs - a.endMs, a.startMs - b.endMs);
          if (gap < restMs) {
            conflicts.push({
              kind: 'TEAM_REST',
              matchIds: [a.matchId, b.matchId],
              teamId: t,
              message: `Team has less than ${Math.round(restMs / MINUTE)} min rest between matches`,
            });
          }
        }
      }
    }
    for (const f of a.feederMatchIds ?? []) {
      const feeder = byId.get(f);
      if (feeder && feeder.endMs > a.startMs) {
        conflicts.push({
          kind: 'DEPENDENCY_ORDER',
          matchIds: [f, a.matchId],
          message: 'Match starts before its feeder match ends',
        });
      }
    }
  }
  return conflicts;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function shiftSchedule<T extends { startAt: string; endAt: string }>(
  assignments: T[],
  minutes: number,
): T[] {
  const delta = minutes * MINUTE;
  return assignments.map((a) => ({
    ...a,
    startAt: new Date(Date.parse(a.startAt) + delta).toISOString(),
    endAt: new Date(Date.parse(a.endAt) + delta).toISOString(),
  }));
}

export function summarizeSchedule(
  assignments: { startAt: string; endAt: string }[],
  total: number,
  timezone = 'UTC',
): {
  scheduled: number;
  total: number;
  firstStart: string | null;
  lastEnd: string | null;
  days: string[];
} {
  if (!assignments.length) {
    return { scheduled: 0, total, firstStart: null, lastEnd: null, days: [] };
  }
  let first = Infinity;
  let last = -Infinity;
  const days = new Set<string>();
  for (const a of assignments) {
    const s = Date.parse(a.startAt);
    const e = Date.parse(a.endAt);
    if (s < first) first = s;
    if (e > last) last = e;
    days.add(dateKeyInZone(s, timezone));
  }
  return {
    scheduled: assignments.length,
    total,
    firstStart: new Date(first).toISOString(),
    lastEnd: new Date(last).toISOString(),
    days: [...days].sort(),
  };
}
