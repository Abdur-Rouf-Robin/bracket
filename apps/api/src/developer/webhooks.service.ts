import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import {
  WEBHOOK_AUTO_DISABLE_FAILURES,
  WEBHOOK_EVENTS,
  type CreateWebhookInput,
  type UpdateWebhookInput,
  type WebhookDelivery,
  type WebhookEvent,
} from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';

const DELIVERY_TIMEOUT_MS = 5000;

const WEBHOOK_SELECT = {
  id: true,
  url: true,
  events: true,
  isActive: true,
  tournamentId: true,
  communityId: true,
  lastStatus: true,
  lastSentAt: true,
  failureCount: true,
  createdAt: true,
} as const;

/** Map internal NotificationsService payload types onto public webhook events. */
const PAYLOAD_TYPE_MAP: Record<string, WebhookEvent> = {
  final_results: 'tournament.completed',
  tournament_completed: 'tournament.completed',
  'tournament.completed': 'tournament.completed',
  tournament_started: 'tournament.started',
  bracket_generated: 'tournament.started',
  'tournament.started': 'tournament.started',
  match_available: 'match.ready',
  match_ready: 'match.ready',
  'match.ready': 'match.ready',
  match_completed: 'match.completed',
  'match.completed': 'match.completed',
  participant_registered: 'participant.registered',
  registration_created: 'participant.registered',
  'participant.registered': 'participant.registered',
  registration_approved: 'registration.approved',
  'registration.approved': 'registration.approved',
  schedule_updated: 'schedule.updated',
  'schedule.updated': 'schedule.updated',
  announcement_posted: 'announcement.posted',
  announcement_created: 'announcement.posted',
  'announcement.posted': 'announcement.posted',
};

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async list(userId: string, filter: { tournamentId?: string; communityId?: string }) {
    if (filter.tournamentId) {
      await this.access.requireTournamentManager(filter.tournamentId, userId);
      return this.prisma.webhook.findMany({
        where: { tournamentId: filter.tournamentId },
        orderBy: { createdAt: 'desc' },
        select: WEBHOOK_SELECT,
      });
    }
    if (filter.communityId) {
      await this.access.requireCommunityRole(filter.communityId, userId, 'ADMIN');
      return this.prisma.webhook.findMany({
        where: { communityId: filter.communityId },
        orderBy: { createdAt: 'desc' },
        select: WEBHOOK_SELECT,
      });
    }
    return this.prisma.webhook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: WEBHOOK_SELECT,
    });
  }

  /** Creates a webhook; the signing secret is returned exactly once. */
  async create(userId: string, input: CreateWebhookInput) {
    if (input.tournamentId) {
      await this.access.requireTournamentManager(input.tournamentId, userId);
    }
    if (input.communityId) {
      await this.access.requireCommunityRole(input.communityId, userId, 'ADMIN');
    }
    const secret = `whsec_${randomBytes(24).toString('base64url')}`;
    const row = await this.prisma.webhook.create({
      data: {
        userId,
        url: input.url,
        events: [...new Set(input.events)],
        secret,
        tournamentId: input.tournamentId ?? null,
        communityId: input.communityId ?? null,
      },
      select: WEBHOOK_SELECT,
    });
    return { ...row, secret };
  }

  async update(userId: string, id: string, input: UpdateWebhookInput) {
    await this.own(userId, id);
    return this.prisma.webhook.update({
      where: { id },
      data: {
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.events !== undefined ? { events: [...new Set(input.events)] } : {}),
        ...(input.isActive !== undefined
          ? { isActive: input.isActive, ...(input.isActive ? { failureCount: 0 } : {}) }
          : {}),
      },
      select: WEBHOOK_SELECT,
    });
  }

  async remove(userId: string, id: string) {
    await this.own(userId, id);
    await this.prisma.webhook.delete({ where: { id } });
    return { ok: true };
  }

  /** Sends a synthetic `ping` delivery and returns the HTTP result. */
  async test(userId: string, id: string) {
    const hook = await this.own(userId, id);
    const delivery: WebhookDelivery = {
      id: randomUUID(),
      event: (hook.events[0] as WebhookEvent) ?? 'tournament.started',
      createdAt: new Date().toISOString(),
      tournamentId: hook.tournamentId,
      data: { test: true, message: 'Test delivery from Bracket' },
    };
    const result = await this.deliver(hook, delivery, true);
    return { ok: result.ok, status: result.status, durationMs: result.durationMs, error: result.error ?? null };
  }

  private async own(userId: string, id: string) {
    const hook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!hook) throw new NotFoundException('Webhook not found');
    if (hook.userId === userId) return hook;
    if (hook.tournamentId && (await this.access.canManageTournament(hook.tournamentId, userId))) {
      return hook;
    }
    if (hook.communityId && (await this.access.hasCommunityRole(hook.communityId, userId, 'ADMIN'))) {
      return hook;
    }
    throw new ForbiddenException('You cannot manage this webhook');
  }

  // -------------------------------------------------------------------------
  // Dispatch
  // -------------------------------------------------------------------------

  /** Entry point wired into NotificationsService.dispatch(). Never throws. */
  async dispatch(payload: Record<string, unknown>): Promise<void> {
    try {
      const type = String(payload.type ?? '');
      const mapped: WebhookEvent | null =
        PAYLOAD_TYPE_MAP[type] ??
        ((WEBHOOK_EVENTS as readonly string[]).includes(type) ? (type as WebhookEvent) : null);
      if (!mapped) return;
      const tournamentId = typeof payload.tournamentId === 'string' ? payload.tournamentId : null;
      const data: Record<string, unknown> = { ...payload };
      delete data.type;
      await this.dispatchEvent(mapped, tournamentId, data);
    } catch (err) {
      this.logger.warn(`Webhook dispatch failed: ${(err as Error).message}`);
    }
  }

  /** Public helper for other modules: fan out an event to matching webhooks. */
  async dispatchEvent(
    event: WebhookEvent,
    tournamentId: string | null,
    data: Record<string, unknown>,
  ): Promise<{ delivered: number }> {
    const hooks = await this.findTargets(event, tournamentId);
    if (!hooks.length) return { delivered: 0 };
    const enriched = await this.enrich(tournamentId, data);
    const delivery: WebhookDelivery = {
      id: randomUUID(),
      event,
      createdAt: new Date().toISOString(),
      tournamentId,
      data: enriched,
    };
    await Promise.all(hooks.map((h) => this.deliver(h, delivery, false)));
    return { delivered: hooks.length };
  }

  private async enrich(tournamentId: string | null, data: Record<string, unknown>) {
    if (!tournamentId || data.tournament) return data;
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, slug: true, name: true, status: true, format: true },
    });
    const out: Record<string, unknown> = { ...data, tournament: t };
    if (typeof data.matchId === 'string') {
      const m = await this.prisma.match.findUnique({
        where: { id: data.matchId },
        select: {
          id: true,
          round: true,
          bracketSide: true,
          status: true,
          homeScore: true,
          awayScore: true,
          winnerTeamId: true,
          scheduledAt: true,
          station: true,
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
        },
      });
      if (m) out.match = m;
    }
    return out;
  }

  private async findTargets(event: WebhookEvent, tournamentId: string | null) {
    if (!tournamentId) {
      return this.prisma.webhook.findMany({
        where: { isActive: true, events: { has: event }, tournamentId: null, communityId: null },
      });
    }
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { communityId: true, createdById: true, admins: { select: { userId: true } } },
    });
    if (!t) return [];
    const userIds = [t.createdById, ...t.admins.map((a) => a.userId)];
    return this.prisma.webhook.findMany({
      where: {
        isActive: true,
        events: { has: event },
        OR: [
          { tournamentId },
          ...(t.communityId ? [{ communityId: t.communityId }] : []),
          { tournamentId: null, communityId: null, userId: { in: userIds } },
        ],
      },
    });
  }

  private async deliver(
    hook: { id: string; url: string; secret: string; failureCount: number },
    delivery: WebhookDelivery,
    isTest: boolean,
  ): Promise<{ ok: boolean; status: number | null; durationMs: number; error?: string }> {
    const body = JSON.stringify(delivery);
    const signature = `sha256=${createHmac('sha256', hook.secret).update(body).digest('hex')}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    const started = Date.now();
    let status: number | null = null;
    let ok = false;
    let error: string | undefined;
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Bracket-Webhooks/1.0',
          'X-Bracket-Event': delivery.event,
          'X-Bracket-Signature': signature,
          'X-Bracket-Delivery': delivery.id,
          ...(isTest ? { 'X-Bracket-Test': '1' } : {}),
        },
        body,
        signal: controller.signal,
      });
      status = res.status;
      ok = res.ok;
      if (!ok) error = `HTTP ${res.status}`;
    } catch (err) {
      error = (err as Error).name === 'AbortError' ? 'Timed out after 5s' : (err as Error).message;
    } finally {
      clearTimeout(timer);
    }
    const durationMs = Date.now() - started;

    const failureCount = ok ? 0 : hook.failureCount + 1;
    const disable = !ok && !isTest && failureCount >= WEBHOOK_AUTO_DISABLE_FAILURES;
    await this.prisma.webhook
      .update({
        where: { id: hook.id },
        data: {
          lastStatus: status ?? 0,
          lastSentAt: new Date(),
          failureCount,
          ...(disable ? { isActive: false } : {}),
        },
      })
      .catch(() => undefined);
    if (disable) {
      this.logger.warn(`Webhook ${hook.id} disabled after ${failureCount} consecutive failures`);
    }
    return { ok, status, durationMs, error };
  }
}
