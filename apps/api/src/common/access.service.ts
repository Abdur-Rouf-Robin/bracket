import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommunityRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const COMMUNITY_ROLE_RANK: Record<CommunityRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  COLLABORATOR: 2,
  AFFILIATE: 1,
};

/**
 * Central authorization helpers shared by all feature modules.
 * Every "can this user touch this thing" question should go through here so
 * permission rules stay consistent (owner > tournament admin > community role).
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Site-wide admins can manage anything. */
  async isSiteAdmin(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return u?.role === 'ADMIN';
  }

  /** Owner, tournament co-admin, or community collaborator+ of the hosting community. */
  async canManageTournament(
    tournamentId: string,
    userId: string | null | undefined,
  ): Promise<boolean> {
    if (!userId) return false;
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        createdById: true,
        communityId: true,
        admins: { select: { userId: true } },
      },
    });
    if (!t) return false;
    if (t.createdById === userId) return true;
    if (t.admins.some((a) => a.userId === userId)) return true;
    if (t.communityId) {
      const role = await this.communityRole(t.communityId, userId);
      if (role && COMMUNITY_ROLE_RANK[role] >= COMMUNITY_ROLE_RANK.COLLABORATOR) {
        return true;
      }
    }
    return this.isSiteAdmin(userId);
  }

  async requireTournamentManager(tournamentId: string, userId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!t) throw new NotFoundException('Tournament not found');
    if (!(await this.canManageTournament(tournamentId, userId))) {
      throw new ForbiddenException('You cannot manage this tournament');
    }
    return t;
  }

  async requireTournamentOwner(tournamentId: string, userId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!t) throw new NotFoundException('Tournament not found');
    if (t.createdById !== userId && !(await this.isSiteAdmin(userId))) {
      throw new ForbiddenException('Only the tournament owner can do this');
    }
    return t;
  }

  async requireTournamentManagerBySlug(slug: string, userId: string) {
    const t = await this.prisma.tournament.findUnique({ where: { slug } });
    if (!t) throw new NotFoundException('Tournament not found');
    if (!(await this.canManageTournament(t.id, userId))) {
      throw new ForbiddenException('You cannot manage this tournament');
    }
    return t;
  }

  async communityRole(
    communityId: string,
    userId: string | null | undefined,
  ): Promise<CommunityRole | null> {
    if (!userId) return null;
    const c = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: {
        ownerId: true,
        members: { where: { userId }, select: { role: true } },
      },
    });
    if (!c) return null;
    if (c.ownerId === userId) return 'OWNER';
    return c.members[0]?.role ?? null;
  }

  async hasCommunityRole(
    communityId: string,
    userId: string | null | undefined,
    minRole: CommunityRole,
  ): Promise<boolean> {
    const role = await this.communityRole(communityId, userId);
    if (role && COMMUNITY_ROLE_RANK[role] >= COMMUNITY_ROLE_RANK[minRole]) {
      return true;
    }
    return userId ? this.isSiteAdmin(userId) : false;
  }

  async requireCommunityRole(
    communityId: string,
    userId: string,
    minRole: CommunityRole,
  ) {
    const c = await this.prisma.community.findUnique({
      where: { id: communityId },
    });
    if (!c) throw new NotFoundException('Community not found');
    if (!(await this.hasCommunityRole(communityId, userId, minRole))) {
      throw new ForbiddenException('Insufficient community permissions');
    }
    return c;
  }

  async canManageEvent(
    eventId: string,
    userId: string | null | undefined,
  ): Promise<boolean> {
    if (!userId) return false;
    const e = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        ownerId: true,
        communityId: true,
        admins: { select: { userId: true } },
      },
    });
    if (!e) return false;
    if (e.ownerId === userId) return true;
    if (e.admins.some((a) => a.userId === userId)) return true;
    if (e.communityId) {
      if (await this.hasCommunityRole(e.communityId, userId, 'COLLABORATOR')) {
        return true;
      }
    }
    return this.isSiteAdmin(userId);
  }

  async requireEventManager(eventId: string, userId: string) {
    const e = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!e) throw new NotFoundException('Event not found');
    if (!(await this.canManageEvent(eventId, userId))) {
      throw new ForbiddenException('You cannot manage this event');
    }
    return e;
  }

  /** Returns the effective plan for a user (Premier if active subscription). */
  async userPlan(userId: string): Promise<'FREE' | 'PREMIER'> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        planExpiresAt: true,
        role: true,
        subscription: { select: { status: true, plan: true } },
      },
    });
    if (!u) return 'FREE';
    if (u.role === 'ADMIN') return 'PREMIER';
    if (
      u.subscription &&
      (u.subscription.status === 'ACTIVE' || u.subscription.status === 'TRIALING')
    ) {
      return u.subscription.plan;
    }
    if (u.plan === 'PREMIER') {
      if (!u.planExpiresAt || u.planExpiresAt > new Date()) return 'PREMIER';
    }
    return 'FREE';
  }
}
