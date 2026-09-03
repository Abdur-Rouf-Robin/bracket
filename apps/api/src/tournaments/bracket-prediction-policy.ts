import type { TournamentSettings } from '@bracket/shared';

/** Whether a client may read/write bracket predictions for this tournament. */export function canUseBracketPredictions(
  settings: Pick<
    TournamentSettings,
    'enableBracketPredictions' | 'allowAnonymousPredictions'
  >,
  userId: string | null,
  guestKey?: string,
): boolean {
  if (!settings.enableBracketPredictions) return false;
  if (userId) return true;
  return !!(guestKey && settings.allowAnonymousPredictions);
}

export function validatePredictionCustomFields(
  settings: Pick<
    TournamentSettings,
    'allowCustomPredictionFields' | 'predictionCustomFields'
  >,
  customFields?: Record<string, string | number>,
): Record<string, string | number> {
  const fields = customFields ?? {};
  if (!settings.allowCustomPredictionFields) {
    if (Object.keys(fields).length > 0) {
      throw new Error('Custom prediction fields are disabled');
    }
    return {};
  }

  const defs = settings.predictionCustomFields ?? [];
  const allowed = new Set(defs.map((d) => d.id));

  for (const key of Object.keys(fields)) {
    if (!allowed.has(key)) {
      throw new Error(`Unknown prediction field: ${key}`);
    }
  }

  const normalized: Record<string, string | number> = {};
  for (const def of defs) {
    const raw = fields[def.id];
    if (raw === undefined || raw === '') continue;
    if (def.type === 'number') {
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isNaN(num)) {
        throw new Error(`Field "${def.label}" must be a number`);
      }
      normalized[def.id] = num;
    } else {
      normalized[def.id] = String(raw);
    }
  }

  return normalized;
}
