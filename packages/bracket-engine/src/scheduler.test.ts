import { describe, expect, it } from 'vitest';
import {
  buildTimeSlots,
  detectConflicts,
  generateSchedule,
  orderMatchesForScheduling,
  shiftSchedule,
  zonedTimeToUtcMs,
  type SchedulableMatch,
  type ScheduleConfig,
} from './scheduler';
import { generateSingleElimination } from './index';

const teams = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));

/** Convert engine-generated matches (keys) to schedulable matches (ids = keys). */
function toSchedulable(
  generated: ReturnType<typeof generateSingleElimination>,
): SchedulableMatch[] {
  return generated.map((m) => ({
    id: m.key,
    round: m.round,
    position: m.position,
    bracketSide: m.bracketSide,
    groupId: m.groupId ?? null,
    homeTeamId: m.homeTeamId ?? null,
    awayTeamId: m.awayTeamId ?? null,
    isBye: m.isBye ?? false,
    feederMatchIds: [m.homeFromMatchKey, m.awayFromMatchKey].filter(
      (k): k is string => !!k,
    ),
  }));
}

const baseConfig: ScheduleConfig = {
  days: [{ date: '2026-06-06', startTime: '09:00', endTime: '18:00' }],
  slotMinutes: 60,
  breakMinutes: 0,
  stationIds: ['s1', 's2'],
  timezone: 'UTC',
};

describe('zonedTimeToUtcMs', () => {
  it('converts wall-clock time in a zone to UTC', () => {
    // 09:00 in Paris in June is 07:00Z (CEST, UTC+2)
    expect(new Date(zonedTimeToUtcMs('2026-06-06', '09:00', 'Europe/Paris')).toISOString()).toBe(
      '2026-06-06T07:00:00.000Z',
    );
    // 09:00 in Dhaka (UTC+6) is 03:00Z
    expect(new Date(zonedTimeToUtcMs('2026-06-06', '09:00', 'Asia/Dhaka')).toISOString()).toBe(
      '2026-06-06T03:00:00.000Z',
    );
    expect(new Date(zonedTimeToUtcMs('2026-06-06', '09:00', 'UTC')).toISOString()).toBe(
      '2026-06-06T09:00:00.000Z',
    );
  });

  it('falls back to UTC for unknown zones', () => {
    expect(zonedTimeToUtcMs('2026-01-01', '00:00', 'Not/AZone')).toBe(
      Date.UTC(2026, 0, 1),
    );
  });
});

describe('buildTimeSlots', () => {
  it('creates slots between start and end honoring breaks', () => {
    const slots = buildTimeSlots({
      days: [{ date: '2026-06-06', startTime: '09:00', endTime: '12:00' }],
      slotMinutes: 45,
      breakMinutes: 15,
      timezone: 'UTC',
    });
    // 09:00, 10:00, 11:00 (11:00+45 = 11:45 <= 12:00)
    expect(slots.map((s) => new Date(s.startMs).toISOString().slice(11, 16))).toEqual([
      '09:00',
      '10:00',
      '11:00',
    ]);
    expect(slots[0].endMs - slots[0].startMs).toBe(45 * 60_000);
  });

  it('sorts multiple days chronologically', () => {
    const slots = buildTimeSlots({
      days: [
        { date: '2026-06-07', startTime: '09:00', endTime: '10:00' },
        { date: '2026-06-06', startTime: '09:00', endTime: '10:00' },
      ],
      slotMinutes: 30,
      timezone: 'UTC',
    });
    expect(slots.map((s) => s.date)).toEqual([
      '2026-06-06',
      '2026-06-06',
      '2026-06-07',
      '2026-06-07',
    ]);
  });
});

describe('orderMatchesForScheduling', () => {
  it('puts group matches before knockout and orders knockout by dependency depth', () => {
    const matches: SchedulableMatch[] = [
      { id: 'final', round: 3, bracketSide: 'FINAL', feederMatchIds: ['sf1', 'sf2'] },
      { id: 'sf1', round: 2, bracketSide: 'WINNERS', feederMatchIds: [] },
      { id: 'g-r2', round: 2, bracketSide: 'GROUP', groupId: 'A', feederMatchIds: [] },
      { id: 'sf2', round: 2, bracketSide: 'WINNERS', feederMatchIds: [] },
      { id: 'g-r1', round: 1, bracketSide: 'GROUP', groupId: 'A', feederMatchIds: [] },
    ];
    expect(orderMatchesForScheduling(matches).map((m) => m.id)).toEqual([
      'g-r1',
      'g-r2',
      'sf1',
      'sf2',
      'final',
    ]);
  });
});

