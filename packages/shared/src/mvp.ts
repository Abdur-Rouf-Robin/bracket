import { z } from 'zod';

/** Per-player stats entered after a match (sport + esports friendly). */
export const playerMatchStatsSchema = z.object({
  playerId: z.string().cuid(),
  teamId: z.string().cuid(),
  yellowCards: z.number().min(0).optional().default(0),
  redCards: z.number().min(0).optional().default(0),
  goals: z.number().min(0).optional().default(0),
  assists: z.number().min(0).optional().default(0),
  points: z.number().min(0).optional().default(0),
  kills: z.number().min(0).optional().default(0),
  deaths: z.number().min(0).optional().default(0),
  rating: z.number().min(0).max(10).optional().nullable(),
});

export type PlayerMatchStatsInput = z.infer<typeof playerMatchStatsSchema>;

export const mvpWeightsSchema = z
  .object({
    goals: z.number().default(3),
    assists: z.number().default(2),
    points: z.number().default(1),
    kills: z.number().default(2),
    deaths: z.number().default(-0.5),
    rating: z.number().default(4),
    winBonus: z.number().default(2),
  })
  .default({
    goals: 3,
    assists: 2,
    points: 1,
    kills: 2,
    deaths: -0.5,
    rating: 4,
    winBonus: 2,
  });

export type MvpWeights = z.infer<typeof mvpWeightsSchema>;

export type PlayerStatRow = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  goals: number;
  assists: number;
  points: number;
  kills: number;
  deaths: number;
  rating: number | null;
  mvpScore: number;
  isMvp: boolean;
  isOnWinningTeam: boolean;
};

export type TournamentMvpRow = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  mvpAwards: number;
  totalMvpScore: number;
  matchesPlayed: number;
  totalGoals: number;
  totalAssists: number;
  totalPoints: number;
  totalKills: number;
  totalDeaths: number;
  avgRating: number | null;
  rank: number;
};

export function computePlayerMvpScore(
  stats: Pick<
    PlayerMatchStatsInput,
    'goals' | 'assists' | 'points' | 'kills' | 'deaths' | 'rating'
  >,
  weights: MvpWeights,
  isOnWinningTeam: boolean,
): number {
  const goals = stats.goals ?? 0;
  const assists = stats.assists ?? 0;
  const points = stats.points ?? 0;
  const kills = stats.kills ?? 0;
  const deaths = stats.deaths ?? 0;
  const rating = stats.rating ?? 0;

  let score =
    goals * weights.goals +
    assists * weights.assists +
    points * weights.points +
    kills * weights.kills +
    deaths * weights.deaths +
    rating * weights.rating;

  if (isOnWinningTeam) score += weights.winBonus;

  return Math.round(score * 100) / 100;
}

export function resolveMatchMvp(
  rows: PlayerStatRow[],
  manualPlayerId?: string | null,
): { mvpPlayerId: string | null; rows: PlayerStatRow[] } {
  const marked = rows.map((r) => ({ ...r, isMvp: false }));

  if (manualPlayerId) {
    const idx = marked.findIndex((r) => r.playerId === manualPlayerId);
    if (idx >= 0) {
      marked[idx]!.isMvp = true;
      return { mvpPlayerId: manualPlayerId, rows: marked };
    }
  }

  if (!marked.length) return { mvpPlayerId: null, rows: marked };

  let best = marked[0]!;
  for (const row of marked) {
    if (row.mvpScore > best.mvpScore) best = row;
    else if (
      row.mvpScore === best.mvpScore &&
      (row.rating ?? 0) > (best.rating ?? 0)
    ) {
      best = row;
    }
  }
  best.isMvp = true;
  return { mvpPlayerId: best.playerId, rows: marked };
}

/** Round importance multiplier for tournament MVP totals (finals weigh more). */
export function mvpRoundMultiplier(
  round: number,
  totalRounds: number,
  custom?: Record<string, number>,
): number {
  if (custom?.[String(round)] != null) return custom[String(round)]!;
  const teamsLeft = 2 ** (totalRounds - round + 1);
  if (teamsLeft <= 2) return 3;
  if (teamsLeft <= 4) return 2;
  if (teamsLeft <= 8) return 1.5;
  return 1;
}

export type CompletedMatchMvpInput = {
  matchId: string;
  round: number;
  mvpPlayerId: string | null;
  playerStats: Array<{
    playerId: string;
    playerName: string;
    teamId: string;
    teamName: string;
    goals: number;
    assists: number;
    points: number;
    kills: number;
    deaths: number;
    rating: number | null;
    mvpScore: number;
    isMvp: boolean;
  }>;
};

export function computeTournamentMvpLeaderboard(
  matches: CompletedMatchMvpInput[],
  totalRounds = 1,
  roundMultipliers?: Record<string, number>,
): TournamentMvpRow[] {
  const byPlayer = new Map<
    string,
    Omit<TournamentMvpRow, 'rank' | 'avgRating'> & {
      ratingSum: number;
      ratingCount: number;
    }
  >();

  for (const m of matches) {
    const mult = mvpRoundMultiplier(m.round, totalRounds, roundMultipliers);
    for (const s of m.playerStats) {
      let row = byPlayer.get(s.playerId);
      if (!row) {
        row = {
          playerId: s.playerId,
          playerName: s.playerName,
          teamId: s.teamId,
          teamName: s.teamName,
          mvpAwards: 0,
          totalMvpScore: 0,
          matchesPlayed: 0,
          totalGoals: 0,
          totalAssists: 0,
          totalPoints: 0,
          totalKills: 0,
          totalDeaths: 0,
          ratingSum: 0,
          ratingCount: 0,
        };
        byPlayer.set(s.playerId, row);
      }
      row.matchesPlayed += 1;
      row.totalMvpScore += s.mvpScore * mult;
      row.totalGoals += s.goals;
      row.totalAssists += s.assists;
      row.totalPoints += s.points;
      row.totalKills += s.kills;
      row.totalDeaths += s.deaths;
      if (s.rating != null) {
        row.ratingSum += s.rating;
        row.ratingCount += 1;
      }
      if (s.isMvp || m.mvpPlayerId === s.playerId) {
        row.mvpAwards += 1;
      }
    }
  }

  const sorted = [...byPlayer.values()]
    .map((r) => ({
      playerId: r.playerId,
      playerName: r.playerName,
      teamId: r.teamId,
      teamName: r.teamName,
      mvpAwards: r.mvpAwards,
      totalMvpScore: Math.round(r.totalMvpScore * 100) / 100,
      matchesPlayed: r.matchesPlayed,
      totalGoals: r.totalGoals,
      totalAssists: r.totalAssists,
      totalPoints: r.totalPoints,
      totalKills: r.totalKills,
      totalDeaths: r.totalDeaths,
      avgRating:
        r.ratingCount > 0
          ? Math.round((r.ratingSum / r.ratingCount) * 100) / 100
          : null,
      rank: 0,
    }))
    .sort((a, b) => {
      if (b.mvpAwards !== a.mvpAwards) return b.mvpAwards - a.mvpAwards;
      if (b.totalMvpScore !== a.totalMvpScore) {
        return b.totalMvpScore - a.totalMvpScore;
      }
      return b.totalGoals + b.totalKills - (a.totalGoals + a.totalKills);
    });

  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}
