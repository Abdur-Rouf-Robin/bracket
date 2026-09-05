import { Injectable, OnModuleInit } from '@nestjs/common';
import { GAME_RULES, SUPPORTED_GAME_SEED_NAMES } from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';

const SEED_GAMES = GAME_RULES.map((g, i) => ({
  name: g.seedName,
  category: g.category,
  sortOrder: i + 1,
}));

@Injectable()
export class GamesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const existing = await this.prisma.game.findMany({
      select: { id: true, name: true, category: true, sortOrder: true, active: true },
    });
    const byName = new Map(existing.map((row) => [row.name, row]));
    const seedNames = new Set(SEED_GAMES.map((g) => g.name));
    const supported = new Set(SUPPORTED_GAME_SEED_NAMES);
    const writes: Promise<unknown>[] = [];

    for (const g of SEED_GAMES) {
      const row = byName.get(g.name);
      if (!row) {
        writes.push(this.prisma.game.create({ data: { ...g, active: true } }));
        continue;
      }
      if (
        row.category !== g.category ||
        row.sortOrder !== g.sortOrder ||
        !row.active
      ) {
        writes.push(
          this.prisma.game.update({
            where: { id: row.id },
            data: { category: g.category, sortOrder: g.sortOrder, active: true },
          }),
        );
      }
    }

    const legacy = existing.filter(
      (row) =>
        row.active &&
        !seedNames.has(row.name) &&
        !supported.has(row.name) &&
        /racket/i.test(row.name),
    );
    if (legacy.length > 0) {
      writes.push(
        this.prisma.game.updateMany({
          where: { id: { in: legacy.map((row) => row.id) } },
          data: { active: false },
        }),
      );
    }

    if (writes.length > 0) {
      await Promise.all(writes);
    }
  }

  list() {
    return this.prisma.game.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
}
