import type { TournamentSettings } from '../index';
import type { MatchEntryMode } from '../match-entry';
import type { MvpWeights } from '../mvp';

export type GameCategory = 'Esports' | 'Outdoor';
export type GameSubcategory =
  | 'shooting'
  | 'moba'
  | 'football-sim'
  | 'strategy'
  | 'outdoor';

export type MvpStatField =
  | 'goals'
  | 'assists'
  | 'points'
  | 'kills'
  | 'deaths'
  | 'rating'
  | 'yellowCards'
  | 'redCards';

export type GameRuleModule = {
  /** Stable profile id (matches registry key). */
  id: string;
  /** Exact name stored in `Game.name` on seed. */
  seedName: string;
  name: string;
  category: GameCategory;
  subcategory: GameSubcategory;
  blurb: string;
  matchEntry: MatchEntryMode;
  settings: Partial<TournamentSettings>;
  pointsWin?: number;
  pointsDraw?: number;
  /** Default MVP formula weights for this title. */
  mvpWeights: MvpWeights;
  /** Stat columns shown in player MVP form. */
  mvpStatFields: MvpStatField[];
  /** Extra lowercase aliases for legacy name matching. */
  aliases: string[];
  /** Uses LEADERBOARD / event points (battle royale). */
  battleRoyale?: boolean;
};

export type GameProfile = {
  id: string;
  name: string;
  category: GameCategory;
  subcategory?: GameSubcategory;
  blurb: string;
  matchEntry: MatchEntryMode;
  settings: Partial<TournamentSettings>;
  pointsWin?: number;
  pointsDraw?: number;
  mvpWeights?: MvpWeights;
  mvpStatFields?: MvpStatField[];
  battleRoyale?: boolean;
};
