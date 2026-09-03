import { Injectable, BadRequestException } from '@nestjs/common';
import {
  buildShareCardPayload,
  captainFromPlayers,
  defaultRoundLabelForShare,
  formatVenue,
  tournamentSettingsSchema,
  type CongratsSharePayload,
  type MvpSharePayload,
  type PrematchSharePayload,
  type ResultSharePayload,
} from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShareImagesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertShareEnabled(tournamentId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { settings: true, format: true },
    });
    if (!t) throw new BadRequestException('Tournament not found');
    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    if (!settings.enableShareableMatchImages) {
      throw new BadRequestException('Shareable images disabled for this tournament');
    }
    const { formatsSupportShareImage } = await import('@bracket/shared');
    if (!formatsSupportShareImage(t.format)) {
      throw new BadRequestException(
        'Share images only for Single/Double Elim, Round Robin, and Swiss',
      );
    }
  }

  private tournamentVisual(t: {
    name: string;
    slug: string;
    backgroundImageUrl: string | null;
    logoUrl: string | null;
    game?: { name: string } | null;
  }) {
    return {
      name: t.name,
      slug: t.slug,
      gameName: t.game?.name ?? null,
      backgroundImageUrl: t.backgroundImageUrl,
      logoUrl: t.logoUrl,
    };
  }

  private teamVisual(
    team: {
      id: string;
      name: string;
      logoUrl: string | null;
      teamPhotoUrl: string | null;
      poolColor: string | null;
      players?: Array<{
        id: string;
        name: string;
        photoUrl: string | null;
        isCaptain: boolean;
      }>;
    } | null,
  ) {
    if (!team) {
      return {
        id: null,
        name: 'TBD',
        logoUrl: null,
        teamPhotoUrl: null,
        poolColor: null,
        captain: null,
      };
    }
    const captain = captainFromPlayers(team.players ?? []);
    return {
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
      teamPhotoUrl: team.teamPhotoUrl,
      poolColor: team.poolColor,
      captain,
    };
  }

  async prematch(tournamentId: string, matchId: string): Promise<PrematchSharePayload> {
    await this.assertShareEnabled(tournamentId);
    const match = await this.loadMatch(tournamentId, matchId);
    const totalRounds = await this.totalRounds(tournamentId);
    const t = match.tournament;
    return {
      type: 'prematch',
      tournament: this.tournamentVisual(t),
      round: match.round,
      roundLabel: defaultRoundLabelForShare(match.round, totalRounds),
      bracketSide: match.bracketSide,
      scheduledAt:
        match.scheduledAt?.toISOString() ??
        t.startAt?.toISOString() ??
        null,
      venue: formatVenue(t),
      station: match.station ?? null,
      home: this.teamVisual(match.homeTeam),
      away: this.teamVisual(match.awayTeam),
    };
  }

  async result(tournamentId: string, matchId: string): Promise<ResultSharePayload> {
    await this.assertShareEnabled(tournamentId);
    const match = await this.loadMatch(tournamentId, matchId);
    if (match.status !== 'COMPLETED') {
      throw new BadRequestException('Match not completed');
    }
    const totalRounds = await this.totalRounds(tournamentId);
    const settings = tournamentSettingsSchema.parse(match.tournament.settings ?? {});
    const hideSeeds = settings.hideSeedNumbers === true;
    const base = buildShareCardPayload({
      tournamentName: match.tournament.name,
      gameName: match.tournament.game?.name ?? null,
      format: match.tournament.format,
      round: match.round,
      bracketSide: match.bracketSide,
      allowPercent: match.tournament.allowPercent,
      totalRounds,
      home: {
        id: match.homeTeamId,
        name: match.homeTeam?.name ?? 'TBD',
        score: match.homeScore,
        percent: match.homePercent,
        poolColor: match.homeTeam?.poolColor ?? null,
        seed: hideSeeds ? null : match.homeTeam?.seed ?? null,
      },
      away: {
        id: match.awayTeamId,
        name: match.awayTeam?.name ?? 'TBD',
        score: match.awayScore,
        percent: match.awayPercent,
        poolColor: match.awayTeam?.poolColor ?? null,
        seed: hideSeeds ? null : match.awayTeam?.seed ?? null,
      },
      winnerTeamId: match.winnerTeamId,
      winnerName: match.winnerTeam?.name ?? null,
      isDraw: match.isDraw,
    });

    const scorersFor = (teamId: string | null) =>
      match.playerStats
        .filter((s) => s.teamId === teamId && (s.goals > 0 || s.kills > 0))
        .map((s) => {
          const parts: string[] = [];
          if (s.goals > 0) parts.push(`${s.goals}G`);
          if (s.kills > 0) parts.push(`${s.kills}K`);
          if (s.assists > 0) parts.push(`${s.assists}A`);
          return `${s.player.name}${parts.length ? ` (${parts.join(' ')})` : ''}`;
        });

    return {
      type: 'result',
      tournament: this.tournamentVisual(match.tournament),
      round: match.round,
      roundLabel: base.roundLabel,
      bracketSide: match.bracketSide,
      displayMode: base.displayMode,
      home: {
        ...this.teamVisual(match.homeTeam),
        score: match.homeScore,
        percent: match.homePercent,
        isWinner: base.home.isWinner,
        scorers: scorersFor(match.homeTeamId),
      },
      away: {
        ...this.teamVisual(match.awayTeam),
        score: match.awayScore,
        percent: match.awayPercent,
        isWinner: base.away.isWinner,
        scorers: scorersFor(match.awayTeamId),
      },
      isDraw: match.isDraw,
      winner: base.winner,
      scoreMargin: base.scoreMargin,
    };
  }

  async mvp(tournamentId: string, matchId: string): Promise<MvpSharePayload> {
    await this.assertShareEnabled(tournamentId);
    const match = await this.loadMatch(tournamentId, matchId);
    if (match.status !== 'COMPLETED') {
      throw new BadRequestException('Match not completed');
    }
    if (!match.mvpPlayer) {
      throw new BadRequestException('No MVP recorded for this match');
    }
    const stat =
      match.playerStats.find((s) => s.playerId === match.mvpPlayerId) ??
      match.playerStats.find((s) => s.isMvp);
    const totalRounds = await this.totalRounds(tournamentId);
    const team = match.mvpPlayer.team ?? match.homeTeam;

    return {
      type: 'mvp',
      tournament: this.tournamentVisual(match.tournament),
      round: match.round,
      roundLabel: defaultRoundLabelForShare(match.round, totalRounds),
      matchLabel: `${match.homeTeam?.name ?? 'TBD'} vs ${match.awayTeam?.name ?? 'TBD'}`,
      player: {
        id: match.mvpPlayer.id,
        name: match.mvpPlayer.name,
        photoUrl: match.mvpPlayer.photoUrl,
        teamName: team?.name ?? '',
        teamLogoUrl: team?.logoUrl ?? null,
      },
      stats: {
        goals: stat?.goals ?? 0,
        assists: stat?.assists ?? 0,
        points: stat?.points ?? 0,
        kills: stat?.kills ?? 0,
        deaths: stat?.deaths ?? 0,
        rating: stat?.rating ?? null,
        mvpScore: stat?.mvpScore ?? 0,
      },
      homeTeam: match.homeTeam?.name ?? 'TBD',
      awayTeam: match.awayTeam?.name ?? 'TBD',
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    };
  }

  async congrats(
    tournamentId: string,
    teamId: string,
    stageLabel: string,
    stageType: CongratsSharePayload['stageType'] = 'knockout',
    opponentName?: string | null,
    score?: string | null,
  ): Promise<CongratsSharePayload> {
    await this.assertShareEnabled(tournamentId);
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { game: true },
    });
    if (!tournament) throw new BadRequestException('Not found');

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId },
      include: {
        players: { orderBy: { order: 'asc' } },
      },
    });
    if (!team) throw new BadRequestException('Team not found');

    return {
      type: 'congrats',
      tournament: this.tournamentVisual(tournament),
      team: this.teamVisual(team),
      stageLabel,
      stageType,
      opponentName: opponentName ?? null,
      score: score ?? null,
    };
  }

  private async totalRounds(tournamentId: string) {
    const agg = await this.prisma.match.aggregate({
      where: { tournamentId },
      _max: { round: true },
    });
    return agg._max.round ?? 1;
  }

  private async loadMatch(tournamentId: string, matchId: string) {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, tournamentId },
      include: {
        homeTeam: { include: { players: { orderBy: { order: 'asc' } } } },
        awayTeam: { include: { players: { orderBy: { order: 'asc' } } } },
        winnerTeam: true,
        mvpPlayer: { include: { team: true } },
        playerStats: { include: { player: true } },
        tournament: { include: { game: true } },
      },
    });
    if (!match) throw new BadRequestException('Match not found');
    return match;
  }
}
