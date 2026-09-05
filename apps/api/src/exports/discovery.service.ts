import { Injectable } from '@nestjs/common';
import { Prisma, TournamentFormat, TournamentStatus } from '@prisma/client';
import {
  tournamentSettingsSchema,
  type SearchFacets,
  type SearchResultItem,
  type SearchStatus,
  type TournamentSearchQuery,
  type TournamentSearchResponse,
} from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';

const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  format: true,
  status: true,
  startAt: true,
  logoUrl: true,
  backgroundImageUrl: true,
  venueName: true,
  venueType: true,
  settings: true,
  createdAt: true,
  game: { select: { id: true, name: true, category: true, slug: true } },
  community: { select: { slug: true, name: true } },
  _count: { select: { teams: true, matches: true } },
} satisfies Prisma.TournamentSelect;

type CardRow = Prisma.TournamentGetPayload<{ select: typeof CARD_SELECT }>;

@Injectable()
export class DiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  private toItem(r: CardRow): SearchResultItem {
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      format: r.format,
      status: r.status,
      startAt: r.startAt ? r.startAt.toISOString() : null,
      game: r.game,
      logoUrl: r.logoUrl,
      backgroundImageUrl: r.backgroundImageUrl,
      _count: r._count,
      community: r.community,
      venueName: r.venueName,
      venueType: r.venueType,
      isLive: r.status === 'ACTIVE',
    };
  }

  private browsable(r: { settings: unknown }): boolean {
    try {
      return tournamentSettingsSchema.parse(r.settings ?? {}).browsableInIndex !== false;
    } catch {
      return true;
    }
  }

  private statusWhere(status: SearchStatus | undefined, now: Date): Prisma.TournamentWhereInput {
    switch (status) {
      case 'upcoming':
        return {
          status: { in: [TournamentStatus.DRAFT, TournamentStatus.ACTIVE] },
          startAt: { gt: now },
        };
      case 'live':
        return { status: TournamentStatus.ACTIVE };
      case 'completed':
        return { status: TournamentStatus.COMPLETED };
      default:
        return {};
    }
  }

  async search(q: TournamentSearchQuery): Promise<TournamentSearchResponse> {
    const now = new Date();
    const where: Prisma.TournamentWhereInput = {
      isPublic: true,
      AND: [this.statusWhere(q.status, now)],
    };
    const and = where.AND as Prisma.TournamentWhereInput[];

    if (q.q?.trim()) {
      const term = q.q.trim();
      and.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { game: { name: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }
    if (q.game) {
      and.push({
        game: {
          OR: [
            { id: q.game },
            { slug: q.game },
            { name: { equals: q.game, mode: 'insensitive' } },
          ],
        },
      });
    }
    if (q.format) {
      const key = q.format.toUpperCase().replaceAll('-', '_');
      const valid = (Object.values(TournamentFormat) as string[]).includes(key);
      if (valid) and.push({ format: key as TournamentFormat });
    }
    if (q.country) {
      and.push({
        OR: [
          { createdBy: { countryCode: { equals: q.country, mode: 'insensitive' } } },
          { venueAddress: { contains: q.country, mode: 'insensitive' } },
        ],
      });
    }
    if (q.community) {
      and.push({ community: { slug: q.community } });
    }

    const orderBy: Prisma.TournamentOrderByWithRelationInput[] =
      q.sort === 'newest'
        ? [{ createdAt: 'desc' }]
        : q.sort === 'popular'
          ? [{ teams: { _count: 'desc' } }, { createdAt: 'desc' }]
          : q.sort === 'name'
            ? [{ name: 'asc' }]
            : [{ startAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }];

    // Fetch a wider window because `browsableInIndex` lives in JSON settings.
    const rows = await this.prisma.tournament.findMany({
      where,
      orderBy,
      select: CARD_SELECT,
      take: 600,
    });
    const visible = rows.filter((r) => this.browsable(r));
    const total = visible.length;
    const start = (q.page - 1) * q.pageSize;
    const items = visible.slice(start, start + q.pageSize).map((r) => this.toItem(r));

    return {
      items,
      total,
      page: q.page,
      pageSize: q.pageSize,
      facets: this.facets(visible, now),
    };
  }

  private facets(rows: CardRow[], now: Date): SearchFacets {
    const games = new Map<string, { id: string; name: string; count: number }>();
    const formats = new Map<string, number>();
    const statuses: Record<SearchStatus, number> = { upcoming: 0, live: 0, completed: 0 };
    for (const r of rows) {
      if (r.game) {
        const g = games.get(r.game.id) ?? { id: r.game.id, name: r.game.name, count: 0 };
        g.count++;
        games.set(r.game.id, g);
      }
      if (r.format) formats.set(r.format, (formats.get(r.format) ?? 0) + 1);
      if (r.status === 'COMPLETED') statuses.completed++;
      else if (r.status === 'ACTIVE') statuses.live++;
      if (r.status !== 'COMPLETED' && r.startAt && r.startAt > now) statuses.upcoming++;
    }
    return {
      games: [...games.values()].sort((a, b) => b.count - a.count).slice(0, 30),
      formats: [...formats.entries()]
        .map(([format, count]) => ({ format, count }))
        .sort((a, b) => b.count - a.count),
      statuses: (Object.keys(statuses) as SearchStatus[]).map((status) => ({
        status,
        count: statuses[status],
      })),
    };
  }

  /** Top live/upcoming tournaments by participant count. */
  async featured(limit = 8): Promise<SearchResultItem[]> {
    const now = new Date();
    const rows = await this.prisma.tournament.findMany({
      where: {
        isPublic: true,
        OR: [
          { status: TournamentStatus.ACTIVE },
          { status: TournamentStatus.DRAFT, startAt: { gt: now } },
        ],
      },
      orderBy: [{ teams: { _count: 'desc' } }, { startAt: 'asc' }],
      select: CARD_SELECT,
      take: limit * 3,
    });
    return rows
      .filter((r) => this.browsable(r))
      .slice(0, limit)
      .map((r) => this.toItem(r));
  }

  /** Landing rails for /browse. */
  async landing() {
    const now = new Date();
    const [live, upcoming, completed] = await Promise.all([
      this.prisma.tournament.findMany({
        where: { isPublic: true, status: TournamentStatus.ACTIVE },
        orderBy: [{ teams: { _count: 'desc' } }, { updatedAt: 'desc' }],
        select: CARD_SELECT,
        take: 24,
      }),
      this.prisma.tournament.findMany({
        where: {
          isPublic: true,
          status: { in: [TournamentStatus.DRAFT, TournamentStatus.ACTIVE] },
          startAt: { gt: now },
        },
        orderBy: [{ startAt: 'asc' }],
        select: CARD_SELECT,
        take: 24,
      }),
      this.prisma.tournament.findMany({
        where: { isPublic: true, status: TournamentStatus.COMPLETED },
        orderBy: [{ completedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
        select: CARD_SELECT,
        take: 24,
      }),
    ]);
    const clean = (rows: CardRow[]) => rows.filter((r) => this.browsable(r)).slice(0, 12).map((r) => this.toItem(r));
    const all = [...live, ...upcoming, ...completed].filter((r) => this.browsable(r));
    return {
      live: clean(live),
      upcoming: clean(upcoming),
      completed: clean(completed),
      facets: this.facets(all, now),
    };
  }
}
