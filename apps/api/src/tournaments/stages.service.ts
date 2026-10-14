import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus, TournamentFormat } from '@prisma/client';
import {
  generateDoubleElimination,
  generateGauntlet,
  generateRoundRobin,
  generateSingleElimination,
  generateSwiss,
  type EngineTeam,
  type GeneratedMatch,
} from '@bracket/bracket-engine';
import type { CreateStageInput } from '@bracket/shared';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';

const STAGE_FORMATS = new Set<string>([
  'SINGLE_ELIMINATION',
  'DOUBLE_ELIMINATION',
  'ROUND_ROBIN',
  'SWISS',
  'GAUNTLET',
]);

@Injectable()
export class StagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  list(tournamentId: string) {
    return this.prisma.tournamentStage.findMany({
      where: { tournamentId },
      orderBy: { order: 'asc' },
      include: { _count: { select: { matches: true } } },
    });
  }

  async create(tournamentId: string, userId: string, input: CreateStageInput) {
    await this.access.requireTournamentManager(tournamentId, userId);
    if (!STAGE_FORMATS.has(input.format)) {
      throw new BadRequestException('That format cannot be a later stage');
    }
    const last = await this.prisma.tournamentStage.findFirst({
      where: { tournamentId },
      orderBy: { order: 'desc' },
    });
    return this.prisma.tournamentStage.create({
      data: {
        tournamentId,
        order: (last?.order ?? 0) + 1,
        name: input.name,
        format: input.format,
        advanceCount: input.advanceCount ?? null,
      },
    });
  }

  async remove(tournamentId: string, userId: string, stageId: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const stage = await this.ownStage(tournamentId, stageId);
    if (stage.status !== 'PENDING') {
      throw new BadRequestException('Only a stage that has not started can be removed');
    }
    await this.prisma.tournamentStage.delete({ where: { id: stage.id } });
    return { ok: true };
  }

  async open(tournamentId: string, userId: string, stageId: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const stage = await this.ownStage(tournamentId, stageId);
    if (stage.status !== 'PENDING') {
      throw new BadRequestException('This stage is already open');
    }
    const previous = await this.prisma.tournamentStage.findFirst({
      where: { tournamentId, order: stage.order - 1 },
    });
    if (stage.order > 1 && !previous) {
      throw new BadRequestException('Add the earlier stage first');
    }
    if (previous && previous.status === 'PENDING') {
      throw new BadRequestException('Open the previous stage first');
    }

    if (stage.order === 1) {
      const loose = await this.prisma.match.count({
        where: { tournamentId, stageId: null },
      });
      if (loose > 0) {
        await this.prisma.match.updateMany({
          where: { tournamentId, stageId: null },
          data: { stageId: stage.id },
        });
        return this.prisma.tournamentStage.update({
          where: { id: stage.id },
          data: { status: 'ACTIVE' },
        });
      }
    }

    const teams = await this.teamsForStage(tournamentId, previous);
    if (teams.length < 2) {
      throw new BadRequestException('A stage needs at least two teams');
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    const generated = this.buildMatches(stage.format, teams, tournament.swissRounds).map(
      (match) => ({
        ...match,
        key: `st${stage.order}-${match.key}`,
        homeFromMatchKey: match.homeFromMatchKey
          ? `st${stage.order}-${match.homeFromMatchKey}`
          : null,
        awayFromMatchKey: match.awayFromMatchKey
          ? `st${stage.order}-${match.awayFromMatchKey}`
          : null,
        nextMatchKey: match.nextMatchKey ? `st${stage.order}-${match.nextMatchKey}` : null,
        loserNextMatchKey: match.loserNextMatchKey
          ? `st${stage.order}-${match.loserNextMatchKey}`
          : null,
      }),
    );

    const keyToId = new Map<string, string>();
    for (const match of generated) {
      const created = await this.prisma.match.create({
        data: {
          tournamentId,
          stageId: stage.id,
          key: match.key,
          round: match.round,
          position: match.position,
          bracketSide: match.bracketSide,
          homeTeamId: match.homeTeamId ?? null,
          awayTeamId: match.awayTeamId ?? null,
          isBye: !!match.isBye,
          bestOf: match.bestOf ?? null,
          isPlacement: !!match.isPlacement,
          placementRank: match.placementRank ?? null,
          status:
            match.homeTeamId && match.awayTeamId
              ? MatchStatus.READY
              : match.isBye
                ? MatchStatus.READY
                : MatchStatus.PENDING,
        },
      });
      keyToId.set(match.key, created.id);
    }

    for (const match of generated) {
      const matchId = keyToId.get(match.key);
      if (!matchId) continue;
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          nextMatchId: match.nextMatchKey ? (keyToId.get(match.nextMatchKey) ?? null) : null,
          nextMatchSlot: match.nextMatchSlot ?? null,
          loserNextMatchId: match.loserNextMatchKey
            ? (keyToId.get(match.loserNextMatchKey) ?? null)
            : null,
          loserNextMatchSlot: match.loserNextMatchSlot ?? null,
        },
      });
    }

    const byes = await this.prisma.match.findMany({
      where: { stageId: stage.id, isBye: true },
    });
    for (const bye of byes) {
      const winnerId = bye.homeTeamId ?? bye.awayTeamId;
      if (!winnerId) continue;
      await this.prisma.match.update({
        where: { id: bye.id },
        data: {
          status: MatchStatus.COMPLETED,
          winnerTeamId: winnerId,
          homeScore: bye.homeTeamId ? 1 : 0,
          awayScore: bye.awayTeamId ? 1 : 0,
        },
      });
      if (!bye.nextMatchId || !bye.nextMatchSlot) continue;
      await this.prisma.match.update({
        where: { id: bye.nextMatchId },
        data:
          bye.nextMatchSlot === 'home'
            ? { homeTeamId: winnerId }
            : { awayTeamId: winnerId },
      });
    }

    if (previous) {
      await this.prisma.tournamentStage.update({
        where: { id: previous.id },
        data: { status: 'COMPLETE' },
      });
    }
    return this.prisma.tournamentStage.update({
      where: { id: stage.id },
      data: { status: 'ACTIVE' },
    });
  }

  private async ownStage(tournamentId: string, stageId: string) {
    const stage = await this.prisma.tournamentStage.findFirst({
      where: { id: stageId, tournamentId },
    });
    if (!stage) throw new NotFoundException('Stage not found');
    return stage;
  }

  private async teamsForStage(
    tournamentId: string,
    previous: { id: string; advanceCount: number | null } | null,
  ): Promise<EngineTeam[]> {
    if (!previous) {
      const teams = await this.prisma.team.findMany({
        where: { tournamentId, withdrawn: false },
        orderBy: { seed: 'asc' },
      });
      return teams.map((team, index) => ({
        id: team.id,
        name: team.name,
        seed: team.seed ?? index + 1,
      }));
    }

    const matches = await this.prisma.match.findMany({
      where: { stageId: previous.id },
    });
    if (!matches.length) {
      throw new BadRequestException('The previous stage has no matches yet');
    }
    const unfinished = matches.some(
      (match) => match.status !== MatchStatus.COMPLETED && !match.isBye,
    );
    if (unfinished) {
      throw new BadRequestException('Finish every match in the current stage first');
    }

    const rows = new Map<string, { wins: number; diff: number }>();
    for (const match of matches) {
      for (const teamId of [match.homeTeamId, match.awayTeamId]) {
        if (teamId && !rows.has(teamId)) rows.set(teamId, { wins: 0, diff: 0 });
      }
      if (match.status !== MatchStatus.COMPLETED || !match.winnerTeamId) continue;
      const row = rows.get(match.winnerTeamId);
      if (row) row.wins += 1;
      const home = match.homeScore ?? 0;
      const away = match.awayScore ?? 0;
      if (match.homeTeamId && rows.has(match.homeTeamId)) {
        rows.get(match.homeTeamId)!.diff += home - away;
      }
      if (match.awayTeamId && rows.has(match.awayTeamId)) {
        rows.get(match.awayTeamId)!.diff += away - home;
      }
    }

    const ranked = [...rows.entries()].sort(
      (a, b) => b[1].wins - a[1].wins || b[1].diff - a[1].diff,
    );
    const take = previous.advanceCount ?? ranked.length;
    const ids = ranked.slice(0, take).map(([id]) => id);
    const teams = await this.prisma.team.findMany({ where: { id: { in: ids } } });
    const byId = new Map(teams.map((team) => [team.id, team]));
    const advanced: EngineTeam[] = [];
    ids.forEach((id, index) => {
      const team = byId.get(id);
      if (!team) return;
      advanced.push({ id: team.id, name: team.name, seed: index + 1 });
    });
    return advanced;
  }

  private buildMatches(
    format: TournamentFormat,
    teams: EngineTeam[],
    swissRounds: number,
  ): GeneratedMatch[] {
    if (format === 'DOUBLE_ELIMINATION') return generateDoubleElimination(teams);
    if (format === 'ROUND_ROBIN') return generateRoundRobin(teams);
    if (format === 'SWISS') return generateSwiss(teams, swissRounds);
    if (format === 'GAUNTLET') return generateGauntlet(teams);
    return generateSingleElimination(teams);
  }
}
