import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async check() {
    let db = false;
    let redis = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    try {
      const client = new Redis(
        this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        { maxRetriesPerRequest: 1, lazyConnect: true },
      );
      await client.connect();
      const pong = await client.ping();
      redis = pong === 'PONG';
      await client.quit();
    } catch {
      redis = false;
    }
    return {
      ok: db,
      service: 'bracket-api',
      db,
      redis,
      email: !!this.config.get<string>('RESEND_API_KEY'),
      appUrl: (this.config.get<string>('APP_URL') ?? '').replace(/\/$/, '') || null,
      backupLastAt: this.lastBackupAt(),
    };
  }

  private lastBackupAt(): string | null {
    const dir =
      this.config.get<string>('BRACKET_BACKUP_DIR') ??
      join(process.cwd(), '..', '..', 'backups');
    try {
      const raw = readFileSync(join(dir, '.last-ok'), 'utf8').trim();
      return raw || null;
    } catch {
      return null;
    }
  }
}
