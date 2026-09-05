import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunityRole, Prisma } from '@prisma/client';
import {
  slugifyCommunityName,
  type AddCommunityMemberInput,
  type CommunityAnnouncementInput,
  type CommunityListQuery,
  type CreateCommunityInput,
  type UpdateCommunityInput,
  type UpdateCommunityMemberInput,
} from '@bracket/shared';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';

const publicUserSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  bio: true,
  countryCode: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const gameSelect = { id: true, name: true, category: true } satisfies Prisma.GameSelect;

const communityCountSelect = {
  members: true,
  followers: true,
  tournaments: true,
  events: true,
} satisfies Prisma.CommunityCountOutputTypeSelect;

const tournamentCardSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  format: true,
  startAt: true,
  isPublic: true,
  logoUrl: true,
  createdAt: true,
  completedAt: true,
  game: { select: { id: true, name: true } },
  _count: { select: { teams: true, matches: true } },
} satisfies Prisma.TournamentSelect;

const EMAIL_RECIPIENT_CAP = 500;

type CommunityWithGames = Prisma.CommunityGetPayload<{
  include: { games: { include: { game: { select: typeof gameSelect } } } };
}>;

function flattenGames<T extends { games: { game: { id: string; name: string; category: string } }[] }>(
  c: T,
) {
  const { games, ...rest } = c;
  return { ...rest, games: games.map((g) => g.game) };
}

function socialsOf(value: Prisma.JsonValue): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string' && v.trim()) out[k] = v;
  }
  return out;
}

