import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async dispatch(payload: Record<string, unknown>) {
    await this.postWebhook(payload);
    if (payload.type === 'final_results') {
      await this.sendFinalResultsEmail(payload.tournamentId as string);
    }
    if (payload.type === 'match_available') {
      await this.notifyMatchAvailable(payload);
    }
  }

  private async postWebhook(payload: Record<string, unknown>) {
    const url = this.config.get<string>('WEBHOOK_URL');
    if (!url) return;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          sentAt: new Date().toISOString(),
        }),
      });
      this.logger.log(`Webhook ${res.status} for ${payload.type ?? 'event'}`);
    } catch (err) {
      this.logger.warn(`Webhook failed: ${(err as Error).message}`);
    }
  }

  private async sendFinalResultsEmail(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        createdBy: { select: { email: true } },
      },
    });
    if (!tournament) return;

    const teams = await this.prisma.team.findMany({
      where: { tournamentId, registeredByUserId: { not: null } },
      select: { registeredByUserId: true },
    });
    const userIds = [
      ...new Set(
        teams
          .map((t) => t.registeredByUserId)
          .filter((id): id is string => !!id),
      ),
    ];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { email: true },
          })
        : [];

    const recipients = new Set<string>();
    if (tournament.createdBy?.email) recipients.add(tournament.createdBy.email);
    for (const user of users) {
      if (user.email) recipients.add(user.email);
    }

    const subject = `Final results — ${tournament.name}`;
    const html = `<p>The tournament <strong>${tournament.name}</strong> has completed.</p><p>View results on your Bracket dashboard.</p>`;

    for (const to of recipients) {
      await this.sendEmail(to, subject, html);
    }
  }

  private async notifyMatchAvailable(payload: Record<string, unknown>) {
    const matchId = payload.matchId as string;
    const homeTeam = payload.homeTeam as string | null;
    const awayTeam = payload.awayTeam as string | null;

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: { select: { registeredByUserId: true } },
        awayTeam: { select: { registeredByUserId: true } },
      },
    });
    if (!match) return;

    const userIds = [
      match.homeTeam?.registeredByUserId,
      match.awayTeam?.registeredByUserId,
    ].filter((id): id is string => !!id);

    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { email: true },
          })
        : [];

    const subject = `Match ready`;
    const html = `<p>Your match is ready: <strong>${homeTeam ?? 'TBD'}</strong> vs <strong>${awayTeam ?? 'TBD'}</strong>.</p>`;

    for (const user of users) {
      if (user.email) await this.sendEmail(user.email, subject, html);
    }
  }

  private async sendEmail(to: string, subject: string, html: string) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM') ?? 'Bracket <onboarding@resend.dev>';

    if (apiKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from, to, subject, html }),
        });
        if (!res.ok) {
          this.logger.warn(`Resend email failed (${res.status}) for ${to}`);
        }
        return;
      } catch (err) {
        this.logger.warn(`Resend error: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Email (dry-run) to ${to}: ${subject}`);
  }
}
