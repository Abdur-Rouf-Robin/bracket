import { describe, expect, it } from 'vitest';
import { applyEloResult, expectedScore, kFactorFor } from './elo';

const cfg = {
  kFactorNew: 40,
  kFactorNormal: 20,
  kFactorPro: 10,
  newPlayerMatches: 10,
  proThreshold: 2000,
};

describe('expectedScore', () => {
  it('is 0.5 for equal ratings', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 10);
  });

  it('favours the higher rated player and is symmetric', () => {
    const a = expectedScore(1700, 1500);
    const b = expectedScore(1500, 1700);
    expect(a).toBeGreaterThan(0.5);
    expect(a + b).toBeCloseTo(1, 10);
  });

  it('400 points difference ≈ 10:1 odds', () => {
    expect(expectedScore(1900, 1500)).toBeCloseTo(10 / 11, 6);
  });
});

describe('kFactorFor', () => {
  it('uses the new-player K while under the match threshold', () => {
    expect(kFactorFor({ matchesPlayed: 0, rating: 1500 }, cfg)).toBe(40);
    expect(kFactorFor({ matchesPlayed: 9, rating: 2500 }, cfg)).toBe(40);
  });

  it('uses the pro K once at or above the threshold', () => {
    expect(kFactorFor({ matchesPlayed: 10, rating: 2000 }, cfg)).toBe(10);
    expect(kFactorFor({ matchesPlayed: 50, rating: 2400 }, cfg)).toBe(10);
  });

  it('otherwise uses the normal K', () => {
    expect(kFactorFor({ matchesPlayed: 10, rating: 1500 }, cfg)).toBe(20);
    expect(kFactorFor({ matchesPlayed: 100, rating: 1999 }, cfg)).toBe(20);
  });
});

describe('applyEloResult', () => {
  it('moves equal players by K/2 on a win', () => {
    const r = applyEloResult({ ratingA: 1500, ratingB: 1500, kA: 20, kB: 20, scoreA: 1 });
    expect(r.deltaA).toBe(10);
    expect(r.deltaB).toBe(-10);
    expect(r.newA).toBe(1510);
    expect(r.newB).toBe(1490);
  });

  it('does not move equal players on a draw', () => {
    const r = applyEloResult({ ratingA: 1500, ratingB: 1500, kA: 20, kB: 20, scoreA: 0.5 });
    expect(r.deltaA).toBe(0);
    expect(r.deltaB).toBe(0);
  });

  it('rewards an upset more than an expected win', () => {
    const upset = applyEloResult({ ratingA: 1400, ratingB: 1800, kA: 20, kB: 20, scoreA: 1 });
    const expected = applyEloResult({ ratingA: 1800, ratingB: 1400, kA: 20, kB: 20, scoreA: 1 });
    expect(upset.deltaA).toBeGreaterThan(expected.deltaA);
    expect(upset.deltaA).toBeGreaterThan(10);
    expect(expected.deltaA).toBeLessThan(10);
  });

  it('respects independent K-factors per side', () => {
    const r = applyEloResult({ ratingA: 1500, ratingB: 1500, kA: 40, kB: 10, scoreA: 0 });
    expect(r.deltaA).toBe(-20);
    expect(r.deltaB).toBe(5);
  });

  it('a lower-rated player gains rating from a draw against a stronger one', () => {
    const r = applyEloResult({ ratingA: 1400, ratingB: 1800, kA: 20, kB: 20, scoreA: 0.5 });
    expect(r.deltaA).toBeGreaterThan(0);
    expect(r.deltaB).toBeLessThan(0);
  });
});
