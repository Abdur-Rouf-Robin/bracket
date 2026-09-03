import { Injectable, OnModuleInit } from '@nestjs/common';
import { SUPPORTED_GAME_SEED_NAMES } from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';

const SEED_GAMES = [
  { name: 'PUBG', category: 'Esports', sortOrder: 1 },
  { name: 'PUBG Mobile', category: 'Esports', sortOrder: 2 },
  { name: 'Free Fire', category: 'Esports', sortOrder: 3 },
  { name: 'Valorant', category: 'Esports', sortOrder: 4 },
  { name: 'Call of Duty Mobile', category: 'Esports', sortOrder: 5 },
  { name: 'Counter-Strike 2', category: 'Esports', sortOrder: 6 },
  { name: 'Dota 2', category: 'Esports', sortOrder: 7 },
  { name: 'Mobile Legends', category: 'Esports', sortOrder: 8 },
  { name: 'League of Legends', category: 'Esports', sortOrder: 9 },
  { name: 'EA FC 26 / FIFA', category: 'Esports', sortOrder: 10 },
  { name: 'eFootball', category: 'Esports', sortOrder: 11 },
  { name: 'Clash of Clans', category: 'Esports', sortOrder: 12 },
  { name: 'Football / Soccer', category: 'Outdoor', sortOrder: 20 },
  { name: 'Cricket', category: 'Outdoor', sortOrder: 21 },
  { name: 'Badminton', category: 'Outdoor', sortOrder: 22 },
];

@Injectable()
export class GamesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Deactivate everything first so legacy rows (e.g. "Badminton Racket") are hidden.
    await this.prisma.game.updateMany({ data: { active: false } });

    for (const g of SEED_GAMES) {
      await this.prisma.game.upsert({
        where: { name: g.name },
        create: { ...g, active: true },
        update: { category: g.category, sortOrder: g.sortOrder, active: true },
      });
    }

    const supported = new Set(SUPPORTED_GAME_SEED_NAMES);
    const stale = await this.prisma.game.findMany({
      where: { active: true, name: { notIn: [...supported] } },
      select: { id: true, name: true },
    });
    if (stale.length > 0) {
      await this.prisma.game.updateMany({
        where: { id: { in: stale.map((g) => g.id) } },
        data: { active: false },
      });
    }
  }

  list() {
    return this.prisma.game.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
}
