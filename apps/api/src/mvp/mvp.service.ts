import { BadRequestException, Injectable } from '@nestjs/common';
import {
  computePlayerMvpScore,
  computeTournamentMvpLeaderboard,
  mvpWeightsSchema,
  resolveMatchMvp,
  tournamentSettingsSchema,
  type PlayerMatchStatsInput,
  type TournamentMvpRow,
} from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MvpService {
  constructor(private readonly prisma: PrismaService) {}

  async syncMatchMvp(
    matchId: string,
    input: {
      winnerTeamId: string | null;
      isDraw: boolean;
      homeTeamId: string;
      awayTeamId: string;
      playerStats: PlayerMatchStatsInput[];
      mvpPlayerId?: string | null;
      tournamentSettings: unknown;
    },
  ): Promise<void> {
    const settings = tournamentSettingsSchema.parse(
      input.tournamentSettings ?? {},
    );

    await this.prisma.matchPlayerStat.deleteMany({ where: { matchId } });

    if (!settings.enableMvp) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { mvpPlayerId: null },
      });
      return;
    }

    const weights = mvpWeightsSchema.parse(settings.mvpWeights ?? {});

    const players = await this.prisma.teamPlayer.findMany({
      where: {
        teamId: { in: [input.homeTeamId, input.awayTeamId] },
      },
      include: { team: true },
    });
    const playerMap = new Map(players.map((p) => [p.id, p]));

    const statsInput =
      input.playerStats.length > 0
        ? input.playerStats
        : players.map((p) => ({
            playerId: p.id,
            teamId: p.teamId,
            goals: 0,
            assists: 0,
            points: 0,
            kills: 0,
            deaths: 0,
            yellowCards: 0,
            redCards: 0,
            rating: null as number | null,
          }));

    const rows = statsInput.map((s) => {
      const player = playerMap.get(s.playerId);
      if (!player) {
        throw new BadRequestException(`Unknown player ${s.playerId}`);
      }
      if (s.teamId !== player.teamId) {
        throw new BadRequestException('Player team mismatch');
      }
      const isOnWinningTeam =
        !input.isDraw &&
        input.winnerTeamId != null &&
        s.teamId === input.winnerTeamId;

      const mvpScore = computePlayerMvpScore(s, weights, isOnWinningTeam);

      return {
        playerId: s.playerId,
        playerName: player.name,
        teamId: s.teamId,
        teamName: player.team.name,
        goals: s.goals ?? 0,
        assists: s.assists ?? 0,
        points: s.points ?? 0,
        kills: s.kills ?? 0,
        deaths: s.deaths ?? 0,
        rating: s.rating ?? null,
        mvpScore,
        isMvp: false,
        isOnWinningTeam,
      };
    });

    if (settings.mvpMode === 'MANUAL' && !input.mvpPlayerId) {
      throw new BadRequestException(
        'Select an MVP player (manual MVP mode is enabled)',
      );
    }
    const manualId =
      settings.mvpMode === 'MANUAL' ? input.mvpPlayerId! : null;
    const { mvpPlayerId, rows: resolved } = resolveMatchMvp(rows, manualId);

    for (const row of resolved) {
      await this.prisma.matchPlayerStat.create({
        data: {
          matchId,
          playerId: row.playerId,
          teamId: row.teamId,
          goals: row.goals,
          assists: row.assists,
          points: row.points,
          kills: row.kills,
          deaths: row.deaths,
          yellowCards:
            statsInput.find((s) => s.playerId === row.playerId)?.yellowCards ??
            0,
          redCards:
            statsInput.find((s) => s.playerId === row.playerId)?.redCards ?? 0,
          rating: row.rating,
          mvpScore: row.mvpScore,
          isMvp: row.isMvp,
        },
      });
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: { mvpPlayerId },
    });
  }

  async clearMatchMvp(matchId: string): Promise<void> {
    await this.prisma.matchPlayerStat.deleteMany({ where: { matchId } });
    await this.prisma.match.update({
      where: { id: matchId },
      data: { mvpPlayerId: null },
    });
  }

  async getTournamentLeaderboard(
    tournamentId: string,
  ): Promise<TournamentMvpRow[]> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        matches: {
          where: { status: 'COMPLETED' },
          include: {
            playerStats: {
              include: {
                player: true,
                team: true,
              },
            },
          },
        },
      },
    });
    if (!tournament) return [];

    const settings = tournamentSettingsSchema.parse(tournament.settings ?? {});
    if (!settings.enableMvp) return [];

    const totalRounds = tournament.matches.length
      ? Math.max(...tournament.matches.map((m) => m.round))
      : 1;

    const completed = tournament.matches
      .filter((m) => m.playerStats.length > 0)
      .map((m) => ({
        matchId: m.id,
        round: m.round,
        mvpPlayerId: m.mvpPlayerId,
        playerStats: m.playerStats.map((s) => ({
          playerId: s.playerId,
          playerName: s.player.name,
          teamId: s.teamId,
          teamName: s.team.name,
          goals: s.goals,
          assists: s.assists,
          points: s.points,
          kills: s.kills,
          deaths: s.deaths,
          rating: s.rating,
          mvpScore: s.mvpScore,
          isMvp: s.isMvp,
        })),
      }));

    return computeTournamentMvpLeaderboard(
      completed,
      totalRounds,
      settings.mvpRoundMultipliers,
    );
  }

  async getLeaderboardBySlug(slug: string): Promise<TournamentMvpRow[]> {
    const t = await this.prisma.tournament.findUnique({ where: { slug } });
    if (!t) return [];
    return this.getTournamentLeaderboard(t.id);
  }
}
