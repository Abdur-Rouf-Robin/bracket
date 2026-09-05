import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  INBOX_PREF_DEFAULTS,
  type InboxEmailChannel,
  type InboxPreferences,
  type InboxPreferencesResponse,
  type UpdateInboxPreferencesInput,
} from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';

export type InboxNotifyPayload = {
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
};

const PREF_SELECT = {
  inApp: true,
  emailRegistration: true,
  emailMatchComments: true,
  emailMatchReady: true,
  emailFinalResults: true,
} as const;

/**
 * In-app notifications ("inbox"). Other modules import InboxModule and call
 * `notify` / `notifyMany` to drop a message into a user's inbox.
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  private toPrefs(row?: Partial<InboxPreferences> | null): InboxPreferences {
    return {
      inApp: row?.inApp ?? INBOX_PREF_DEFAULTS.inApp,
      emailRegistration: row?.emailRegistration ?? INBOX_PREF_DEFAULTS.emailRegistration,
      emailMatchComments: row?.emailMatchComments ?? INBOX_PREF_DEFAULTS.emailMatchComments,
      emailMatchReady: row?.emailMatchReady ?? INBOX_PREF_DEFAULTS.emailMatchReady,
      emailFinalResults: row?.emailFinalResults ?? INBOX_PREF_DEFAULTS.emailFinalResults,
    };
  }

  async getPreferences(userId: string): Promise<InboxPreferencesResponse> {
    const row = await this.prisma.notificationPreference.findUnique({
      where: { userId },
      select: PREF_SELECT,
    });
    return { persisted: true, ...this.toPrefs(row) };
  }

  async updatePreferences(
    userId: string,
    patch: UpdateInboxPreferencesInput,
  ): Promise<InboxPreferencesResponse> {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId },
      select: PREF_SELECT,
    });
    const next = this.toPrefs({ ...this.toPrefs(existing), ...patch });
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...next },
      update: next,
      select: PREF_SELECT,
    });
    return { persisted: true, ...this.toPrefs(row) };
  }

  async prefsFor(userId: string): Promise<InboxPreferences> {
    const row = await this.prisma.notificationPreference.findUnique({
      where: { userId },
      select: PREF_SELECT,
    });
    return this.toPrefs(row);
  }

  async prefsMap(userIds: string[]): Promise<Map<string, InboxPreferences>> {
    const ids = [...new Set(userIds.filter(Boolean))];
    const map = new Map<string, InboxPreferences>();
    if (!ids.length) return map;
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, ...PREF_SELECT },
    });
    const byId = new Map(rows.map((r) => [r.userId, this.toPrefs(r)]));
    for (const id of ids) {
      map.set(id, byId.get(id) ?? this.toPrefs(null));
    }
    return map;
  }

  async allowsInApp(userId: string): Promise<boolean> {
    return (await this.prefsFor(userId)).inApp;
  }

  async allowsEmail(userId: string, channel: InboxEmailChannel): Promise<boolean> {
    return (await this.prefsFor(userId))[channel];
  }

  /** Users who opted into a given email channel (defaults apply when no row). */
  async usersAllowingEmail(
    userIds: string[],
    channel: InboxEmailChannel,
  ): Promise<{ id: string; email: string }[]> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return [];
    const [users, prefs] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, email: true },
      }),
      this.prefsMap(ids),
    ]);
    return users.filter(
      (u) => !!u.email && (prefs.get(u.id)?.[channel] ?? INBOX_PREF_DEFAULTS[channel]),
    );
  }

  async notify(userId: string, payload: InboxNotifyPayload) {
    if (!userId) return null;
    if (!(await this.allowsInApp(userId))) return null;
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
    const prefs = await this.prefsMap(ids);
    const allowed = ids.filter((id) => prefs.get(id)?.inApp !== false);
    if (!allowed.length) return { count: 0 };
    try {
      return await this.prisma.notification.createMany({
        data: allowed.map((userId) => ({
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
