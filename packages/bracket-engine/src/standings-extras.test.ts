import { describe, expect, it } from 'vitest';
import {
  computeFinalPlacements,
  computeStandings,
  generateDoubleElimination,
  generateSingleElimination,
  generateSwissPots,
  resolveSetsResult,
  type MatchResultLike,
  type GeneratedMatch,
} from './index';

const teams = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));

function result(
  home: string,
  away: string,
  hs: number,
  as: number,
  extra: Partial<MatchResultLike> = {},
): MatchResultLike {
  return {
    homeTeamId: home,
    awayTeamId: away,
    homeScore: hs,
    awayScore: as,
    winnerTeamId: hs === as ? null : hs > as ? home : away,
    isDraw: hs === as,
    status: 'COMPLETED',
    ...extra,
  };
}

describe('standings criteria', () => {
  it('applies pointsLoss and manual adjustments', () => {
    const rows = computeStandings(teams(2), [result('t1', 't2', 2, 0)], 3, 1, {
      pointsLoss: -1,
      adjustments: new Map([['t2', 5]]),
    });
    const t1 = rows.find((r) => r.teamId === 't1')!;
    const t2 = rows.find((r) => r.teamId === 't2')!;
    expect(t1.points).toBe(3);
    expect(t2.points).toBe(4);
    expect(t2.adjustments).toBe(5);
    expect(t2.rank).toBe(1);
  });

  it('resolves 3-way ties with head-to-head mini-table', () => {
    // t1, t2, t3 each beat t4 and go 1-1 among themselves; t1 has the best H2H diff.
    const matches = [
      result('t1', 't4', 1, 0),
      result('t2', 't4', 1, 0),
      result('t3', 't4', 1, 0),
      result('t1', 't2', 3, 0),
      result('t2', 't3', 1, 0),
      result('t3', 't1', 1, 0),
    ];
    const rows = computeStandings(teams(4), matches, 3, 1, {
      criteria: ['HEAD_TO_HEAD', 'SCORE_DIFF'],
    });
    const byId = new Map(rows.map((r) => [r.teamId, r]));
    // Overall all three have 6 pts; mini-table points equal (3 each), diff: t1 +2, t2 -2, t3 0
    expect(byId.get('t1')!.rank).toBe(1);
    expect(byId.get('t3')!.rank).toBe(2);
    expect(byId.get('t2')!.rank).toBe(3);
    expect(byId.get('t4')!.rank).toBe(4);
  });

  it('respects criteria order (SCORE_FOR before SCORE_DIFF)', () => {
    const matches = [
      result('t1', 't3', 5, 4), // t1 +1, for 5
      result('t2', 't3', 2, 0), // t2 +2, for 2
    ];
    const byFor = computeStandings(teams(3), matches, 3, 1, {
      criteria: ['SCORE_FOR', 'SCORE_DIFF'],
    });
    expect(byFor.find((r) => r.teamId === 't1')!.rank).toBe(1);
    const byDiff = computeStandings(teams(3), matches, 3, 1, {
      criteria: ['SCORE_DIFF', 'SCORE_FOR'],
    });
    expect(byDiff.find((r) => r.teamId === 't2')!.rank).toBe(1);
  });

  it('SCORE_AGAINST and GAMES_PLAYED rank fewer as better', () => {
    const matches = [result('t1', 't3', 1, 0), result('t2', 't3', 1, 0), result('t3', 't2', 0, 0)];
    const rows = computeStandings(teams(3), matches, 3, 1, {
      criteria: ['GAMES_PLAYED'],
    });
    // t2 has 4 pts, t1 3 pts, t3 1 pt → primary metric decides
    expect(rows.find((r) => r.teamId === 't2')!.rank).toBe(1);
    const tied = computeStandings(
      teams(2),
      [result('t1', 't2', 2, 1), result('t2', 't1', 3, 2)],
      3,
      1,
      { criteria: ['SCORE_AGAINST'] },
    );
    // both 3 pts; t1 conceded 4, t2 conceded 4 → equal; falls to id order
    expect(tied.map((r) => r.teamId)).toEqual(['t1', 't2']);
  });

  it('tracks sets and ranks by SET_DIFF', () => {
    const matches = [
      result('t1', 't2', 2, 1, { homeSetsWon: 2, awaySetsWon: 1 }),
      result('t2', 't3', 2, 0, { homeSetsWon: 2, awaySetsWon: 0 }),
      result('t3', 't1', 2, 1, { homeSetsWon: 2, awaySetsWon: 1 }),
    ];
    const rows = computeStandings(teams(3), matches, 3, 1, {
      criteria: ['SET_DIFF', 'SETS_WON'],
    });
    const byId = new Map(rows.map((r) => [r.teamId, r]));
    expect(byId.get('t1')!.setsWon).toBe(3);
    expect(byId.get('t1')!.setsLost).toBe(3);
    expect(byId.get('t2')!.setsWon).toBe(3);
    expect(byId.get('t2')!.setsLost).toBe(2);
    expect(byId.get('t2')!.rank).toBe(1);
  });

  it('computes Buchholz, median Buchholz and Sonneborn-Berger', () => {
    const matches = [
      result('t1', 't2', 1, 0),
      result('t1', 't3', 1, 0),
      result('t1', 't4', 0, 0),
      result('t2', 't3', 1, 0),
    ];
    const rows = computeStandings(teams(4), matches, 3, 1, { criteria: ['BUCHHOLZ'] });
    const t1 = rows.find((r) => r.teamId === 't1')!;
    // opponents: t2 (3), t3 (0), t4 (1)
    expect(t1.buchholz).toBe(4);
    expect(t1.medianBuchholz).toBe(1);
    expect(t1.sonnebornBerger).toBe(3 + 0 + 0.5);
  });

  it('fair play favours fewer discipline points', () => {
    const rows = computeStandings(
      [
        { id: 't1', name: 'A', fairPlayPoints: 4 },
        { id: 't2', name: 'B', fairPlayPoints: 1 },
      ],
      [result('t1', 't2', 1, 1)],
      3,
      1,
      { criteria: ['FAIR_PLAY'] },
    );
    expect(rows.find((r) => r.teamId === 't2')!.rank).toBe(1);
  });

  it('draw lots is deterministic for a seed', () => {
    const opts = { criteria: ['DRAW_LOTS'] as const, tossSeed: 'seed-1' };
    const a = computeStandings(teams(4), [], 3, 1, { ...opts, criteria: ['DRAW_LOTS'] });
    const b = computeStandings(teams(4), [], 3, 1, { ...opts, criteria: ['DRAW_LOTS'] });
    expect(a.map((r) => r.teamId)).toEqual(b.map((r) => r.teamId));
    const c = computeStandings(teams(4), [], 3, 1, { criteria: ['DRAW_LOTS'], tossSeed: 'other' });
    expect(c.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('exposes form (last five results, oldest first)', () => {
    const matches = [
      result('t1', 't2', 1, 0),
      result('t1', 't2', 0, 1),
      result('t1', 't2', 1, 1),
      result('t1', 't2', 2, 0),
      result('t1', 't2', 2, 0),
      result('t1', 't2', 0, 3),
    ];
    const t1 = computeStandings(teams(2), matches).find((r) => r.teamId === 't1')!;
    expect(t1.form).toEqual(['L', 'D', 'W', 'W', 'L']);
  });

  it('net run rate criterion uses the supplied NRR map', () => {
    const rows = computeStandings(teams(2), [result('t1', 't2', 1, 1)], 3, 1, {
      criteria: ['NET_RUN_RATE'],
      netRunRateByTeam: new Map([
        ['t1', -0.5],
        ['t2', 1.2],
      ]),
    });
    expect(rows.find((r) => r.teamId === 't2')!.rank).toBe(1);
  });
});

describe('resolveSetsResult', () => {
  it('accepts a valid best-of-3', () => {
    const r = resolveSetsResult(
      [
        { home: 6, away: 4 },
        { home: 3, away: 6 },
        { home: 7, away: 5 },
      ],
      3,
    );
    expect(r.valid).toBe(true);
    expect(r.homeSetsWon).toBe(2);
    expect(r.awaySetsWon).toBe(1);
    expect(r.winner).toBe('home');
  });

  it('rejects tied sets, extra sets and unfinished series', () => {
    expect(resolveSetsResult([{ home: 6, away: 6 }], 3).valid).toBe(false);
    expect(
      resolveSetsResult(
        [
          { home: 6, away: 4 },
          { home: 6, away: 4 },
          { home: 6, away: 4 },
        ],
        3,
      ).message,
    ).toMatch(/already decided/);
    expect(resolveSetsResult([{ home: 6, away: 4 }], 3).message).toMatch(/must win 2 sets/);
  });
});

describe('placement matches', () => {
  it('builds a 5th–8th ladder plus third place for 8 teams', () => {
    const matches = generateSingleElimination(teams(8), { placementMatchesThrough: 8 });
    const placement = matches.filter((m) => m.isPlacement);
    expect(placement.map((m) => m.key).sort()).toEqual(
      ['se-3rd', 'se-pl-5', 'se-pl-5-8-p0', 'se-pl-5-8-p1', 'se-pl-7'].sort(),
    );
    const qf = matches.filter((m) => m.round === 1 && !m.isPlacement);
    expect(qf.every((m) => m.loserNextMatchKey?.startsWith('se-pl-5-8'))).toBe(true);
    const semi5 = matches.find((m) => m.key === 'se-pl-5-8-p0')!;
    expect(semi5.nextMatchKey).toBe('se-pl-5');
    expect(semi5.loserNextMatchKey).toBe('se-pl-7');
    expect(matches.find((m) => m.key === 'se-pl-7')!.placementRank).toBe(7);
  });

  it('through 16 adds a 9–16 ladder for 16 teams', () => {
    const matches = generateSingleElimination(teams(16), { placementMatchesThrough: 16 });
    const keys = matches.filter((m) => m.isPlacement).map((m) => m.key);
    expect(keys).toContain('se-pl-9');
    expect(keys).toContain('se-pl-15');
    expect(keys.filter((k) => k.startsWith('se-pl-9-16-p'))).toHaveLength(4);
  });

  it('consolation bracket takes round-1 losers and skips their placement ladder', () => {
    const matches = generateSingleElimination(teams(8), {
      placementMatchesThrough: 8,
      consolationBracket: true,
    });
    const cons = matches.filter((m) => m.key.includes('cons-'));
    expect(cons).toHaveLength(3);
    expect(cons.every((m) => m.bracketSide === 'LOSERS')).toBe(true);
    const r1 = matches.filter((m) => m.round === 1 && !m.key.includes('cons-') && !m.isPlacement);
    expect(r1.every((m) => m.loserNextMatchKey?.includes('cons-r1'))).toBe(true);
    expect(matches.some((m) => m.key === 'se-3rd')).toBe(true);
    expect(matches.some((m) => m.key === 'se-pl-5')).toBe(false);
  });

  it('double elimination split participants seed losers-start teams into LB round 1', () => {
    const matches = generateDoubleElimination(teams(8), {
      losersStartTeamIds: ['t5', 't6', 't7', 't8'],
      doubleElimBracketReset: false,
    });
    const wbR1 = matches.filter((m) => m.bracketSide === 'WINNERS' && m.round === 1);
    expect(wbR1).toHaveLength(4);
    expect(wbR1.every((m) => m.isBye)).toBe(true);
    const lbR1 = matches.filter((m) => m.bracketSide === 'LOSERS' && m.round === 1);
    const seeded = lbR1.flatMap((m) => [m.homeTeamId, m.awayTeamId]).filter(Boolean).sort();
    expect(seeded).toEqual(['t5', 't6', 't7', 't8']);
  });

  it('double elimination placement ladder for 5th–8th', () => {
    const matches = generateDoubleElimination(teams(8), { placementMatchesThrough: 8 });
    const keys = matches.filter((m) => m.isPlacement).map((m) => m.key).sort();
    expect(keys).toEqual(['de-pl-5', 'de-pl-7']);
  });
});

describe('computeFinalPlacements', () => {
  function play(matches: GeneratedMatch[], winners: Record<string, string>) {
    const byKey = new Map(matches.map((m) => [m.key, { ...m, status: 'PENDING', winnerTeamId: null as string | null }]));
    // propagate in key order of rounds
    const ordered = [...byKey.values()].sort((a, b) => a.round - b.round);
    for (const m of ordered) {
      const w = winners[m.key];
      if (!w) continue;
      m.winnerTeamId = w;
      m.status = 'COMPLETED';
      const loser = m.homeTeamId === w ? m.awayTeamId : m.homeTeamId;
      if (m.nextMatchKey) {
        const n = byKey.get(m.nextMatchKey)!;
        if (m.nextMatchSlot === 'home') n.homeTeamId = w;
        else n.awayTeamId = w;
      }
      if (m.loserNextMatchKey && loser) {
        const n = byKey.get(m.loserNextMatchKey)!;
        if (m.loserNextMatchSlot === 'home') n.homeTeamId = loser;
        else n.awayTeamId = loser;
      }
    }
    return [...byKey.values()];
  }

  it('ranks 8 teams with 3rd place + 5–8 ladder', () => {
    const gen = generateSingleElimination(teams(8), { placementMatchesThrough: 8 });
    const played = play(gen, {
      'se-r1-p0': 't1',
      'se-r1-p1': 't5',
      'se-r1-p2': 't2',
      'se-r1-p3': 't3',
      'se-r2-p0': 't1',
      'se-r2-p1': 't2',
      'se-r3-p0': 't1',
      'se-3rd': 't5',
      'se-pl-5-8-p0': 't8',
      'se-pl-5-8-p1': 't6',
      'se-pl-5': 't6',
      'se-pl-7': 't4',
    });
    const res = computeFinalPlacements({
      format: 'SINGLE_ELIMINATION',
      teamIds: teams(8).map((t) => t.id),
      matches: played.map((m) => ({ ...m, bracketSide: m.bracketSide as string })),
    });
    expect(res.complete).toBe(true);
    const rank = new Map(res.placements.map((p) => [p.teamId, p.rank]));
    expect(rank.get('t1')).toBe(1);
    expect(rank.get('t2')).toBe(2);
    expect(rank.get('t5')).toBe(3);
    expect(rank.get('t3')).toBe(4);
    expect(rank.get('t6')).toBe(5);
    expect(rank.get('t8')).toBe(6);
    expect(rank.get('t4')).toBe(7);
    expect(rank.get('t7')).toBe(8);
  });

  it('shares ranks when no placement matches exist', () => {
    const gen = generateSingleElimination(teams(4));
    const played = play(gen, { 'se-r1-p0': 't1', 'se-r1-p1': 't2', 'se-r2-p0': 't1' });
    const res = computeFinalPlacements({
      format: 'SINGLE_ELIMINATION',
      teamIds: teams(4).map((t) => t.id),
      matches: played.map((m) => ({ ...m, bracketSide: m.bracketSide as string })),
    });
    const rank = new Map(res.placements.map((p) => [p.teamId, p.rank]));
    expect(rank.get('t1')).toBe(1);
    expect(rank.get('t2')).toBe(2);
    expect(rank.get('t3')).toBe(3);
    expect(rank.get('t4')).toBe(3);
  });
});

describe('generateSwissPots', () => {
  it('pre-generates all rounds with no rematches and pot diversity', () => {
    const { matches, pots } = generateSwissPots(teams(16), 4, { drawSeed: 'x' });
    expect(pots).toHaveLength(4);
    expect(matches).toHaveLength(32);
    const seen = new Set<string>();
    const perTeam = new Map<string, number>();
    for (const m of matches) {
      const k = [m.homeTeamId, m.awayTeamId].sort().join(':');
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      perTeam.set(m.homeTeamId!, (perTeam.get(m.homeTeamId!) ?? 0) + 1);
      perTeam.set(m.awayTeamId!, (perTeam.get(m.awayTeamId!) ?? 0) + 1);
    }
    expect([...perTeam.values()].every((c) => c === 4)).toBe(true);
    for (let r = 1; r <= 4; r++) {
      const ids = matches.filter((m) => m.round === r).flatMap((m) => [m.homeTeamId, m.awayTeamId]);
      expect(new Set(ids).size).toBe(16);
    }
    // t1 (pot 1) should face one opponent from each pot
    const t1Opps = matches
      .filter((m) => m.homeTeamId === 't1' || m.awayTeamId === 't1')
      .map((m) => (m.homeTeamId === 't1' ? m.awayTeamId : m.homeTeamId));
    const potOf = (id: string) => pots.find((p) => p.teamIds.includes(id))!.pot;
    expect(new Set(t1Opps.map((id) => potOf(id!))).size).toBe(4);
  });

  it('handles odd team counts with rotating byes', () => {
    const { matches } = generateSwissPots(teams(7), 3, { drawSeed: 'y' });
    const byes = matches.filter((m) => m.isBye);
    expect(byes).toHaveLength(3);
    expect(new Set(byes.map((m) => m.homeTeamId)).size).toBe(3);
  });

  it('is deterministic for the same seed', () => {
    const a = generateSwissPots(teams(10), 4, { drawSeed: 'same' }).matches.map((m) => m.key + m.homeTeamId + m.awayTeamId);
    const b = generateSwissPots(teams(10), 4, { drawSeed: 'same' }).matches.map((m) => m.key + m.homeTeamId + m.awayTeamId);
    expect(a).toEqual(b);
  });
});
