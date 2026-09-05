import type { TournamentSettings } from './index';
import { TournamentFormat } from './index';
import type { FormatSuggestion } from './index';
import type { GameProfile } from './game-profiles';
import { BATTLE_ROYALE_GAME_IDS } from './game-rules';

/** Concrete tournament plan the wizard can apply in one click. */
export type FormatPlan = FormatSuggestion & {
  id: string;
  stageMode: 'SINGLE' | 'TWO_STAGE';
  singleStageFormat: TournamentSettings['singleStageFormat'];
  finalStageFormat: TournamentSettings['finalStageFormat'];
  participantsPerGroup: number;
  advancePerGroup: number;
  groupCount: number;
  groupSizes: number[];
  knockoutSlots: number;
  byeCount: number;
  score: number;
  detail: string;
};

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function knockoutByes(slots: number): number {
  const bracket = nextPowerOfTwo(slots);
  return bracket - slots;
}

function distributeTeams(teamCount: number, groupCount: number): number[] {
  const base = Math.floor(teamCount / groupCount);
  const extra = teamCount % groupCount;
  return Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0));
}

function planScore(params: {
  teamCount: number;
  byeCount: number;
  groupSizes: number[];
  balanced: boolean;
  gameBoost: number;
}): number {
  const sizeSpread =
    params.groupSizes.length > 0
      ? Math.max(...params.groupSizes) - Math.min(...params.groupSizes)
      : 0;
  return (
    100 -
    params.byeCount * 8 -
    sizeSpread * 5 +
    (params.balanced ? 10 : 0) +
    params.gameBoost
  );
}

function singleElimPlan(teamCount: number, gameBoost = 0): FormatPlan {
  const byes = knockoutByes(teamCount);
  return {
    id: `se-${teamCount}`,
    format: TournamentFormat.SINGLE_ELIMINATION,
    label: 'Single elimination',
    category: 'Bracket',
    reason: 'Fast knockout bracket.',
    recommended: true,
    stageMode: 'SINGLE',
    singleStageFormat: 'SINGLE_ELIMINATION',
    finalStageFormat: 'SINGLE_ELIMINATION',
    participantsPerGroup: 4,
    advancePerGroup: 2,
    groupCount: 0,
    groupSizes: [],
    knockoutSlots: teamCount,
    byeCount: byes,
    score: planScore({ teamCount, byeCount: byes, groupSizes: [], balanced: true, gameBoost }),
    detail:
      byes > 0
        ? `${teamCount} teams → ${nextPowerOfTwo(teamCount)}-team bracket (${byes} bye${byes === 1 ? '' : 's'}).`
        : `${teamCount} teams → clean ${teamCount}-team bracket, no byes.`,
  };
}

function doubleElimPlan(teamCount: number, gameBoost = 0): FormatPlan {
  const byes = knockoutByes(teamCount);
  return {
    id: `de-${teamCount}`,
    format: TournamentFormat.DOUBLE_ELIMINATION,
    label: 'Double elimination',
    category: 'Bracket',
    reason: 'Teams must lose twice to be eliminated.',
    recommended: teamCount >= 6 && teamCount <= 16,
    stageMode: 'SINGLE',
    singleStageFormat: 'DOUBLE_ELIMINATION',
    finalStageFormat: 'SINGLE_ELIMINATION',
    participantsPerGroup: 4,
    advancePerGroup: 2,
    groupCount: 0,
    groupSizes: [],
    knockoutSlots: teamCount,
    byeCount: byes,
    score: planScore({ teamCount, byeCount: byes, groupSizes: [], balanced: true, gameBoost: gameBoost + 5 }),
    detail: `${teamCount} teams in winners + losers brackets${byes ? ` (${byes} opening bye${byes === 1 ? '' : 's'})` : ''}.`,
  };
}