@Injectable()
export class CommunitiesService {
  private readonly logger = new Logger(CommunitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async requireCommunity(id: string) {
    const c = await this.prisma.community.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Community not found');
    return c;
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = slugifyCommunityName(base) || 'community';
    let candidate = root;
    for (let i = 2; i < 200; i++) {
      const existing = await this.prisma.community.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${root}-${i}`;
    }
    return `${root}-${Date.now().toString(36)}`;
  }

  async slugAvailable(slug: string, excludeId?: string) {
    const normalized = slugifyCommunityName(slug);
    if (!normalized) return { slug: normalized, available: false, suggestion: null };
    const existing = await this.prisma.community.findUnique({
      where: { slug: normalized },
      select: { id: true },
    });
    const available = !existing || existing.id === excludeId;
    return {
      slug: normalized,
      available,
      suggestion: available ? null : await this.uniqueSlug(normalized, excludeId),
    };
  }

  private serialize(c: CommunityWithGames) {
    return { ...flattenGames(c), socials: socialsOf(c.socials) };
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async create(userId: string, input: CreateCommunityInput) {
    const slug = input.slug
      ? slugifyCommunityName(input.slug)
      : await this.uniqueSlug(input.name);
    if (!slug) throw new BadRequestException('Invalid slug');
    const taken = await this.prisma.community.findUnique({ where: { slug } });
    if (taken) throw new ConflictException('That URL is already taken');

    const community = await this.prisma.community.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        audience: input.audience ?? [],
        location: input.location ?? null,
        countryCode: input.countryCode ?? null,
        websiteUrl: input.websiteUrl ?? null,
        socials: input.socials ?? {},
        logoUrl: input.logoUrl ?? null,
        bannerUrl: input.bannerUrl ?? null,
        isPublic: input.isPublic ?? true,
        ownerId: userId,
        members: { create: { userId, role: 'OWNER' } },
      },
      include: { games: { include: { game: { select: gameSelect } } } },
    });
    return { ...this.serialize(community), viewerRole: 'OWNER' as CommunityRole };
  }

  async update(id: string, userId: string, input: UpdateCommunityInput) {
    await this.access.requireCommunityRole(id, userId, 'ADMIN');
    let slug: string | undefined;
    if (input.slug !== undefined) {
      slug = slugifyCommunityName(input.slug);
      if (!slug) throw new BadRequestException('Invalid slug');
      const taken = await this.prisma.community.findFirst({
        where: { slug, NOT: { id } },
        select: { id: true },
      });
      if (taken) throw new ConflictException('That URL is already taken');
    }
    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        description: input.description,
        audience: input.audience,
        location: input.location,
        countryCode: input.countryCode,
        websiteUrl: input.websiteUrl,
        socials: input.socials,
        logoUrl: input.logoUrl,
        bannerUrl: input.bannerUrl,
        isPublic: input.isPublic,
      },
      include: { games: { include: { game: { select: gameSelect } } } },
    });
    return this.serialize(updated);
  }

  async remove(id: string, userId: string) {
    const c = await this.requireCommunity(id);
    if (c.ownerId !== userId && !(await this.access.isSiteAdmin(userId))) {
      throw new ForbiddenException('Only the owner can delete a community');
    }
    await this.prisma.community.delete({ where: { id } });
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Discovery
  // -------------------------------------------------------------------------

  async list(query: CommunityListQuery) {
    const where: Prisma.CommunityWhereInput = { isPublic: true };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { location: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.game) where.games = { some: { gameId: query.game } };
    if (query.country) where.countryCode = query.country;

    const orderBy: Prisma.CommunityOrderByWithRelationInput[] =
      query.sort === 'newest'
        ? [{ createdAt: 'desc' }]
        : query.sort === 'active'
          ? [{ tournaments: { _count: 'desc' } }, { updatedAt: 'desc' }]
          : [{ followers: { _count: 'desc' } }, { members: { _count: 'desc' } }, { createdAt: 'desc' }];

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.community.count({ where }),
      this.prisma.community.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          games: { include: { game: { select: gameSelect } } },
          _count: { select: communityCountSelect },
        },
      }),
    ]);

    return {
      items: rows.map((r) => this.serialize(r)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async mine(userId: string) {
    const [memberships, follows] = await Promise.all([
      this.prisma.communityMember.findMany({
        where: { userId },
        include: {
          community: {
            include: {
              games: { include: { game: { select: gameSelect } } },
              _count: { select: communityCountSelect },
            },
          },
        },
      }),
      this.prisma.communityFollow.findMany({
        where: { userId },
        include: {
          community: {
            include: {
              games: { include: { game: { select: gameSelect } } },
              _count: { select: communityCountSelect },
            },
          },
        },
      }),
    ]);
    // Owners without a membership row (defensive) still show up.
    const owned = await this.prisma.community.findMany({
      where: { ownerId: userId, members: { none: { userId } } },
      include: {
        games: { include: { game: { select: gameSelect } } },
        _count: { select: communityCountSelect },
      },
    });

    const byId = new Map<
      string,
      ReturnType<CommunitiesService['serialize']> & {
        _count: Record<keyof typeof communityCountSelect, number>;
        viewerRole: CommunityRole | null;
        isFollowing: boolean;
      }
    >();
    for (const m of memberships) {
      const role: CommunityRole = m.community.ownerId === userId ? 'OWNER' : m.role;
      byId.set(m.communityId, {
        ...this.serialize(m.community),
        _count: m.community._count,
        viewerRole: role,
        isFollowing: false,
      });
    }
    for (const c of owned) {
      byId.set(c.id, {
        ...this.serialize(c),
        _count: c._count,
        viewerRole: 'OWNER',
        isFollowing: false,
      });
    }
    for (const f of follows) {
      const existing = byId.get(f.communityId);
      if (existing) {
        existing.isFollowing = true;
      } else {
        byId.set(f.communityId, {
          ...this.serialize(f.community),
          _count: f.community._count,
          viewerRole: null,
          isFollowing: true,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  // -------------------------------------------------------------------------
  // Public page
  // -------------------------------------------------------------------------

  async getBySlug(slug: string, viewerId: string | null) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
      include: {
        owner: { select: publicUserSelect },
        games: { include: { game: { select: gameSelect } } },
        _count: { select: communityCountSelect },
      },
    });
    if (!community) throw new NotFoundException('Community not found');

    const viewerRole = await this.access.communityRole(community.id, viewerId);
    if (!community.isPublic && !viewerRole) {
      const isAdmin = viewerId ? await this.access.isSiteAdmin(viewerId) : false;
      if (!isAdmin) throw new ForbiddenException('This community is private');
    }

    const now = new Date();
    const [isFollowing, announcements, tournaments, events, rankings, templates] =
      await Promise.all([
        viewerId
          ? this.prisma.communityFollow
              .findUnique({
                where: { communityId_userId: { communityId: community.id, userId: viewerId } },
                select: { id: true },
              })
              .then((r) => !!r)
          : Promise.resolve(false),
        this.prisma.communityAnnouncement.findMany({
          where: { communityId: community.id },
          orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
          take: 10,
          include: { author: { select: publicUserSelect } },
        }),
        this.prisma.tournament.findMany({
          where: {
            communityId: community.id,
            ...(viewerRole ? {} : { isPublic: true }),
          },
          orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
          select: tournamentCardSelect,
        }),
        this.prisma.event.findMany({
          where: {
            communityId: community.id,
            isPublished: true,
            ...(viewerRole ? {} : { isPublic: true }),
            OR: [{ endAt: null }, { endAt: { gte: now } }],
          },
          orderBy: [{ startAt: 'asc' }],
          take: 20,
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            logoUrl: true,
            bannerUrl: true,
            startAt: true,
            endAt: true,
            timezone: true,
            venueType: true,
            venueName: true,
            isPublished: true,
            isPublic: true,
            ownerId: true,
            communityId: true,
            createdAt: true,
            _count: { select: { tournaments: true } },
          },
        }),
        this.prisma.ranking.findMany({
          where: { communityId: community.id, isActive: true },
          orderBy: { createdAt: 'desc' },
          include: {
            game: { select: { id: true, name: true } },
            _count: { select: { entries: true, tournaments: true } },
          },
        }),
        viewerRole
          ? this.prisma.tournamentTemplate.findMany({
              where: { communityId: community.id },
              orderBy: { updatedAt: 'desc' },
              include: { owner: { select: publicUserSelect } },
            })
          : Promise.resolve([]),
      ]);

    const upcoming = tournaments
      .filter((t) => t.status === 'DRAFT')
      .sort((a, b) => {
        const at = a.startAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bt = b.startAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return at - bt;
      });
    const inProgress = tournaments.filter((t) => t.status === 'ACTIVE');
    const completed = tournaments
      .filter((t) => t.status === 'COMPLETED')
      .sort(
        (a, b) =>
          (b.completedAt ?? b.createdAt).getTime() - (a.completedAt ?? a.createdAt).getTime(),
      );

    const { owner, ...rest } = community;
    return {
      community: this.serialize(rest),
      owner,
      games: rest.games.map((g) => g.game),
      viewerRole,
      isFollowing,
      _count: community._count,
      announcements,
      tournaments: { upcoming, inProgress, completed },
      events,
      rankings,
      templates,
    };
  }

  // -------------------------------------------------------------------------
  // Members
  // -------------------------------------------------------------------------

  async listMembers(id: string, viewerId: string | null) {
    const community = await this.requireCommunity(id);
    const role = await this.access.communityRole(id, viewerId);
    if (!community.isPublic && !role) throw new ForbiddenException('Private community');
    const canSeeEmail = await this.access.hasCommunityRole(id, viewerId, 'ADMIN');
    const members = await this.prisma.communityMember.findMany({
      where: { communityId: id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { ...publicUserSelect, email: canSeeEmail } } },
    });
    // Owner always shown first with OWNER role, even if membership row is stale.
    return members
      .map((m) => ({
        ...m,
        role: m.userId === community.ownerId ? ('OWNER' as CommunityRole) : m.role,
      }))
      .sort((a, b) => {
        const rank: Record<CommunityRole, number> = { OWNER: 0, ADMIN: 1, COLLABORATOR: 2, AFFILIATE: 3 };
        return rank[a.role] - rank[b.role];
      });
  }

  async addMember(id: string, actorId: string, input: AddCommunityMemberInput) {
    const community = await this.access.requireCommunityRole(id, actorId, 'ADMIN');
    const target = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!target) {
      throw new BadRequestException('No account with that email — they must register first');
    }
    if (target.id === community.ownerId) {
      throw new BadRequestException('That user already owns this community');
    }
    return this.prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: id, userId: target.id } },
      create: { communityId: id, userId: target.id, role: input.role },
      update: { role: input.role },
      include: { user: { select: { ...publicUserSelect, email: true } } },
    });
  }

  async updateMember(
    id: string,
    memberId: string,
    actorId: string,
    input: UpdateCommunityMemberInput,
  ) {
    const community = await this.access.requireCommunityRole(id, actorId, 'ADMIN');
    const member = await this.prisma.communityMember.findFirst({
      where: { id: memberId, communityId: id },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.userId === community.ownerId || member.role === 'OWNER') {
      throw new BadRequestException('Transfer ownership to change the owner');
    }
    return this.prisma.communityMember.update({
      where: { id: memberId },
      data: { role: input.role },
      include: { user: { select: { ...publicUserSelect, email: true } } },
    });
  }

  async removeMember(id: string, memberId: string, actorId: string) {
    const community = await this.requireCommunity(id);
    const member = await this.prisma.communityMember.findFirst({
      where: { id: memberId, communityId: id },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.userId === community.ownerId) {
      throw new BadRequestException('The owner cannot be removed');
    }
    const isSelf = member.userId === actorId;
    if (!isSelf && !(await this.access.hasCommunityRole(id, actorId, 'ADMIN'))) {
      throw new ForbiddenException('Insufficient community permissions');
    }
    await this.prisma.communityMember.delete({ where: { id: memberId } });
    return { ok: true };
  }

  async transferOwnership(id: string, actorId: string, newOwnerId: string) {
    const community = await this.requireCommunity(id);
    if (community.ownerId !== actorId && !(await this.access.isSiteAdmin(actorId))) {
      throw new ForbiddenException('Only the owner can transfer ownership');
    }
    if (newOwnerId === community.ownerId) return this.serializeById(id);
    const target = await this.prisma.user.findUnique({ where: { id: newOwnerId } });
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.$transaction([
      this.prisma.community.update({ where: { id }, data: { ownerId: newOwnerId } }),
      this.prisma.communityMember.upsert({
        where: { communityId_userId: { communityId: id, userId: newOwnerId } },
        create: { communityId: id, userId: newOwnerId, role: 'OWNER' },
        update: { role: 'OWNER' },
      }),
      this.prisma.communityMember.upsert({
        where: { communityId_userId: { communityId: id, userId: community.ownerId } },
        create: { communityId: id, userId: community.ownerId, role: 'ADMIN' },
        update: { role: 'ADMIN' },
      }),
    ]);
    return this.serializeById(id);
  }

  private async serializeById(id: string) {
    const c = await this.prisma.community.findUnique({
      where: { id },
      include: { games: { include: { game: { select: gameSelect } } } },
    });
    if (!c) throw new NotFoundException('Community not found');
    return this.serialize(c);
  }

  // -------------------------------------------------------------------------
  // Follow
  // -------------------------------------------------------------------------

  async follow(id: string, userId: string) {
    const community = await this.requireCommunity(id);
    if (!community.isPublic && !(await this.access.communityRole(id, userId))) {
      throw new ForbiddenException('Private community');
    }
    await this.prisma.communityFollow.upsert({
      where: { communityId_userId: { communityId: id, userId } },
      create: { communityId: id, userId },
      update: {},
    });
    const followers = await this.prisma.communityFollow.count({ where: { communityId: id } });
    return { ok: true, isFollowing: true, followers };
  }

  async unfollow(id: string, userId: string) {
    await this.requireCommunity(id);
    await this.prisma.communityFollow.deleteMany({ where: { communityId: id, userId } });
    const followers = await this.prisma.communityFollow.count({ where: { communityId: id } });
    return { ok: true, isFollowing: false, followers };
  }

  async listFollowers(id: string, actorId: string) {
    await this.access.requireCommunityRole(id, actorId, 'ADMIN');
    return this.prisma.communityFollow.findMany({
      where: { communityId: id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { ...publicUserSelect, email: true } } },
    });
  }

  // -------------------------------------------------------------------------
  // Games
  // -------------------------------------------------------------------------

  async setGames(id: string, actorId: string, gameIds: string[]) {
    await this.access.requireCommunityRole(id, actorId, 'ADMIN');
    const unique = [...new Set(gameIds)];
    const games = await this.prisma.game.findMany({
      where: { id: { in: unique } },
      select: gameSelect,
    });
    await this.prisma.$transaction([
      this.prisma.communityGame.deleteMany({
        where: { communityId: id, gameId: { notIn: games.map((g) => g.id) } },
      }),
      ...games.map((g) =>
        this.prisma.communityGame.upsert({
          where: { communityId_gameId: { communityId: id, gameId: g.id } },
          create: { communityId: id, gameId: g.id },
          update: {},
        }),
      ),
    ]);
    return games;
  }

  // -------------------------------------------------------------------------
  // Announcements
  // -------------------------------------------------------------------------

  async listAnnouncements(id: string, viewerId: string | null) {
    const community = await this.requireCommunity(id);
    if (!community.isPublic && !(await this.access.communityRole(id, viewerId))) {
      throw new ForbiddenException('Private community');
    }
    return this.prisma.communityAnnouncement.findMany({
      where: { communityId: id },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: { author: { select: publicUserSelect } },
    });
  }

  async createAnnouncement(id: string, actorId: string, input: CommunityAnnouncementInput) {
    const community = await this.access.requireCommunityRole(id, actorId, 'COLLABORATOR');
    const announcement = await this.prisma.communityAnnouncement.create({
      data: {
        communityId: id,
        authorId: actorId,
        title: input.title,
        body: input.body,
        pinned: input.pinned ?? false,
      },
      include: { author: { select: publicUserSelect } },
    });
    void this.fanOutAnnouncement(community, announcement).catch((err) =>
      this.logger.warn(`Announcement fan-out failed: ${(err as Error).message}`),
    );
    return announcement;
  }

  async updateAnnouncement(
    id: string,
    announcementId: string,
    actorId: string,
    input: Partial<CommunityAnnouncementInput>,
  ) {
    await this.access.requireCommunityRole(id, actorId, 'COLLABORATOR');
    const existing = await this.prisma.communityAnnouncement.findFirst({
      where: { id: announcementId, communityId: id },
    });
    if (!existing) throw new NotFoundException('Announcement not found');
    return this.prisma.communityAnnouncement.update({
      where: { id: announcementId },
      data: { title: input.title, body: input.body, pinned: input.pinned },
      include: { author: { select: publicUserSelect } },
    });
  }

  async deleteAnnouncement(id: string, announcementId: string, actorId: string) {
    await this.access.requireCommunityRole(id, actorId, 'COLLABORATOR');
    await this.prisma.communityAnnouncement.deleteMany({
      where: { id: announcementId, communityId: id },
    });
    return { ok: true };
  }

  private async fanOutAnnouncement(
    community: { id: string; slug: string; name: string; ownerId: string },
    announcement: { id: string; title: string; body: string; authorId: string },
  ) {
    const [members, followers] = await Promise.all([
      this.prisma.communityMember.findMany({
        where: { communityId: community.id },
        select: { userId: true },
      }),
      this.prisma.communityFollow.findMany({
        where: { communityId: community.id },
        select: { userId: true, user: { select: { email: true } } },
      }),
    ]);
    const recipientIds = new Set<string>([
      community.ownerId,
      ...members.map((m) => m.userId),
      ...followers.map((f) => f.userId),
    ]);
    recipientIds.delete(announcement.authorId);

    const excerpt =
      announcement.body.length > 200
        ? `${announcement.body.slice(0, 197).trimEnd()}…`
        : announcement.body;
    const href = `/c/${community.slug}`;

    if (recipientIds.size > 0) {
      await this.prisma.notification.createMany({
        data: [...recipientIds].map((userId) => ({
          userId,
          type: 'community_announcement',
          title: `${community.name}: ${announcement.title}`,
          body: excerpt,
          href,
        })),
      });
    }

    const emails = followers
      .filter((f) => f.userId !== announcement.authorId)
      .map((f) => f.user.email)
      .filter((e): e is string => !!e)
      .slice(0, EMAIL_RECIPIENT_CAP);
    const subject = `[${community.name}] ${announcement.title}`;
    const html = `<p><strong>${escapeHtml(community.name)}</strong> posted a new announcement:</p><h2>${escapeHtml(announcement.title)}</h2><p>${escapeHtml(announcement.body).replace(/\n/g, '<br/>')}</p>`;
    for (const to of emails) {
      void this.sendEmail(to, subject, html);
    }
  }

  private async sendEmail(to: string, subject: string, html: string) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM') ?? 'Bracket <onboarding@resend.dev>';
    if (!apiKey) {
      this.logger.log(`Email (dry-run) to ${to}: ${subject}`);
      return;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (!res.ok) this.logger.warn(`Resend email failed (${res.status}) for ${to}`);
    } catch (err) {
      this.logger.warn(`Resend error: ${(err as Error).message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Tournaments
  // -------------------------------------------------------------------------

  async listTournaments(id: string, viewerId: string | null, status?: string) {
    const community = await this.requireCommunity(id);
    const role = await this.access.communityRole(id, viewerId);
    if (!community.isPublic && !role) throw new ForbiddenException('Private community');
    const statusFilter =
      status === 'upcoming'
        ? 'DRAFT'
        : status === 'inProgress'
          ? 'ACTIVE'
          : status === 'completed'
            ? 'COMPLETED'
            : undefined;
    return this.prisma.tournament.findMany({
      where: {
        communityId: id,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(role ? {} : { isPublic: true }),
      },
      orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
      select: tournamentCardSelect,
    });
  }

  async attachTournament(id: string, tournamentId: string, actorId: string) {
    await this.access.requireCommunityRole(id, actorId, 'AFFILIATE');
    const canManage = await this.access.canManageTournament(tournamentId, actorId);
    if (!canManage) throw new ForbiddenException('You cannot manage this tournament');
    const t = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) throw new NotFoundException('Tournament not found');
    if (t.communityId && t.communityId !== id) {
      throw new BadRequestException('Tournament already belongs to another community');
    }
    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { communityId: id },
      select: tournamentCardSelect,
    });
  }

  async detachTournament(id: string, tournamentId: string, actorId: string) {
    const t = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t || t.communityId !== id) throw new NotFoundException('Tournament not in community');
    const canManage = await this.access.canManageTournament(tournamentId, actorId);
    const isAffiliate = await this.access.hasCommunityRole(id, actorId, 'AFFILIATE');
    if (!canManage || !isAffiliate) {
      throw new ForbiddenException('You cannot manage this tournament');
    }
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { communityId: null, rankingId: null },
    });
    return { ok: true };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
