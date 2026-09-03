import { describe, expect, it } from 'vitest';
import {
  computePlayerMvpScore,
  mvpRoundMultiplier,
  resolveMatchMvp,
} from '@bracket/shared';

describe('MVP calculation', () => {
  const weights = {
    goals: 3,
    assists: 2,
    points: 1,
    kills: 2,
    deaths: -0.5,
    rating: 4,
    winBonus: 2,
  };

  it('scores goals and assists with win bonus', () => {
    const score = computePlayerMvpScore(
      { goals: 2, assists: 1, points: 0, kills: 0, deaths: 0, rating: 7 },
      weights,
      true,
    );
    expect(score).toBe(2 * 3 + 1 * 2 + 7 * 4 + 2);
  });

  it('picks highest scorer as MVP', () => {
    const rows = [
      {
        playerId: 'a',
        playerName: 'A',
        teamId: 't1',
        teamName: 'T1',
        goals: 1,
        assists: 0,
        points: 0,
        kills: 0,
        deaths: 0,
        rating: null,
        mvpScore: 5,
        isMvp: false,
        isOnWinningTeam: true,
      },
      {
        playerId: 'b',
        playerName: 'B',
        teamId: 't1',
        teamName: 'T1',
        goals: 3,
        assists: 1,
        points: 0,
        kills: 0,
        deaths: 0,
        rating: null,
        mvpScore: 13,
        isMvp: false,
        isOnWinningTeam: true,
      },
    ];
    const { mvpPlayerId, rows: out } = resolveMatchMvp(rows);
    expect(mvpPlayerId).toBe('b');
    expect(out.find((r) => r.playerId === 'b')?.isMvp).toBe(true);
  });

  it('weights later rounds higher for tournament MVP', () => {
    expect(mvpRoundMultiplier(3, 3)).toBe(3);
    expect(mvpRoundMultiplier(2, 3)).toBe(2);
    expect(mvpRoundMultiplier(1, 3)).toBe(1.5);
  });
});
