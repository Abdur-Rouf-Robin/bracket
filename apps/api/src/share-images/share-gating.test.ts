import { describe, expect, it } from 'vitest';
import {
  buildShareCardPayload,
  formatsSupportShareImage,
  tournamentSettingsSchema,
} from '@bracket/shared';

describe('formatsSupportShareImage', () => {
  it('allows single/double elim, round robin, and swiss', () => {
    expect(formatsSupportShareImage('SINGLE_ELIMINATION')).toBe(true);
    expect(formatsSupportShareImage('DOUBLE_ELIMINATION')).toBe(true);
    expect(formatsSupportShareImage('ROUND_ROBIN')).toBe(true);
    expect(formatsSupportShareImage('SWISS')).toBe(true);
  });

  it('blocks group and free-for-all formats', () => {
    expect(formatsSupportShareImage('GROUPS_KNOCKOUT')).toBe(false);
    expect(formatsSupportShareImage('FREE_FOR_ALL')).toBe(false);
  });
});

describe('share card seed hiding', () => {
  it('passes null seeds into buildShareCardPayload when hideSeedNumbers is on', () => {
    const settings = tournamentSettingsSchema.parse({ hideSeedNumbers: true });
    const hideSeeds = settings.hideSeedNumbers === true;

    const payload = buildShareCardPayload({
      tournamentName: 'Test Cup',
      gameName: 'Soccer',
      format: 'SINGLE_ELIMINATION',
      round: 1,
      bracketSide: 'WINNERS',
      allowPercent: false,
      totalRounds: 3,
      home: {
        id: 'h1',
        name: 'Home FC',
        score: 2,
        percent: null,
        poolColor: null,
        seed: hideSeeds ? null : 1,
      },
      away: {
        id: 'a1',
        name: 'Away FC',
        score: 1,
        percent: null,
        poolColor: null,
        seed: hideSeeds ? null : 2,
      },
      winnerTeamId: 'h1',
      winnerName: 'Home FC',
      isDraw: false,
    });

    expect(payload.home.seed).toBeNull();
    expect(payload.away.seed).toBeNull();
  });

  it('keeps seeds visible when hideSeedNumbers is off', () => {
    const settings = tournamentSettingsSchema.parse({ hideSeedNumbers: false });
    const hideSeeds = settings.hideSeedNumbers === true;

    const payload = buildShareCardPayload({
      tournamentName: 'Test Cup',
      gameName: null,
      format: 'SINGLE_ELIMINATION',
      round: 1,
      bracketSide: 'WINNERS',
      allowPercent: false,
      totalRounds: 3,
      home: {
        id: 'h1',
        name: 'Home FC',
        score: 2,
        percent: null,
        poolColor: null,
        seed: hideSeeds ? null : 1,
      },
      away: {
        id: 'a1',
        name: 'Away FC',
        score: 1,
        percent: null,
        poolColor: null,
        seed: hideSeeds ? null : 2,
      },
      winnerTeamId: 'h1',
      winnerName: 'Home FC',
      isDraw: false,
    });

    expect(payload.home.seed).toBe(1);
    expect(payload.away.seed).toBe(2);
  });
});