function roundRobinPlan(teamCount: number): FormatPlan | null {
  if (teamCount < 3 || teamCount > 12) return null;
  const matches = (teamCount * (teamCount - 1)) / 2;
  return {
    id: `rr-${teamCount}`,
    format: TournamentFormat.ROUND_ROBIN,
    label: 'Round robin league',
    category: 'League',
    reason: 'Every team plays every other team.',
    recommended: teamCount <= 8,
    stageMode: 'SINGLE',
    singleStageFormat: 'ROUND_ROBIN',
    finalStageFormat: 'SINGLE_ELIMINATION',
    participantsPerGroup: teamCount,
    advancePerGroup: 2,
    groupCount: 1,
    groupSizes: [teamCount],
    knockoutSlots: 0,
    byeCount: 0,
    score: planScore({
      teamCount,
      byeCount: 0,
      groupSizes: [teamCount],
      balanced: true,
      gameBoost: teamCount <= 8 ? 15 : 0,
    }),
    detail: `${teamCount} teams, ${matches} group matches — no knockout unless you add playoffs later.`,
  };
}

function swissPlan(teamCount: number): FormatPlan | null {
  if (teamCount < 4) return null;
  const rounds = Math.min(7, Math.ceil(Math.log2(teamCount)) + 2);
  return {
    id: `swiss-${teamCount}`,
    format: TournamentFormat.SWISS,
    label: 'Swiss system',
    category: 'League',
    reason: 'Pair teams with similar records each round.',
    recommended: teamCount >= 8 && teamCount % 2 === 0,
    stageMode: 'SINGLE',
    singleStageFormat: 'SWISS',
    finalStageFormat: 'SINGLE_ELIMINATION',
    participantsPerGroup: 4,
    advancePerGroup: 2,
    groupCount: 0,
    groupSizes: [],
    knockoutSlots: 0,
    byeCount: teamCount % 2,
    score: planScore({
      teamCount,
      byeCount: teamCount % 2,
      groupSizes: [],
      balanced: true,
      gameBoost: teamCount >= 8 ? 8 : 0,
    }),
    detail: `${teamCount} teams, ${rounds} Swiss rounds${teamCount % 2 ? ' (one bye per round possible)' : ''}.`,
  };
}

function groupsKnockoutPlan(
  teamCount: number,
  groupCount: number,
  advancePerGroup: number,
  gameBoost = 0,
): FormatPlan | null {
  if (groupCount < 2) return null;
  const sizes = distributeTeams(teamCount, groupCount);
  if (sizes.some((s) => s < 2)) return null;
  const koSlots = groupCount * advancePerGroup;
  if (koSlots < 2) return null;
  const byes = knockoutByes(koSlots);
  const spread = Math.max(...sizes) - Math.min(...sizes);
  return {
    id: `gko-${teamCount}-g${groupCount}-a${advancePerGroup}`,
    format: TournamentFormat.GROUPS_KNOCKOUT,
    label: `Groups (${groupCount}) → knockout`,
    category: 'Hybrid',
    reason: 'Group stage then elimination playoffs.',
    recommended: true,
    stageMode: 'TWO_STAGE',
    singleStageFormat: 'SINGLE_ELIMINATION',
    finalStageFormat: 'SINGLE_ELIMINATION',
    participantsPerGroup: Math.max(...sizes),
    advancePerGroup,
    groupCount,
    groupSizes: sizes,
    knockoutSlots: koSlots,
    byeCount: byes,
    score: planScore({
      teamCount,
      byeCount: byes,
      groupSizes: sizes,
      balanced: spread <= 1,
      gameBoost: gameBoost + (spread <= 1 ? 12 : 0) - byes * 2,
    }),
    detail: `${sizes.join('+')} teams across ${groupCount} groups, top ${advancePerGroup} each → ${koSlots}-team knockout${byes ? ` (${byes} bye${byes === 1 ? '' : 's'})` : ''}.`,
  };
}

function enumerateGroupPlans(teamCount: number, gameBoost = 0): FormatPlan[] {
  const out: FormatPlan[] = [];
  for (let g = 2; g <= Math.min(8, teamCount - 1); g++) {
    for (const advance of [1, 2, 3]) {
      if (g * advance > teamCount && advance > 2) continue;
      const plan = groupsKnockoutPlan(teamCount, g, advance, gameBoost);
      if (plan) out.push(plan);
    }
  }
  return out;
}

