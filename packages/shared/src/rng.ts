import { createHash } from 'crypto';

/** Deterministic PRNG (Mulberry32) from a numeric seed. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(input: string): number {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 8);
  return parseInt(hex, 16) >>> 0;
}

export type DrawAuditEntry = {
  at: string;
  operation: string;
  seed: string;
  seedHash: number;
  inputOrder: string[];
  outputOrder: string[];
};

/** Fisher–Yates shuffle with auditable seed; returns shuffled copy + audit metadata. */
export function seededShuffle<T extends { id: string }>(
  items: T[],
  seed: string,
  operation = 'shuffle',
): { items: T[]; audit: DrawAuditEntry } {
  const arr = [...items];
  const rng = mulberry32(hashSeed(seed));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return {
    items: arr,
    audit: {
      at: new Date().toISOString(),
      operation,
      seed,
      seedHash: hashSeed(seed),
      inputOrder: items.map((x) => x.id),
      outputOrder: arr.map((x) => x.id),
    },
  };
}

export function createDrawSeed(tournamentId: string, operation: string): string {
  return `${tournamentId}:${operation}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}
