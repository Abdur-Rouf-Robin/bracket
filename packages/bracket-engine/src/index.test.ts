import { describe, expect, it } from 'vitest';
import { seededShuffle } from '@bracket/shared';
import {
  assignTeamsToGroupsWithMode,
  buildInternationalKnockoutPairings,
  computeStandings,
  expandTwoLeggedGroup,
  expandTwoLeggedKnockout,
  generateDoubleElimination,
  generateRoundRobin,
  generateSingleElimination,
  generateGroupsKnockout,
  pickGroupAdvancers,
  pickGroupAdvancersWithBestThirds,
  assignEuroThirdPlaceSlots,
  buildEuroSixGroupKnockoutPairingsDynamic,
  resolveSingleLegKnockoutTie,
  resolveTwoLeggedTie,
  suggestFormats,
  validateSeriesResult,
} from './index';
import { buildEuroSixGroupKnockoutPairings } from './pairing-rules';

const teams = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));

describe('generateRoundRobin', () => {
  it('generates correct match count for 4 teams', () => {
    const matches = generateRoundRobin(teams(4));
    expect(matches).toHaveLength(6);
  });

  it('handles odd team counts with byes', () => {
    const matches = generateRoundRobin(teams(3));
    expect(matches).toHaveLength(3);
  });
});

describe('generateSingleElimination', () => {
  it('pads to power of two', () => {
    const matches = generateSingleElimination(teams(5));
    const r1 = matches.filter((m) => m.round === 1);
    expect(r1).toHaveLength(4);
  });

  it('adds third place match when enabled', () => {
    const matches = generateSingleElimination(teams(4), {
      breakTiesWithPlacement: true,
    });
    expect(matches.some((m) => m.key === 'se-3rd')).toBe(true);
  });
});

describe('generateDoubleElimination', () => {
  it('includes winners, losers, grand final, and reset', () => {
    const matches = generateDoubleElimination(teams(4));
    expect(matches.some((m) => m.key.startsWith('de-w-'))).toBe(true);
    expect(matches.some((m) => m.key.startsWith('de-l-'))).toBe(true);
    expect(matches.some((m) => m.key === 'de-gf')).toBe(true);
    expect(matches.some((m) => m.key === 'de-gf-reset')).toBe(true);
  });
});

describe('international knockout seeding', () => {
  it('pairs A1 vs B2 and B1 vs A2 for 2 groups', () => {
    const pairings = buildInternationalKnockoutPairings(2, 2, [
      'a1',
      'b1',
      'a2',
      'b2',
    ]);
    expect(pairings).toEqual([
      { homeTeamId: 'a1', awayTeamId: 'b2' },
      { homeTeamId: 'b1', awayTeamId: 'a2' },
    ]);
  });
});

describe('computeStandings', () => {
  it('ranks by points then goal difference', () => {
    const t = teams(3);
    const standings = computeStandings(t, [
      {
        homeTeamId: 't1',
        awayTeamId: 't2',
        homeScore: 2,
        awayScore: 1,
        winnerTeamId: 't1',
        isDraw: false,
        status: 'COMPLETED',
      },
      {
        homeTeamId: 't1',
        awayTeamId: 't3',
        homeScore: 1,
        awayScore: 1,
        winnerTeamId: null,
        isDraw: true,
        status: 'COMPLETED',
      },
    ]);
    expect(standings[0].teamId).toBe('t1');
    expect(standings[0].points).toBe(4);
  });

  it('uses head-to-head among tied teams in a group', () => {
    const t = [
      { id: 't1', name: 'T1', groupId: 'g1' },
      { id: 't2', name: 'T2', groupId: 'g1' },
    ];
    const standings = computeStandings(
      t,
      [
        {
          homeTeamId: 't1',
          awayTeamId: 't2',
          homeScore: 2,
          awayScore: 1,
          winnerTeamId: 't1',
          isDraw: false,
          status: 'COMPLETED',
          groupId: 'g1',
        },
      ],
      3,
      1,
      { useHeadToHead: true, rankBy: 'MATCH_WINS' },
    );
    expect(standings.find((s) => s.teamId === 't1')?.rank).toBe(1);
  });
});

describe('validateSeriesResult', () => {
  it('accepts valid Bo3 result', () => {
    expect(validateSeriesResult({ homeScore: 2, awayScore: 1, bestOf: 3 }).valid).toBe(
      true,
    );
  });

  it('rejects incomplete Bo3', () => {
    expect(
      validateSeriesResult({ homeScore: 1, awayScore: 1, bestOf: 3 }).valid,
    ).toBe(false);
  });
});