const EVENT_FORMATS = new Set<TournamentFormat>([
  TournamentFormat.LEADERBOARD,
  TournamentFormat.TIME_TRIAL,
  TournamentFormat.SINGLE_RACE,
  TournamentFormat.GRAND_PRIX,
  TournamentFormat.FREE_FOR_ALL,
]);

/** Ranked format plans for a team count, optionally biased by game profile. */
export function suggestFormatPlans(
  teamCount: number,
  gameProfile?: Pick<GameProfile, 'id' | 'settings' | 'category'>,
): FormatPlan[] {
  if (teamCount < 2) return [];

  const boost = (id: string) =>
    gameProfile?.id === id || gameProfile?.settings?.singleStageFormat === id
      ? 10
      : 0;

  const plans: FormatPlan[] = [];

  if (teamCount >= 2) plans.push(singleElimPlan(teamCount, boost('fc26')));
  if (teamCount >= 4) plans.push(doubleElimPlan(teamCount, boost('mobile-legends')));

  const rr = roundRobinPlan(teamCount);
  if (rr) plans.push(rr);

  const swiss = swissPlan(teamCount);
  if (swiss) plans.push(swiss);

  plans.push(...enumerateGroupPlans(teamCount, boost('football') + boost('cricket')));

  // Prefer profile defaults when they match a generated plan
  if (gameProfile?.settings?.stageMode === 'TWO_STAGE') {
    for (const p of plans) {
      if (p.stageMode === 'TWO_STAGE') p.score += 6;
    }
  }
  if (gameProfile?.settings?.singleStageFormat === 'DOUBLE_ELIMINATION') {
    for (const p of plans) {
      if (p.singleStageFormat === 'DOUBLE_ELIMINATION') p.score += 8;
    }
  }
  if (gameProfile?.category === 'Outdoor' || gameProfile?.category === 'Sports') {
    for (const p of plans) {
      if (p.format === TournamentFormat.GROUPS_KNOCKOUT) p.score += 5;
    }
  }
  if (gameProfile?.id === 'clash-of-clans') {
    for (const p of plans) {
      if (p.format === TournamentFormat.GROUPS_KNOCKOUT && p.advancePerGroup === 2) {
        p.score += 8;
      }
    }
  }
  if (gameProfile?.id && BATTLE_ROYALE_GAME_IDS.has(gameProfile.id)) {
    return [
      {
        id: `lb-${teamCount}`,
        format: TournamentFormat.LEADERBOARD,
        label: 'Leaderboard series',
        category: 'Ranking',
        reason: 'Multiple matches — cumulative points decide the winner.',
        recommended: true,
        stageMode: 'SINGLE',
        singleStageFormat: 'LEADERBOARD',
        finalStageFormat: 'SINGLE_ELIMINATION',
        participantsPerGroup: 4,
        advancePerGroup: 2,
        groupCount: 0,
        groupSizes: [],
        knockoutSlots: 0,
        byeCount: 0,
        score: 100,
        detail: `${teamCount} teams scored across multiple events.`,
      },
    ];
  }

  const ranked = [...plans]
    .filter((p) => !EVENT_FORMATS.has(p.format) || p.format === TournamentFormat.LEADERBOARD)
    .sort((a, b) => b.score - a.score);

  // Deduplicate by id and mark top 3 as recommended
  const seen = new Set<string>();
  const unique = ranked.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  unique.forEach((p, i) => {
    p.recommended = i < 3;
  });

  if (!unique.length) {
    unique.push(singleElimPlan(teamCount));
    unique[0]!.recommended = true;
  }

  return unique;
}

/** Apply a format plan onto tournament settings (merges with game profile defaults). */
export function applyFormatPlan(
  plan: FormatPlan,
  base: TournamentSettings,
): TournamentSettings {
  return {
    ...base,
    stageMode: plan.stageMode,
    singleStageFormat: plan.singleStageFormat,
    finalStageFormat: plan.finalStageFormat,
    participantsPerGroup: plan.participantsPerGroup,
    advancePerGroup: plan.advancePerGroup,
    swissRounds:
      plan.singleStageFormat === 'SWISS'
        ? Math.min(7, Math.ceil(Math.log2(plan.knockoutSlots || 8)) + 2)
        : base.swissRounds,
  };
}
