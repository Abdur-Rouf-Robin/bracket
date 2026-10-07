import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  slugifyCommunityName,
  type AttachCircuitTournamentInput,
  type ClassifyCircuitTournamentInput,
  type CreateCircuitInput,
} from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

@Injectable()
export class CircuitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateCircuitInput) {
    const slug = await this.uniqueSlug(input.slug || slugifyCommunityName(input.name));
    return this.prisma.circuit.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
        communityId: input.communityId || null,
        isPublic: input.isPublic ?? true,
        points: input.points ?? DEFAULT_POINTS,
        ownerId: userId,
      },
    });
  }

  list() {
    return this.prisma.circuit.findMany({
      where: { isPublic: true },
      orderBy: { updatedAt: 'desc' },
      take: 48,
      include: { _count: { select: { tournaments: true } } },
    });
  }

  async getBySlug(
    slug: string,
    filter: { season?: string; region?: string; tier?: string } = {},
  ) {
    const circuit = await this.prisma.circuit.findUnique({
      where: { slug },
      include: {
        community: { select: { slug: true, name: true } },
        tournaments: {
          where: { isPublic: true },
          orderBy: { startAt: 'asc' },
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            format: true,
            startAt: true,
            circuitSeason: true,
            circuitRegion: true,
            circuitTier: true,
            standings: {
              where: { groupId: null },
              orderBy: { rank: 'asc' },
              select: { rank: true, points: true, team: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!circuit || !circuit.isPublic) throw new NotFoundException('Circuit not found');
    const labels = (key: 'circuitSeason' | 'circuitRegion' | 'circuitTier') =>
      [...new Set(circuit.tournaments.map((t) => t[key]).filter((v): v is string => !!v))].sort();
    const table = this.pointsTable(circuit.points, circuit.tournaments, filter);
    return {
      ...circuit,
      table,
      seasons: labels('circuitSeason'),
      regions: labels('circuitRegion'),
      tiers: labels('circuitTier'),
    };
  }

  async attach(circuitId: string, input: AttachCircuitTournamentInput, userId: string) {
    const circuit = await this.prisma.circuit.findUnique({ where: { id: circuitId } });
    if (!circuit) throw new NotFoundException('Circuit not found');
    if (circuit.ownerId !== userId) throw new ForbiddenException('Only the circuit owner can add tournaments');
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: input.tournamentId },
      select: { id: true, createdById: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (tournament.createdById !== userId) {
      throw new ForbiddenException('You can only add tournaments you own');
    }
    return this.prisma.tournament.update({
      where: { id: input.tournamentId },
      data: {
        circuitId,
        circuitSeason: input.season?.trim() || null,
        circuitRegion: input.region?.trim() || null,
        circuitTier: input.tier?.trim() || null,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        circuitId: true,
        circuitSeason: true,
        circuitRegion: true,
        circuitTier: true,
      },
    });
  }

  async classify(
    circuitId: string,
    tournamentId: string,
    input: ClassifyCircuitTournamentInput,
    userId: string,
  ) {
    const circuit = await this.prisma.circuit.findUnique({ where: { id: circuitId } });
    if (!circuit) throw new NotFoundException('Circuit not found');
    if (circuit.ownerId !== userId) throw new ForbiddenException('Only the circuit owner can classify tournaments');
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, circuitId },
      select: { id: true },
    });
    if (!tournament) throw new NotFoundException('That tournament is not on this circuit');
    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        ...(input.season !== undefined ? { circuitSeason: input.season?.trim() || null } : {}),
        ...(input.region !== undefined ? { circuitRegion: input.region?.trim() || null } : {}),
        ...(input.tier !== undefined ? { circuitTier: input.tier?.trim() || null } : {}),
      },
      select: {
        id: true,
        circuitSeason: true,
        circuitRegion: true,
        circuitTier: true,
      },
    });
  }

  private async uniqueSlug(base: string) {
    const root = base || 'circuit';
    for (let i = 0; i < 20; i++) {
      const slug = i === 0 ? root : `${root}-${i + 1}`;
      const taken = await this.prisma.circuit.findUnique({ where: { slug }, select: { id: true } });
      if (!taken) return slug;
    }
    throw new ConflictException('Could not reserve a URL for this circuit');
  }

  private pointsTable(
    raw: unknown,
    tournaments: {
      circuitSeason?: string | null;
      circuitRegion?: string | null;
      circuitTier?: string | null;
      standings: { rank: number; points: number; team: { name: string } }[];
    }[],
    filter: { season?: string; region?: string; tier?: string } = {},
  ) {
    const scale = Array.isArray(raw)
      ? raw.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : DEFAULT_POINTS;
    const points = scale.length ? scale : DEFAULT_POINTS;
    const season = filter.season?.trim();
    const region = filter.region?.trim();
    const tier = filter.tier?.trim();
    const totals = new Map<string, { name: string; points: number; events: number }>();
    for (const tournament of tournaments) {
      if (season && tournament.circuitSeason !== season) continue;
      if (region && tournament.circuitRegion !== region) continue;
      if (tier && tournament.circuitTier !== tier) continue;
      const rows = [...tournament.standings].sort((a, b) => a.rank - b.rank || b.points - a.points);
      rows.forEach((row, index) => {
        const award = points[row.rank > 0 ? row.rank - 1 : index] ?? 0;
        if (!award) return;
        const key = row.team.name.trim().toLowerCase();
        const current = totals.get(key) ?? { name: row.team.name.trim(), points: 0, events: 0 };
        current.points += award;
        current.events += 1;
        totals.set(key, current);
      });
    }
    return [...totals.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }
}