describe('pickGroupAdvancers', () => {
  it('picks top N per group in seed order', () => {
    const groups = [
      { id: 'g1', name: 'A', order: 0 },
      { id: 'g2', name: 'B', order: 1 },
    ];
    const standings = [
      { teamId: 'a1', groupId: 'g1', rank: 1, played: 0, wins: 0, losses: 0, draws: 0, pointsFor: 0, pointsAgainst: 0, points: 6 },
      { teamId: 'a2', groupId: 'g1', rank: 2, played: 0, wins: 0, losses: 0, draws: 0, pointsFor: 0, pointsAgainst: 0, points: 3 },
      { teamId: 'b1', groupId: 'g2', rank: 1, played: 0, wins: 0, losses: 0, draws: 0, pointsFor: 0, pointsAgainst: 0, points: 6 },
      { teamId: 'b2', groupId: 'g2', rank: 2, played: 0, wins: 0, losses: 0, draws: 0, pointsFor: 0, pointsAgainst: 0, points: 3 },
    ];
    expect(pickGroupAdvancers(standings, groups, 2)).toEqual([
      'a1',
      'b1',
      'a2',
      'b2',
    ]);
  });
});

describe('generateGroupsKnockout', () => {
  it('creates groups and group + ko matches', () => {
    const result = generateGroupsKnockout(teams(8), 2, 2);
    expect(result.groups).toHaveLength(2);
    expect(result.matches.some((m) => m.bracketSide === 'GROUP')).toBe(true);
    expect(result.matches.some((m) => m.key.startsWith('gk-'))).toBe(true);
  });
});

describe('suggestFormats', () => {
  it('returns suggestions', () => {
    const s = suggestFormats(8, false);
    expect(s.length).toBeGreaterThan(0);
  });
});

describe('pickGroupAdvancersWithBestThirds', () => {
  it('appends best third-place teams after top-2 per group', () => {
    const groups = [
      { id: 'g1', name: 'A', order: 0 },
      { id: 'g2', name: 'B', order: 1 },
    ];
    const standings = [
      { teamId: 'a1', groupId: 'g1', rank: 1, played: 3, wins: 2, losses: 0, draws: 1, pointsFor: 5, pointsAgainst: 2, points: 7 },
      { teamId: 'a2', groupId: 'g1', rank: 2, played: 3, wins: 1, losses: 1, draws: 1, pointsFor: 4, pointsAgainst: 3, points: 4 },
      { teamId: 'a3', groupId: 'g1', rank: 3, played: 3, wins: 1, losses: 2, draws: 0, pointsFor: 3, pointsAgainst: 4, points: 3 },
      { teamId: 'b1', groupId: 'g2', rank: 1, played: 3, wins: 3, losses: 0, draws: 0, pointsFor: 6, pointsAgainst: 1, points: 9 },
      { teamId: 'b2', groupId: 'g2', rank: 2, played: 3, wins: 1, losses: 2, draws: 0, pointsFor: 2, pointsAgainst: 5, points: 3 },
      { teamId: 'b3', groupId: 'g2', rank: 3, played: 3, wins: 0, losses: 2, draws: 1, pointsFor: 1, pointsAgainst: 3, points: 1 },
    ];
    expect(pickGroupAdvancersWithBestThirds(standings, groups, 2, 1)).toEqual([
      'a1', 'b1', 'a2', 'b2', 'a3',
    ]);
  });
});

describe('buildEuroSixGroupKnockoutPairings', () => {
  it('maps 6-group Euro R16 slots with 4 best thirds', () => {
    const advancers = [
      '1A', '1B', '1C', '1D', '1E', '1F',
      '2A', '2B', '2C', '2D', '2E', '2F',
      '3A', '3B', '3C', '3D',
    ];
    const pairs = buildEuroSixGroupKnockoutPairings(advancers);
    expect(pairs).toHaveLength(8);
    expect(pairs[0]).toEqual({ homeTeamId: '1A', awayTeamId: '2B' });
    expect(pairs[1]).toEqual({ homeTeamId: '1C', awayTeamId: '3A' });
    expect(pairs[7]).toEqual({ homeTeamId: '2A', awayTeamId: '2D' });
  });

  it('is used via buildInternationalKnockoutPairings for 6 groups', () => {
    const advancers = [
      '1A', '1B', '1C', '1D', '1E', '1F',
      '2A', '2B', '2C', '2D', '2E', '2F',
      '3A', '3B', '3C', '3D',
    ];
    const pairs = buildInternationalKnockoutPairings(6, 2, advancers);
    expect(pairs[0]?.homeTeamId).toBe('1A');
  });
});

