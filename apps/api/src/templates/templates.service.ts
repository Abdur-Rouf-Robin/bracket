import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateTemplateInput,
  TemplateFromTournamentInput,
  TemplatePayload,
  UpdateTemplateInput,
} from '@bracket/shared';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';

const templateInclude = {
  community: { select: { id: true, slug: true, name: true, logoUrl: true } },
  owner: { select: { id: true, name: true, username: true, avatarUrl: true } },
} satisfies Prisma.TournamentTemplateInclude;

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private async requireTemplate(id: string) {
    const t = await this.prisma.tournamentTemplate.findUnique({
      where: { id },
      include: templateInclude,
    });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  /** Owner, or any member of the template's community, may read/use it. */
  private async canRead(
    template: { ownerId: string; communityId: string | null },
    userId: string,
  ) {
    if (template.ownerId === userId) return true;
    if (template.communityId) {
      return this.access.hasCommunityRole(template.communityId, userId, 'AFFILIATE');
    }
    return this.access.isSiteAdmin(userId);
  }

  /** Owner, or COLLABORATOR+ of the template's community, may edit it. */
  private async canWrite(
    template: { ownerId: string; communityId: string | null },
    userId: string,
  ) {
    if (template.ownerId === userId) return true;
    if (template.communityId) {
      return this.access.hasCommunityRole(template.communityId, userId, 'COLLABORATOR');
    }
    return this.access.isSiteAdmin(userId);
  }

  async listMine(userId: string) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId },
      select: { communityId: true },
    });
    const owned = await this.prisma.community.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const communityIds = [
      ...new Set([...memberships.map((m) => m.communityId), ...owned.map((c) => c.id)]),
    ];
    return this.prisma.tournamentTemplate.findMany({
      where: {
        OR: [
          { ownerId: userId },
          ...(communityIds.length ? [{ communityId: { in: communityIds } }] : []),
        ],
      },
      orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
      include: templateInclude,
    });
  }

  async create(userId: string, input: CreateTemplateInput) {
    if (input.communityId) {
      await this.access.requireCommunityRole(input.communityId, userId, 'COLLABORATOR');
    }
    return this.prisma.tournamentTemplate.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        ownerId: userId,
        communityId: input.communityId || null,
        payload: input.payload as Prisma.InputJsonValue,
      },
      include: templateInclude,
    });
  }

  async createFromTournament(
    userId: string,
    tournamentId: string,
    input: TemplateFromTournamentInput,
  ) {
    const t = await this.access.requireTournamentManager(tournamentId, userId);
    const communityId = input.communityId ?? t.communityId ?? null;
    if (communityId) {
      await this.access.requireCommunityRole(communityId, userId, 'COLLABORATOR');
    }
    const game = t.gameId
      ? await this.prisma.game.findUnique({ where: { id: t.gameId }, select: { name: true } })
      : null;
    const teamCount = await this.prisma.team.count({ where: { tournamentId } });
    const settings =
      t.settings && typeof t.settings === 'object' && !Array.isArray(t.settings)
        ? (t.settings as Record<string, unknown>)
        : {};

    const payload: TemplatePayload = {
      name: t.name,
      description: t.description,
      gameId: t.gameId,
      gameName: game?.name ?? null,
      isPublic: t.isPublic,
      pointsWin: t.pointsWin,
      pointsDraw: t.pointsDraw,
      allowPercent: t.allowPercent,
      settings,
      venueType: t.venueType,
      venueName: t.venueName,
      venueAddress: t.venueAddress,
      venueUrl: t.venueUrl,
      format: t.format,
      logoUrl: t.logoUrl,
      backgroundImageUrl: t.backgroundImageUrl,
      ...(teamCount >= 2 ? { teamCount } : {}),
      advancePerGroup: t.advancePerGroup,
      swissRounds: t.swissRounds,
      raceCount: t.raceCount,
      eventCount: t.eventCount,
      timezone: t.timezone,
    };

    return this.prisma.tournamentTemplate.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        ownerId: userId,
        communityId,
        payload: payload as Prisma.InputJsonValue,
      },
      include: templateInclude,
    });
  }

  async get(id: string, userId: string) {
    const t = await this.requireTemplate(id);
    if (!(await this.canRead(t, userId))) {
      throw new ForbiddenException('You cannot view this template');
    }
    return t;
  }

  async update(id: string, userId: string, input: UpdateTemplateInput) {
    const t = await this.requireTemplate(id);
    if (!(await this.canWrite(t, userId))) {
      throw new ForbiddenException('You cannot edit this template');
    }
    if (input.communityId !== undefined && input.communityId !== t.communityId) {
      if (input.communityId) {
        await this.access.requireCommunityRole(input.communityId, userId, 'COLLABORATOR');
      } else if (t.ownerId !== userId) {
        throw new ForbiddenException('Only the template owner can detach it from a community');
      }
    }
    return this.prisma.tournamentTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        communityId: input.communityId === undefined ? undefined : input.communityId || null,
        payload:
          input.payload === undefined ? undefined : (input.payload as Prisma.InputJsonValue),
      },
      include: templateInclude,
    });
  }

  async remove(id: string, userId: string) {
    const t = await this.requireTemplate(id);
    if (!(await this.canWrite(t, userId))) {
      throw new ForbiddenException('You cannot delete this template');
    }
    await this.prisma.tournamentTemplate.delete({ where: { id } });
    return { ok: true };
  }

  async use(id: string, userId: string) {
    const t = await this.requireTemplate(id);
    if (!(await this.canRead(t, userId))) {
      throw new ForbiddenException('You cannot use this template');
    }
    const updated = await this.prisma.tournamentTemplate.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
      select: { id: true, name: true, payload: true, usageCount: true, communityId: true },
    });
    return updated;
  }
}
