import { DEFAULT_TOURNAMENT_SETTINGS, type TournamentSettings } from './index';
import {
  GAME_PROFILES,
  gameRuleForGameName,
  toGameProfile,
  type GameProfile,
} from './game-rules';

export type { GameProfile, GameRuleModule, GameSubcategory, MvpStatField } from './game-rules';
export {
  GAME_RULES,
  GAME_RULES_BY_ID,
  BATTLE_ROYALE_GAME_IDS,
  SUPPORTED_GAME_SEED_NAMES,
  battleRoyalePlacementPoints,
  gameRuleById,
  gameRuleForGameName,
} from './game-rules';

export { GAME_PROFILES };

export function profileForGameName(name: string): GameProfile | undefined {
  const rule = gameRuleForGameName(name);
  return rule ? toGameProfile(rule) : undefined;
}

export function resolveGameProfile(input: {
  gameName?: string | null;
  gameId?: string | null;
}): GameProfile {
  const fromName = profileForGameName(input.gameName ?? '');
  if (fromName) return fromName;
  return GAME_PROFILES.find((p) => p.id === 'football')!;
}

export function applyGameProfile(
  profile: GameProfile,
): { settings: TournamentSettings; pointsWin: number; pointsDraw: number } {
  return {
    settings: {
      ...DEFAULT_TOURNAMENT_SETTINGS,
      ...profile.settings,
      mvpWeights: profile.mvpWeights,
    },
    pointsWin: profile.pointsWin ?? 3,
    pointsDraw: profile.pointsDraw ?? 1,
  };
}
