import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type {
  AdminCreateGameInput,
  AdminCreateUserInput,
  AdminUpdateGameInput,
  AdminUpdateTournamentInput,
  AdminUpdateUserInput,
} from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { tournaments: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const [
      users,
      admins,
      tournaments,
      activeTournaments,
      games,
      matches,
      teams,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.tournament.count(),
      this.prisma.tournament.count({ where: { status: 'ACTIVE' } }),
      this.prisma.game.count(),
      this.prisma.match.count(),
      this.prisma.team.count(),
    ]);
    return {
      users,
      admins,
      tournaments,
      activeTournaments,
      games,
      matches,
      teams,
    };
  }

  async listUsers(query?: string) {
    const q = query?.trim();
    return this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: USER_SELECT,
    });
  }

  async createUser(input: AdminCreateUserInput) {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.prisma.user.create({
      data: {
        email,
        name: input.name,
        passwordHash,
        role: input.role ?? UserRole.USER,
      },
      select: USER_SELECT,
    });
  }

  async updateUser(id: string, actorId: string, input: AdminUpdateUserInput) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (id === actorId && input.role && input.role !== 'ADMIN') {
      throw new BadRequestException('You cannot remove your own admin role');
    }

    if (input.role === 'USER' && user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({
        where: { role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('At least one admin is required');
      }
    }

    const passwordHash = input.password
      ? await bcrypt.hash(input.password, 10)
      : undefined;

    return this.prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role,
        passwordHash,
      },
      select: USER_SELECT,
    });
  }

  async deleteUser(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { tournaments: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user._count.tournaments > 0) {
      throw new BadRequestException(
        'This user still owns tournaments. Delete those first.',
      );
    }
    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({
        where: { role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('At least one admin is required');
      }
    }
    await this.prisma.announcement.deleteMany({ where: { authorId: id } });
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  async listTournaments(query?: string) {
    const q = query?.trim();
    return this.prisma.tournament.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        game: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { teams: true, matches: true } },
      },
    });
  }

  async updateTournament(id: string, input: AdminUpdateTournamentInput) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return this.prisma.tournament.update({
      where: { id },
      data: {
        status: input.status,
        isPublic: input.isPublic,
      },
      include: {
        game: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { teams: true, matches: true } },
      },
    });
  }

  async deleteTournament(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    await this.prisma.tournament.delete({ where: { id } });
    return { ok: true };
  }

  listGames() {
    return this.prisma.game.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { tournaments: true } } },
    });
  }

  async createGame(input: AdminCreateGameInput) {
    const existing = await this.prisma.game.findUnique({
      where: { name: input.name },
    });
    if (existing) {
      throw new ConflictException('A game with that name already exists');
    }
    return this.prisma.game.create({
      data: {
        name: input.name,
        category: input.category,
        sortOrder: input.sortOrder ?? 100,
        active: input.active ?? true,
      },
      include: { _count: { select: { tournaments: true } } },
    });
  }

  async updateGame(id: string, input: AdminUpdateGameInput) {
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (!game) throw new NotFoundException('Game not found');
    if (input.name && input.name !== game.name) {
      const clash = await this.prisma.game.findUnique({
        where: { name: input.name },
      });
      if (clash) {
        throw new ConflictException('A game with that name already exists');
      }
    }
    return this.prisma.game.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category,
        sortOrder: input.sortOrder,
        active: input.active,
      },
      include: { _count: { select: { tournaments: true } } },
    });
  }

  async deleteGame(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: { _count: { select: { tournaments: true } } },
    });
    if (!game) throw new NotFoundException('Game not found');
    if (game._count.tournaments > 0) {
      throw new BadRequestException(
        'Cannot delete a game that still has tournaments — deactivate it instead',
      );
    }
    await this.prisma.game.delete({ where: { id } });
    return { ok: true };
  }
}
