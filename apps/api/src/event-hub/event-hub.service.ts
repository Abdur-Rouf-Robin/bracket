import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import slugify from 'slugify';
import {
  bucketTournamentStatus,
  toStreamEmbedUrl,
  type CreateEventInput,
  type EventQuickTournamentInput,
  type ListEventsQuery,
  type UpdateEventInput,
} from '@bracket/shared';
import { ConfigService } from '@nestjs/config';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';

const COMMUNITY_SELECT = {
  id: true,
  slug: true,
  name: true,
  logoUrl: true,
} as const;

const EVENT_TOURNAMENT_SELECT = {
  id: true,
  slug: true,
  name: true,
  format: true,
  status: true,
  startAt: true,
  isPublic: true,
  game: { select: { id: true, name: true, category: true } },
  _count: { select: { teams: true } },
} as const;

@Injectable()
export class EventHubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private toSlug(name: string) {
    return (
      slugify(name, { lower: true, strict: true }).slice(0, 80) ||
      `event-${Date.now().toString(36)}`
    );
  }

  private async uniqueEventSlug(base: string, excludeId?: string) {
    let candidate = base;
    for (let i = 0; i < 50; i++) {
      const existing = await this.prisma.event.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    throw new BadRequestException('Could not allocate a unique slug');
  }

  private async uniqueTournamentSlug(base: string) {
    let candidate = base;
    for (let i = 0; i < 50; i++) {
      const existing = await this.prisma.tournament.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
      candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    throw new BadRequestException('Could not allocate a unique slug');
  }

  private parentHost(): string {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    try {
      return new URL(appUrl).hostname;
    } catch {
      return 'localhost';
    }
  }

  private toDate(v: string | null | undefined): Date | null | undefined {
    if (v === undefined) return undefined;
    if (v === null) return null;
    return new Date(v);
  }

  async requireOwner(eventId: string, userId: string) {
    const e = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!e) throw new NotFoundException('Event not found');
    if (e.ownerId !== userId && !(await this.access.isSiteAdmin(userId))) {
      throw new ForbiddenException('Only the event owner can do this');
    }
    return e;
  }

  // -------------------------------------------------------------------------
  // Events CRUD
  // -------------------------------------------------------------------------

  async create(userId: string, input: CreateEventInput) {
    if (input.communityId) {
      const ok = await this.access.hasCommunityRole(
        input.communityId,
        userId,
        'COLLABORATOR',
      );
      if (!ok) {
        throw new ForbiddenException(
          'You need collaborator access in that community',
        );
      }
    }
    if (input.startAt && input.endAt && new Date(input.endAt) < new Date(input.startAt)) {
      throw new BadRequestException('End date must be after start date');
    }
    const slug = await this.uniqueEventSlug(input.slug ?? this.toSlug(input.name));
    return this.prisma.event.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        startAt: this.toDate(input.startAt) ?? null,
        endAt: this.toDate(input.endAt) ?? null,
        timezone: input.timezone ?? 'UTC',
        venueType: input.venueType ?? null,
        venueName: input.venueName ?? null,
        venueAddress: input.venueAddress ?? null,
        venueUrl: input.venueUrl ?? null,
        streamUrl: input.streamUrl ?? null,
        logoUrl: input.logoUrl ?? null,
        bannerUrl: input.bannerUrl ?? null,
        isPublic: input.isPublic ?? true,
        ownerId: userId,
        communityId: input.communityId ?? null,
      },
      include: {
        community: { select: COMMUNITY_SELECT },
        _count: { select: { tournaments: true, orders: true } },
      },
    });
  }

  async update(eventId: string, userId: string, input: UpdateEventInput) {
    const existing = await this.access.requireEventManager(eventId, userId);
    if (
      input.communityId !== undefined &&
      input.communityId !== existing.communityId &&
      input.communityId
    ) {
      const ok = await this.access.hasCommunityRole(
        input.communityId,
        userId,
        'COLLABORATOR',
      );
      if (!ok) {
        throw new ForbiddenException(
          'You need collaborator access in that community',
        );
      }
    }
    const startAt = input.startAt !== undefined ? this.toDate(input.startAt) : existing.startAt;
    const endAt = input.endAt !== undefined ? this.toDate(input.endAt) : existing.endAt;
    if (startAt && endAt && endAt < startAt) {
      throw new BadRequestException('End date must be after start date');
    }

    const data: Prisma.EventUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined && input.slug !== existing.slug) {
      data.slug = await this.uniqueEventSlug(input.slug, eventId);
    }
    if (input.description !== undefined) data.description = input.description;
    if (input.startAt !== undefined) data.startAt = this.toDate(input.startAt);
    if (input.endAt !== undefined) data.endAt = this.toDate(input.endAt);
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.venueType !== undefined) data.venueType = input.venueType;
    if (input.venueName !== undefined) data.venueName = input.venueName;
    if (input.venueAddress !== undefined) data.venueAddress = input.venueAddress;
    if (input.venueUrl !== undefined) data.venueUrl = input.venueUrl;
    if (input.streamUrl !== undefined) data.streamUrl = input.streamUrl;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
    if (input.bannerUrl !== undefined) data.bannerUrl = input.bannerUrl;
    if (input.isPublic !== undefined) data.isPublic = input.isPublic;
    if (input.communityId !== undefined) {
      data.community = input.communityId
        ? { connect: { id: input.communityId } }
        : { disconnect: true };
    }

    return this.prisma.event.update({
      where: { id: eventId },
      data,
      include: {
        community: { select: COMMUNITY_SELECT },
        _count: { select: { tournaments: true, orders: true } },
      },
    });
  }

  async remove(eventId: string, userId: string) {
    await this.requireOwner(eventId, userId);
    await this.prisma.tournament.updateMany({
      where: { eventId },
      data: { eventId: null },
    });
    await this.prisma.event.delete({ where: { id: eventId } });
    return { ok: true };
  }

  async setPublished(eventId: string, userId: string, isPublished: boolean) {
    await this.access.requireEventManager(eventId, userId);
    return this.prisma.event.update({
      where: { id: eventId },
      data: { isPublished },
      include: {
        community: { select: COMMUNITY_SELECT },
        _count: { select: { tournaments: true, orders: true } },
      },
    });
  }

  async getById(eventId: string, userId: string) {
    const e = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        community: { select: COMMUNITY_SELECT },
        _count: { select: { tournaments: true, orders: true, tickets: true } },
      },
    });
    if (!e) throw new NotFoundException('Event not found');
    const canManage = await this.access.canManageEvent(eventId, userId);
    if (!canManage && (!e.isPublished || !e.isPublic)) {
      throw new NotFoundException('Event not found');
    }
    return { ...e, canManage };
  }

  // -------------------------------------------------------------------------
  // Listing
  // -------------------------------------------------------------------------

  async listPublic(query: ListEventsQuery) {
    const upcoming = query.upcoming === '1' || query.upcoming === 'true';
    const now = new Date();
    const and: Prisma.EventWhereInput[] = [];
    if (query.q) {
      and.push({
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
          { venueName: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }
    if (upcoming) {
      and.push({
        OR: [
          { endAt: { gte: now } },
          { endAt: null, startAt: { gte: now } },
          { endAt: null, startAt: null },
        ],
      });
    }
    const where: Prisma.EventWhereInput = {
      isPublished: true,
      isPublic: true,
      ...(query.communityId ? { communityId: query.communityId } : {}),
      ...(and.length ? { AND: and } : {}),
    };

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: upcoming
          ? [{ startAt: 'asc' }, { createdAt: 'desc' }]
          : [{ startAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: query.pageSize,
        include: {
          community: { select: COMMUNITY_SELECT },
          _count: { select: { tournaments: true } },
        },
      }),
      this.prisma.event.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async listMine(userId: string) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId, role: { in: ['OWNER', 'ADMIN', 'COLLABORATOR'] } },
      select: { communityId: true },
    });
    const ownedCommunities = await this.prisma.community.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const communityIds = Array.from(
      new Set([
        ...memberships.map((m) => m.communityId),
        ...ownedCommunities.map((c) => c.id),
      ]),
    );
    return this.prisma.event.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { admins: { some: { userId } } },
          ...(communityIds.length ? [{ communityId: { in: communityIds } }] : []),
        ],
      },
      orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        community: { select: COMMUNITY_SELECT },
        _count: { select: { tournaments: true, orders: true, tickets: true } },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Public event page
  // -------------------------------------------------------------------------

  async getBySlug(slug: string, userId: string | null | undefined) {
    const e = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        community: { select: COMMUNITY_SELECT },
        owner: { select: { id: true, name: true } },
        tournaments: {
          select: EVENT_TOURNAMENT_SELECT,
          orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
        },
        tickets: {
          where: { isActive: true },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
        _count: { select: { tournaments: true } },
      },
    });
    if (!e) throw new NotFoundException('Event not found');
    const canManage = await this.access.canManageEvent(e.id, userId);
    if (!canManage && !e.isPublished) {
      throw new NotFoundException('Event not found');
    }

    const soldRows = await this.prisma.eventOrder.groupBy({
      by: ['ticketId'],
      where: { eventId: e.id, status: 'PAID' },
      _sum: { quantity: true },
    });
    const soldByTicket = new Map(
      soldRows.map((r) => [r.ticketId, r._sum.quantity ?? 0]),
    );
    const tickets = e.tickets.map((t) => {
      const sold = soldByTicket.get(t.id) ?? 0;
      return {
        ...t,
        sold,
        remaining: t.quantity == null ? null : Math.max(0, t.quantity - sold),
      };
    });

    const tournaments = canManage
      ? e.tournaments
      : e.tournaments.filter((t) => t.isPublic);

    return {
      ...e,
      tournaments,
      tickets,
      canManage,
      streamEmbedUrl: toStreamEmbedUrl(e.streamUrl, {
        parentHost: this.parentHost(),
      }),
    };
  }

  // -------------------------------------------------------------------------
  // Admins
  // -------------------------------------------------------------------------

  async listAdmins(eventId: string, userId: string) {
    const e = await this.access.requireEventManager(eventId, userId);
    const admins = await this.prisma.eventAdmin.findMany({
      where: { eventId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const owner = await this.prisma.user.findUnique({
      where: { id: e.ownerId },
      select: { id: true, email: true, name: true },
    });
    return { owner, admins };
  }

  async addAdmin(eventId: string, userId: string, email: string) {
    await this.access.requireEventManager(eventId, userId);
    const target = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!target) {
      throw new BadRequestException(
        'User not found — they must register first',
      );
    }
    const e = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { ownerId: true },
    });
    if (e?.ownerId === target.id) {
      throw new BadRequestException('That user already owns this event');
    }
    return this.prisma.eventAdmin.upsert({
      where: { eventId_userId: { eventId, userId: target.id } },
      create: { eventId, userId: target.id, role: 'ADMIN' },
      update: {},
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async removeAdmin(eventId: string, userId: string, adminId: string) {
    await this.access.requireEventManager(eventId, userId);
    const admin = await this.prisma.eventAdmin.findFirst({
      where: { id: adminId, eventId },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    await this.prisma.eventAdmin.delete({ where: { id: adminId } });
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Tournaments
  // -------------------------------------------------------------------------

  async listTournaments(eventId: string, userId: string) {
    await this.access.requireEventManager(eventId, userId);
    return this.prisma.tournament.findMany({
      where: { eventId },
      select: EVENT_TOURNAMENT_SELECT,
      orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async attachTournament(eventId: string, userId: string, tournamentId: string) {
    const e = await this.access.requireEventManager(eventId, userId);
    const t = await this.access.requireTournamentManager(tournamentId, userId);
    if (t.eventId && t.eventId !== eventId) {
      throw new BadRequestException(
        'Tournament is already attached to another event',
      );
    }
    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        eventId,
        ...(e.communityId && !t.communityId
          ? { communityId: e.communityId }
          : {}),
      },
      select: EVENT_TOURNAMENT_SELECT,
    });
  }

  async detachTournament(eventId: string, userId: string, tournamentId: string) {
    await this.access.requireEventManager(eventId, userId);
    const t = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, eventId },
      select: { id: true },
    });
    if (!t) throw new NotFoundException('Tournament is not part of this event');
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { eventId: null },
    });
    return { ok: true };
  }

  async quickCreateTournament(
    eventId: string,
    userId: string,
    input: EventQuickTournamentInput,
  ) {
    const e = await this.access.requireEventManager(eventId, userId);
    const slug = await this.uniqueTournamentSlug(this.toSlug(input.name));
    return this.prisma.tournament.create({
      data: {
        name: input.name,
        slug,
        format: input.format ?? 'SINGLE_ELIMINATION',
        gameId: input.gameId ?? null,
        startAt: this.toDate(input.startAt) ?? e.startAt ?? null,
        isPublic: input.isPublic ?? true,
        timezone: e.timezone,
        venueType: e.venueType,
        venueName: e.venueName,
        venueAddress: e.venueAddress,
        venueUrl: e.venueUrl,
        eventId,
        communityId: e.communityId,
        createdById: userId,
      },
      select: EVENT_TOURNAMENT_SELECT,
    });
  }

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------

  async dashboard(eventId: string, userId: string) {
    const e = await this.access.requireEventManager(eventId, userId);
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [tournaments, paidOrders, orderCounts, checkedIn, upcomingMatches, tickets] =
      await Promise.all([
        this.prisma.tournament.findMany({
          where: { eventId },
          select: { status: true },
        }),
        this.prisma.eventOrder.findMany({
          where: { eventId, status: 'PAID' },
          select: { quantity: true, amountCents: true, currency: true },
        }),
        this.prisma.eventOrder.groupBy({
          by: ['status'],
          where: { eventId },
          _count: { _all: true },
        }),
        this.prisma.eventOrder.count({
          where: { eventId, status: 'PAID', checkedInAt: { not: null } },
        }),
        this.prisma.match.findMany({
          where: {
            tournament: { eventId },
            status: { in: ['PENDING', 'READY'] },
            scheduledAt: { gte: now, lte: in24h },
          },
          orderBy: { scheduledAt: 'asc' },
          take: 20,
          select: {
            id: true,
            round: true,
            scheduledAt: true,
            status: true,
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            tournament: { select: { id: true, slug: true, name: true } },
          },
        }),
        this.prisma.eventTicket.count({ where: { eventId } }),
      ]);

    const tournamentsByStatus = { upcoming: 0, in_progress: 0, completed: 0 };
    for (const t of tournaments) {
      tournamentsByStatus[bucketTournamentStatus(t.status)] += 1;
    }

    const revenueByCurrency: Record<string, number> = {};
    let ticketsSold = 0;
    for (const o of paidOrders) {
      ticketsSold += o.quantity;
      revenueByCurrency[o.currency] =
        (revenueByCurrency[o.currency] ?? 0) + o.amountCents;
    }

    const ordersByStatus: Record<string, number> = {};
    for (const row of orderCounts) {
      ordersByStatus[row.status] = row._count._all;
    }

    return {
      event: {
        id: e.id,
        slug: e.slug,
        name: e.name,
        isPublished: e.isPublished,
        isPublic: e.isPublic,
        startAt: e.startAt,
        endAt: e.endAt,
        timezone: e.timezone,
      },
      tournaments: { total: tournaments.length, ...tournamentsByStatus },
      tickets: { types: tickets, sold: ticketsSold },
      orders: {
        total: orderCounts.reduce((acc, r) => acc + r._count._all, 0),
        byStatus: ordersByStatus,
      },
      revenueByCurrency,
      checkIn: {
        paidOrders: paidOrders.length,
        checkedIn,
        remaining: Math.max(0, paidOrders.length - checkedIn),
      },
      upcomingMatches,
    };
  }
}
