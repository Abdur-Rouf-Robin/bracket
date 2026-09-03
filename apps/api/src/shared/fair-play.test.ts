import { describe, expect, it } from 'vitest';
import {
  fairPlayPointsFromCards,
  rollupTeamFairPlayFromStats,
} from '@bracket/shared';

describe('fair play from cards', () => {
  it('uses FIFA-style weights (yellow=1, red=3)', () => {
    expect(fairPlayPointsFromCards(2, 1)).toBe(5);
  });

  it('rolls up team stats', () => {
    expect(
      rollupTeamFairPlayFromStats([
        { yellowCards: 1, redCards: 0 },
        { yellowCards: 0, redCards: 1 },
      ]),
    ).toBe(4);
  });
});