describe('generateSchedule', () => {
  it('fits an 8-team single elimination on 2 stations into 5 slots', () => {
    const matches = toSchedulable(generateSingleElimination(teams(8)));
    const result = generateSchedule(matches, baseConfig);
    expect(result.unscheduled).toEqual([]);
    expect(result.assignments).toHaveLength(7);
    expect(result.conflicts).toEqual([]);

    // Round 1: 4 matches on 2 stations = 2 slots; R2: 2 matches = 1 slot; final = 1 slot
    const starts = [...new Set(result.assignments.map((a) => a.startAt))].sort();
    expect(starts).toEqual([
      '2026-06-06T09:00:00.000Z',
      '2026-06-06T10:00:00.000Z',
      '2026-06-06T11:00:00.000Z',
      '2026-06-06T12:00:00.000Z',
    ]);
    const final = result.assignments.find((a) => a.matchId === 'se-r3-p0')!;
    expect(final.startAt).toBe('2026-06-06T12:00:00.000Z');
    expect(final.endAt).toBe('2026-06-06T13:00:00.000Z');
    expect(['s1', 's2']).toContain(final.stationId);
  });

  it('honors the rest rule between matches of the same team', () => {
    const matches: SchedulableMatch[] = [
      { id: 'm1', round: 1, bracketSide: 'GROUP', homeTeamId: 'a', awayTeamId: 'b', feederMatchIds: [] },
      { id: 'm2', round: 1, bracketSide: 'GROUP', homeTeamId: 'a', awayTeamId: 'c', feederMatchIds: [] },
    ];
    const result = generateSchedule(matches, {
      ...baseConfig,
      slotMinutes: 30,
      restMinutes: 60,
      stationIds: ['s1', 's2', 's3'],
    });
    expect(result.unscheduled).toEqual([]);
    const [a, b] = result.assignments;
    // m1 09:00-09:30, m2 must start >= 10:30 (30 min match + 60 min rest)
    expect(a.startAt).toBe('2026-06-06T09:00:00.000Z');
    expect(b.startAt).toBe('2026-06-06T10:30:00.000Z');
    expect(result.conflicts).toEqual([]);
  });

  it('uses the slot length as the default rest', () => {
    const matches: SchedulableMatch[] = [
      { id: 'm1', round: 1, bracketSide: 'GROUP', homeTeamId: 'a', awayTeamId: 'b', feederMatchIds: [] },
      { id: 'm2', round: 1, bracketSide: 'GROUP', homeTeamId: 'a', awayTeamId: 'c', feederMatchIds: [] },
    ];
    const result = generateSchedule(matches, { ...baseConfig, stationIds: ['s1', 's2'] });
    expect(result.assignments.map((a) => a.startAt)).toEqual([
      '2026-06-06T09:00:00.000Z',
      '2026-06-06T11:00:00.000Z',
    ]);
  });

  it('respects dependency order: a match starts only after its feeders end', () => {
    const matches: SchedulableMatch[] = [
      { id: 'f', round: 2, bracketSide: 'WINNERS', feederMatchIds: ['a', 'b'] },
      { id: 'a', round: 1, bracketSide: 'WINNERS', homeTeamId: 't1', awayTeamId: 't2', feederMatchIds: [] },
      { id: 'b', round: 1, bracketSide: 'WINNERS', homeTeamId: 't3', awayTeamId: 't4', feederMatchIds: [] },
    ];
    const result = generateSchedule(matches, {
      ...baseConfig,
      stationIds: ['s1'],
      respectRounds: false,
    });
    const by = Object.fromEntries(result.assignments.map((a) => [a.matchId, a]));
    expect(Date.parse(by.f.startAt)).toBeGreaterThanOrEqual(Date.parse(by.a.endAt));
    expect(Date.parse(by.f.startAt)).toBeGreaterThanOrEqual(Date.parse(by.b.endAt));
    expect(result.conflicts).toEqual([]);
  });

  it('with respectRounds, round 2 waits for the whole of round 1', () => {
    const matches: SchedulableMatch[] = [
      { id: 'r1a', round: 1, bracketSide: 'WINNERS', homeTeamId: 't1', awayTeamId: 't2', feederMatchIds: [] },
      { id: 'r1b', round: 1, bracketSide: 'WINNERS', homeTeamId: 't3', awayTeamId: 't4', feederMatchIds: [] },
      { id: 'r1c', round: 1, bracketSide: 'WINNERS', homeTeamId: 't5', awayTeamId: 't6', feederMatchIds: [] },
      // depends only on r1a/r1b, but respectRounds forces it after r1c too
      { id: 'r2a', round: 2, bracketSide: 'WINNERS', feederMatchIds: ['r1a', 'r1b'] },
    ];
    const strict = generateSchedule(matches, { ...baseConfig, stationIds: ['s1', 's2'] });
    const strictBy = Object.fromEntries(strict.assignments.map((a) => [a.matchId, a]));
    expect(strictBy.r2a.startAt).toBe('2026-06-06T11:00:00.000Z');

    const relaxed = generateSchedule(matches, {
      ...baseConfig,
      stationIds: ['s1', 's2'],
      respectRounds: false,
    });
    const relaxedBy = Object.fromEntries(relaxed.assignments.map((a) => [a.matchId, a]));
    // r1a, r1b at 09:00; r1c at 10:00 on s1; r2a can take s2 at 10:00
    expect(relaxedBy.r2a.startAt).toBe('2026-06-06T10:00:00.000Z');
  });

  it('skips byes and reports unscheduled matches with a reason', () => {
    const matches: SchedulableMatch[] = [
      { id: 'bye', round: 1, bracketSide: 'WINNERS', isBye: true, homeTeamId: 't1', feederMatchIds: [] },
      { id: 'm1', round: 1, bracketSide: 'WINNERS', homeTeamId: 't2', awayTeamId: 't3', feederMatchIds: [] },
      { id: 'm2', round: 1, bracketSide: 'WINNERS', homeTeamId: 't4', awayTeamId: 't5', feederMatchIds: [] },
    ];
    const result = generateSchedule(matches, {
      ...baseConfig,
      days: [{ date: '2026-06-06', startTime: '09:00', endTime: '10:00' }],
      stationIds: ['s1'],
    });
    expect(result.assignments.map((a) => a.matchId)).toEqual(['m1']);
    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0].matchId).toBe('m2');
    expect(result.unscheduled[0].reason).toMatch(/station/i);
  });

  it('enforces maxMatchesPerTeamPerDay', () => {
    const matches: SchedulableMatch[] = [
      { id: 'm1', round: 1, bracketSide: 'GROUP', homeTeamId: 'a', awayTeamId: 'b', feederMatchIds: [] },
      { id: 'm2', round: 2, bracketSide: 'GROUP', homeTeamId: 'a', awayTeamId: 'c', feederMatchIds: [] },
      { id: 'm3', round: 3, bracketSide: 'GROUP', homeTeamId: 'a', awayTeamId: 'd', feederMatchIds: [] },
    ];
    const result = generateSchedule(matches, {
      ...baseConfig,
      days: [
        { date: '2026-06-06', startTime: '09:00', endTime: '18:00' },
        { date: '2026-06-07', startTime: '09:00', endTime: '18:00' },
      ],
      maxMatchesPerTeamPerDay: 2,
      stationIds: ['s1'],
    });
    expect(result.unscheduled).toEqual([]);
    const m3 = result.assignments.find((a) => a.matchId === 'm3')!;
    expect(m3.startAt.slice(0, 10)).toBe('2026-06-07');
  });

  it('assigns referees round-robin, respecting availability', () => {
    const matches: SchedulableMatch[] = [
      { id: 'm1', round: 1, bracketSide: 'GROUP', homeTeamId: 'a', awayTeamId: 'b', feederMatchIds: [] },
      { id: 'm2', round: 1, bracketSide: 'GROUP', homeTeamId: 'c', awayTeamId: 'd', feederMatchIds: [] },
      { id: 'm3', round: 1, bracketSide: 'GROUP', homeTeamId: 'e', awayTeamId: 'f', feederMatchIds: [] },
    ];
    const result = generateSchedule(matches, {
      ...baseConfig,
      stationIds: ['s1', 's2', 's3'],
      referees: [
        { id: 'ref1' },
        {
          id: 'ref2',
          availability: [{ date: '2026-06-06', startTime: '13:00', endTime: '18:00' }],
        },
        { id: 'ref3' },
      ],
    });
    // All three at 09:00 — ref2 is unavailable in the morning.
    const refs = result.assignments.map((a) => a.refereeId);
    expect(refs).toEqual(['ref1', 'ref3', null]);
    expect(result.conflicts.filter((c) => c.kind === 'REFEREE_OVERLAP')).toEqual([]);
  });

  it('keeps locked matches and schedules around them', () => {
    const matches: SchedulableMatch[] = [
      {
        id: 'locked',
        round: 1,
        bracketSide: 'GROUP',
        homeTeamId: 'a',
        awayTeamId: 'b',
        feederMatchIds: [],
        locked: { startAt: '2026-06-06T09:00:00.000Z', stationId: 's1' },
      },
      { id: 'free', round: 1, bracketSide: 'GROUP', homeTeamId: 'c', awayTeamId: 'd', feederMatchIds: [] },
    ];
    const result = generateSchedule(matches, { ...baseConfig, stationIds: ['s1'] });
    const by = Object.fromEntries(result.assignments.map((a) => [a.matchId, a]));
    expect(by.locked.startAt).toBe('2026-06-06T09:00:00.000Z');
    expect(by.locked.stationId).toBe('s1');
    expect(by.free.startAt).toBe('2026-06-06T10:00:00.000Z');
  });

  it('places day windows in the configured timezone', () => {
    const matches: SchedulableMatch[] = [
      { id: 'm1', round: 1, bracketSide: 'GROUP', homeTeamId: 'a', awayTeamId: 'b', feederMatchIds: [] },
    ];
    const result = generateSchedule(matches, { ...baseConfig, timezone: 'Asia/Dhaka' });
    expect(result.assignments[0].startAt).toBe('2026-06-06T03:00:00.000Z');
  });

  it('is deterministic', () => {
    const matches = toSchedulable(generateSingleElimination(teams(16)));
    const a = generateSchedule(matches, baseConfig);
    const b = generateSchedule(matches, baseConfig);
    expect(a).toEqual(b);
  });
});