describe('resolveTwoLeggedTie', () => {
  it('decides on aggregate score', () => {
    const result = resolveTwoLeggedTie({
      leg1HomeScore: 1,
      leg1AwayScore: 0,
      leg2HomeScore: 0,
      leg2AwayScore: 2,
      leg1HomeTeamId: 'home',
      leg1AwayTeamId: 'away',
    });
    expect(result.winnerTeamId).toBe('home');
    expect(result.decidedBy).toBe('aggregate');
  });

  it('uses away goals when aggregate tied', () => {
    const result = resolveTwoLeggedTie({
      leg1HomeScore: 2,
      leg1AwayScore: 1,
      leg2HomeScore: 1,
      leg2AwayScore: 0,
      leg1HomeTeamId: 'home',
      leg1AwayTeamId: 'away',
      awayGoalsRule: true,
    });
    expect(result.winnerTeamId).toBe('away');
    expect(result.decidedBy).toBe('away_goals');
  });

  it('uses penalties when configured', () => {
    const result = resolveTwoLeggedTie({
      leg1HomeScore: 0,
      leg1AwayScore: 0,
      leg2HomeScore: 0,
      leg2AwayScore: 0,
      leg1HomeTeamId: 'home',
      leg1AwayTeamId: 'away',
      allowPenalties: true,
      penHomeScore: 4,
      penAwayScore: 5,
    });
    expect(result.winnerTeamId).toBe('away');
    expect(result.decidedBy).toBe('penalties');
  });
});

describe('expandTwoLeggedKnockout', () => {
  it('creates leg 1 and leg 2 for knockout matches', () => {
    const base = generateSingleElimination(teams(4));
    const expanded = expandTwoLeggedKnockout(base);
    const legs = expanded.filter((m) => m.legNumber != null);
    expect(legs.some((m) => m.legNumber === 1)).toBe(true);
    expect(legs.some((m) => m.legNumber === 2)).toBe(true);
  });
});

describe('expandTwoLeggedGroup', () => {
  it('creates leg 1 and leg 2 with swapped home/away', () => {
    const matches = expandTwoLeggedGroup([
      {
        key: 'g1',
        round: 1,
        position: 0,
        bracketSide: 'GROUP',
        groupId: 'ga',
        homeTeamId: 't1',
        awayTeamId: 't2',
      },
    ]);
    expect(matches).toHaveLength(2);
    expect(matches[0]?.legNumber).toBe(1);
    expect(matches[1]?.legNumber).toBe(2);
    expect(matches[1]?.homeTeamId).toBe('t2');
    expect(matches[1]?.awayTeamId).toBe('t1');
    expect(matches[0]?.tieId).toBe(matches[1]?.tieId);
  });
});

describe('assignEuroThirdPlaceSlots', () => {
  it('avoids same-group third vs home winner', () => {
    expect(assignEuroThirdPlaceSlots([0, 1, 3, 4])).not.toBeNull();
    expect(assignEuroThirdPlaceSlots([2, 2, 2, 2])).toBeNull();
  });
});

describe('resolveSingleLegKnockoutTie', () => {
  it('decides winner in extra time after regulation draw', () => {
    const result = resolveSingleLegKnockoutTie({
      homeTeamId: 'h1',
      awayTeamId: 'a1',
      homeScore: 1,
      awayScore: 1,
      etHomeScore: 1,
      etAwayScore: 0,
      allowExtraTime: true,
      allowPenalties: true,
    });
    expect(result.winnerTeamId).toBe('h1');
    expect(result.decidedBy).toBe('extra_time');
  });

  it('falls back to penalties when ET still tied', () => {
    const result = resolveSingleLegKnockoutTie({
      homeTeamId: 'h1',
      awayTeamId: 'a1',
      homeScore: 0,
      awayScore: 0,
      etHomeScore: 0,
      etAwayScore: 0,
      penHomeScore: 4,
      penAwayScore: 3,
      allowExtraTime: true,
      allowPenalties: true,
    });
    expect(result.winnerTeamId).toBe('h1');
    expect(result.decidedBy).toBe('penalties');
  });
});

describe('seededShuffle', () => {
  it('is deterministic for the same seed', () => {
    const items = teams(8).map((t) => ({ id: t.id, name: t.name, seed: t.seed }));
    const a = seededShuffle(items, 'test-seed-123', 'draw');
    const b = seededShuffle(items, 'test-seed-123', 'draw');
    expect(a.items.map((x) => x.id)).toEqual(b.items.map((x) => x.id));
    expect(a.audit.seed).toBe('test-seed-123');
  });
});

describe('assignTeamsToGroupsWithMode SERPENTINE auditable draw', () => {
  it('uses drawSeed for reproducible serpentine placement', () => {
    const input = teams(8);
    const a = assignTeamsToGroupsWithMode(input, 4, 'SERPENTINE', 'audit-seed-1');
    const b = assignTeamsToGroupsWithMode(input, 4, 'SERPENTINE', 'audit-seed-1');
    expect(a.teams.map((t) => ({ id: t.id, groupId: t.groupId }))).toEqual(
      b.teams.map((t) => ({ id: t.id, groupId: t.groupId })),
    );
  });

  it('shuffles team order when drawSeed is set', () => {
    const input = teams(8);
    const shuffled = seededShuffle(
      input.map((t) => ({ id: t.id, name: t.name, seed: t.seed ?? null })),
      'audit-seed-xyz',
      'group-serpentine',
    );
    expect(shuffled.items.map((x) => x.id)).not.toEqual(input.map((t) => t.id));
  });
});
