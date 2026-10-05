import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { slugifyCommunityName, type CreateCircuitInput } from '@bracket/shared';
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

  async getBySlug(slug: string) {
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
    const table = this.pointsTable(circuit.points, circuit.tournaments);
    return { ...circuit, table };
  }

  async attach(circuitId: string, tournamentId: string, userId: string) {
    const circuit = await this.prisma.circuit.findUnique({ where: { id: circuitId } });
    if (!circuit) throw new NotFoundException('Circuit not found');
    if (circuit.ownerId !== userId) throw new ForbiddenException('Only the circuit owner can add tournaments');
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, createdById: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (tournament.createdById !== userId) {
      throw new ForbiddenException('You can only add tournaments you own');
    }
    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { circuitId },
      select: { id: true, slug: true, name: true, circuitId: true },
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
      standings: { rank: number; points: number; team: { name: string } }[];
    }[],
  ) {
    const scale = Array.isArray(raw)
      ? raw.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : DEFAULT_POINTS;
    const points = scale.length ? scale : DEFAULT_POINTS;
    const totals = new Map<string, { name: string; points: number; events: number }>();
    for (const tournament of tournaments) {
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