describe('detectConflicts', () => {
  const at = (h: number, m = 0) =>
    new Date(Date.UTC(2026, 5, 6, h, m)).toISOString();

  it('detects station, team, referee overlaps', () => {
    const conflicts = detectConflicts(
      [
        { matchId: 'a', startAt: at(9), endAt: at(10), stationId: 's1', refereeId: 'r1', homeTeamId: 't1', awayTeamId: 't2' },
        { matchId: 'b', startAt: at(9, 30), endAt: at(10, 30), stationId: 's1', refereeId: 'r1', homeTeamId: 't2', awayTeamId: 't3' },
      ],
      0,
    );
    const kinds = conflicts.map((c) => c.kind).sort();
    expect(kinds).toEqual(['REFEREE_OVERLAP', 'STATION_OVERLAP', 'TEAM_OVERLAP']);
    expect(conflicts.find((c) => c.kind === 'TEAM_OVERLAP')?.teamId).toBe('t2');
  });

  it('detects insufficient rest', () => {
    const conflicts = detectConflicts(
      [
        { matchId: 'a', startAt: at(9), endAt: at(10), stationId: 's1', homeTeamId: 't1', awayTeamId: 't2' },
        { matchId: 'b', startAt: at(10, 15), endAt: at(11, 15), stationId: 's2', homeTeamId: 't1', awayTeamId: 't3' },
      ],
      30,
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe('TEAM_REST');
    expect(detectConflicts(
      [
        { matchId: 'a', startAt: at(9), endAt: at(10), stationId: 's1', homeTeamId: 't1', awayTeamId: 't2' },
        { matchId: 'b', startAt: at(10, 30), endAt: at(11, 30), stationId: 's2', homeTeamId: 't1', awayTeamId: 't3' },
      ],
      30,
    )).toEqual([]);
  });

  it('detects dependency order violations', () => {
    const conflicts = detectConflicts(
      [
        { matchId: 'feeder', startAt: at(10), endAt: at(11), stationId: 's1' },
        { matchId: 'final', startAt: at(9), endAt: at(10), stationId: 's2', feederMatchIds: ['feeder'] },
      ],
      0,
    );
    expect(conflicts).toEqual([
      expect.objectContaining({ kind: 'DEPENDENCY_ORDER', matchIds: ['feeder', 'final'] }),
    ]);
  });

  it('returns nothing for a clean schedule', () => {
    expect(
      detectConflicts(
        [
          { matchId: 'a', startAt: at(9), endAt: at(10), stationId: 's1', homeTeamId: 't1', awayTeamId: 't2' },
          { matchId: 'b', startAt: at(9), endAt: at(10), stationId: 's2', homeTeamId: 't3', awayTeamId: 't4' },
        ],
        60,
      ),
    ).toEqual([]);
  });
});

describe('shiftSchedule', () => {
  it('shifts start and end by minutes', () => {
    const shifted = shiftSchedule(
      [{ matchId: 'a', startAt: '2026-06-06T09:00:00.000Z', endAt: '2026-06-06T10:00:00.000Z', stationId: 's1' }],
      -30,
    );
    expect(shifted[0].startAt).toBe('2026-06-06T08:30:00.000Z');
    expect(shifted[0].endAt).toBe('2026-06-06T09:30:00.000Z');
    expect(shifted[0].stationId).toBe('s1');
  });
});
