import { describe, expect, it } from 'vitest';
import { canUseBracketPredictions, validatePredictionCustomFields } from './bracket-prediction-policy';

describe('canUseBracketPredictions', () => {
  const enabled = {
    enableBracketPredictions: true,
    allowAnonymousPredictions: true,
  };

  it('denies when predictions are disabled', () => {
    expect(
      canUseBracketPredictions(
        { enableBracketPredictions: false, allowAnonymousPredictions: true },
        'user-1',
      ),
    ).toBe(false);
  });

  it('allows signed-in users when enabled', () => {
    expect(canUseBracketPredictions(enabled, 'user-1')).toBe(true);
  });

  it('allows guests with guestKey when anonymous predictions are on', () => {
    expect(canUseBracketPredictions(enabled, null, 'guest-abc')).toBe(true);
  });

  it('denies guests without guestKey', () => {
    expect(canUseBracketPredictions(enabled, null)).toBe(false);
  });

  it('denies guests when anonymous predictions are off', () => {
    expect(
      canUseBracketPredictions(
        { enableBracketPredictions: true, allowAnonymousPredictions: false },
        null,
        'guest-abc',
      ),
    ).toBe(false);
  });
});

describe('validatePredictionCustomFields', () => {
  const defs = {
    allowCustomPredictionFields: true,
    predictionCustomFields: [
      { id: 'country', label: 'Country', type: 'text' as const },
      { id: 'confidence', label: 'Confidence', type: 'number' as const },
    ],
  };

  it('rejects unknown field keys', () => {
    expect(() =>
      validatePredictionCustomFields(defs, { rogue: 'x' }),
    ).toThrow(/Unknown prediction field/);
  });

  it('normalizes valid custom fields', () => {
    expect(
      validatePredictionCustomFields(defs, {
        country: 'BD',
        confidence: '80',
      }),
    ).toEqual({ country: 'BD', confidence: 80 });
  });

  it('returns empty object when custom fields disabled', () => {
    expect(
      validatePredictionCustomFields(
        { allowCustomPredictionFields: false, predictionCustomFields: [] },
        {},
      ),
    ).toEqual({});
  });
});
