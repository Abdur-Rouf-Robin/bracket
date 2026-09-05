import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InboxService } from '../inbox/inbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../developer/webhooks.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
    @Optional() private readonly webhooks?: WebhooksService,
  ) {}

  async dispatch(payload: Record<string, unknown>) {
    await this.webhooks?.dispatch(payload);
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
        createdBy: { select: { id: true, email: true } },
      },
    });
    if (!tournament) return;

    const teams = await this.prisma.team.findMany({
      where: { tournamentId, registeredByUserId: { not: null } },
      select: { registeredByUserId: true },
    });
    const userIds = [
      ...new Set(
        [
          tournament.createdBy?.id,
          ...teams.map((t) => t.registeredByUserId),
        ].filter((id): id is string => !!id),
      ),
    ];
    const allowed = await this.inbox.usersAllowingEmail(userIds, 'emailFinalResults');
    const recipients = [...new Set(allowed.map((u) => u.email).filter(Boolean))];

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

    const users = await this.inbox.usersAllowingEmail(userIds, 'emailMatchReady');

    const subject = `Match ready`;
    const html = `<p>Your match is ready: <strong>${homeTeam ?? 'TBD'}</strong> vs <strong>${awayTeam ?? 'TBD'}</strong>.</p>`;

    for (const user of users) {
      await this.sendEmail(user.email, subject, html);
    }
  }

  /** Minimal HTML email layout shared by transactional emails. */
  emailLayout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
    const button = cta
      ? `<p style="margin:24px 0"><a href="${cta.url}" style="display:inline-block;padding:10px 18px;background:#26bbff;color:#041018;border-radius:6px;font-weight:600;text-decoration:none">${cta.label}</a></p><p style="font-size:12px;color:#888">If the button does not work, copy this link: <br/><a href="${cta.url}">${cta.url}</a></p>`
      : '';
    return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111"><h2 style="margin:0 0 12px">${title}</h2>${bodyHtml}${button}<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/><p style="font-size:12px;color:#888">Sent by Bracket.</p></div>`;
  }

  /** Public base URL of the web app (for links in emails). */
  appUrl(): string {
    return (this.config.get<string>('APP_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  /** Send a transactional email via Resend (dry-run logs when no API key). */
  async sendEmail(to: string, subject: string, html: string) {
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
          return { delivered: false, mode: 'resend' as const };
        }
        return { delivered: true, mode: 'resend' as const };
      } catch (err) {
        this.logger.warn(`Resend error: ${(err as Error).message}`);
        return { delivered: false, mode: 'resend' as const };
      }
    }

    this.logger.log(`Email (dry-run) to ${to}: ${subject}`);
    return { delivered: false, mode: 'dry-run' as const };
  }

  isConfigured() {
    return !!this.config.get<string>('RESEND_API_KEY');
  }
}
