import type { KnockoutPairing } from './pairing-rules';
import { buildEuroSixGroupKnockoutPairings } from './pairing-rules';

/** Home winner group index for each third-place slot in Euro 6×4 R16. */
const THIRD_SLOT_HOME_GROUP = [2, 1, 5, 4] as const;

function permute<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permute(rest)) {
      result.push([items[i]!, ...tail]);
    }
  }
  return result;
}

/** Assign ranked third-place teams to Euro R16 slots avoiding same-group clashes. */
export function assignEuroThirdPlaceSlots(
  thirdGroupIndices: number[],
): number[] | null {
  const indices = thirdGroupIndices.map((_, i) => i);
  for (const order of permute(indices)) {
    let valid = true;
    for (let slot = 0; slot < THIRD_SLOT_HOME_GROUP.length; slot++) {
      const homeGroup = THIRD_SLOT_HOME_GROUP[slot]!;
      const thirdGroup = thirdGroupIndices[order[slot]!]!;
      if (thirdGroup === homeGroup) {
        valid = false;
        break;
      }
    }
    if (valid) return order;
  }
  return null;
}

export function buildEuroSixGroupKnockoutPairingsDynamic(
  advancers: string[],
  thirdGroupIndices: number[],
): KnockoutPairing[] {
  if (thirdGroupIndices.length !== 4) {
    return buildEuroSixGroupKnockoutPairings(advancers);
  }

  const slotOrder = assignEuroThirdPlaceSlots(thirdGroupIndices);
  if (!slotOrder) {
    return buildEuroSixGroupKnockoutPairings(advancers);
  }

  const base = advancers.slice(0, 12);
  const thirds = advancers.slice(12, 16);
  const reorderedThirds = slotOrder.map((i) => thirds[i]!);
  return buildEuroSixGroupKnockoutPairings([...base, ...reorderedThirds]);
}

export function pickGroupAdvancersWithBestThirdsDetailed(
  standings: Array<{
    teamId: string;
    rank: number;
    groupId: string | null;
    points: number;
    pointsFor: number;
    pointsAgainst: number;
    wins: number;
    fairPlayPoints?: number;
  }>,
  groups: Array<{ id: string; order: number }>,
  advancePerGroup: number,
  bestThirdsCount = 0,
): { advancers: string[]; thirdGroupIndices: number[] } {
  const orderedGroups = [...groups].sort((a, b) => a.order - b.order);
  const groupIndexById = new Map(orderedGroups.map((g, i) => [g.id, i]));

  const advancers: string[] = [];
  for (let rank = 1; rank <= advancePerGroup; rank++) {
    for (const g of orderedGroups) {
      const row = standings.find((s) => s.groupId === g.id && s.rank === rank);
      if (row) advancers.push(row.teamId);
    }
  }

  const thirdGroupIndices: number[] = [];
  if (bestThirdsCount <= 0) {
    return { advancers, thirdGroupIndices };
  }

  const thirds = orderedGroups
    .map((g) => standings.find((s) => s.groupId === g.id && s.rank === 3))
    .filter((row): row is NonNullable<typeof row> => !!row);

  thirds.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.pointsFor - a.pointsAgainst;
    const gdB = b.pointsFor - b.pointsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (a.fairPlayPoints ?? 0) - (b.fairPlayPoints ?? 0);
  });

  for (const row of thirds.slice(0, bestThirdsCount)) {
    advancers.push(row.teamId);
    thirdGroupIndices.push(groupIndexById.get(row.groupId ?? '') ?? 0);
  }

  return { advancers, thirdGroupIndices };
}
