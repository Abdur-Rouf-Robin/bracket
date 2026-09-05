import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type InboxNotifyPayload = {
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
};

/**
 * In-app notifications ("inbox"). Other modules import InboxModule and call
 * `notify` / `notifyMany` to drop a message into a user's inbox.
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(userId: string, payload: InboxNotifyPayload) {
    if (!userId) return null;
    try {
      return await this.prisma.notification.create({
        data: {
          userId,
          type: payload.type,
          title: payload.title.slice(0, 200),
          body: payload.body ?? null,
          href: payload.href ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`notify failed for ${userId}: ${(err as Error).message}`);
      return null;
    }
  }

  async notifyMany(userIds: string[], payload: InboxNotifyPayload) {
    const ids = [...new Set(userIds.filter((id): id is string => !!id))];
    if (!ids.length) return { count: 0 };
    try {
      return await this.prisma.notification.createMany({
        data: ids.map((userId) => ({
          userId,
          type: payload.type,
          title: payload.title.slice(0, 200),
          body: payload.body ?? null,
          href: payload.href ?? null,
        })),
      });
    } catch (err) {
      this.logger.warn(`notifyMany failed: ${(err as Error).message}`);
      return { count: 0 };
    }
  }

  async list(
    userId: string,
    opts: { unread?: boolean; limit?: number; cursor?: string | null } = {},
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const where = {
      userId,
      ...(opts.unread ? { readAt: null } : {}),
    };
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items,
      unreadCount,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    if (n.readAt) return n;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  async remove(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id } });
    return { ok: true };
  }
}
