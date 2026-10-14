import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SavedSquadInput } from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SquadsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.savedSquad.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { players: { orderBy: { order: 'asc' } } },
    });
  }

  async create(userId: string, input: SavedSquadInput) {
    return this.prisma.savedSquad.create({
      data: {
        userId,
        name: input.name,
        players: {
          create: input.players.map((name, order) => ({ name, order })),
        },
      },
      include: { players: { orderBy: { order: 'asc' } } },
    });
  }

  async remove(userId: string, id: string) {
    const squad = await this.prisma.savedSquad.findFirst({ where: { id, userId } });
    if (!squad) throw new NotFoundException('Squad not found');
    await this.prisma.savedSquad.delete({ where: { id } });
    return { ok: true };
  }

  async copyIntoTournament(userId: string, squadId: string, tournamentId: string) {
    const squad = await this.prisma.savedSquad.findFirst({
      where: { id: squadId, userId },
      include: { players: { orderBy: { order: 'asc' } } },
    });
    if (!squad) throw new NotFoundException('Squad not found');
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { teams: { select: { name: true, seed: true } } },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    const taken = tournament.teams.some(
      (team) => team.name.toLowerCase() === squad.name.toLowerCase(),
    );
    if (taken) throw new BadRequestException('That team name is already in this tournament');
    const seed =
      Math.max(0, ...tournament.teams.map((team) => team.seed ?? 0)) + 1;
    return this.prisma.team.create({
      data: {
        tournamentId,
        name: squad.name,
        seed,
        players: {
          create: squad.players.map((player, order) => ({
            name: player.name,
            order,
          })),
        },
      },
      include: { players: true },
    });
  }
}
