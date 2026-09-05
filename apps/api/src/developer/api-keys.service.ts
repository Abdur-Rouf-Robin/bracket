import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { API_KEY_PREFIX, type ApiKeyScope, type CreateApiKeyInput } from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';

export type VerifiedApiKey = {
  id: string;
  userId: string;
  scopes: ApiKeyScope[];
};

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex');
}

const LAST_USED_THROTTLE_MS = 60_000;

@Injectable()
export class ApiKeysService {
  private readonly lastUsedWrites = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  /** Creates a key and returns the plaintext secret exactly once. */
  async create(userId: string, input: CreateApiKeyInput) {
    const prefix = randomBytes(4).toString('hex'); // 8 chars
    const secret = randomBytes(24).toString('base64url');
    const key = `${API_KEY_PREFIX}${prefix}_${secret}`;
    const row = await this.prisma.apiKey.create({
      data: {
        userId,
        name: input.name.trim(),
        keyPrefix: prefix,
        keyHash: sha256(key),
        scopes: input.scopes ?? ['read'],
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    return { ...row, secret: key };
  }

  async revoke(userId: string, id: string) {
    const row = await this.prisma.apiKey.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: row.revokedAt ?? new Date() },
    });
    return { ok: true };
  }

  /** Verify a raw key string; throws 401 when unknown or revoked. */
  async verify(rawKey: string): Promise<VerifiedApiKey> {
    const key = rawKey.trim();
    if (!key.startsWith(API_KEY_PREFIX) || key.length < 30) {
      throw new UnauthorizedException('Invalid API key');
    }
    const row = await this.prisma.apiKey.findUnique({
      where: { keyHash: sha256(key) },
      select: { id: true, userId: true, scopes: true, revokedAt: true, lastUsedAt: true },
    });
    if (!row || row.revokedAt) throw new UnauthorizedException('Invalid or revoked API key');
    this.touch(row.id);
    return {
      id: row.id,
      userId: row.userId,
      scopes: row.scopes.filter((s): s is ApiKeyScope => s === 'read' || s === 'write'),
    };
  }

  private touch(id: string) {
    const now = Date.now();
    const last = this.lastUsedWrites.get(id) ?? 0;
    if (now - last < LAST_USED_THROTTLE_MS) return;
    this.lastUsedWrites.set(id, now);
    void this.prisma.apiKey
      .update({ where: { id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }
}
