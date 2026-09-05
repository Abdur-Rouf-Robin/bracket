import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { tournamentSettingsSchema } from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { InboxService } from '../inbox/inbox.service';
import { NotificationsService } from '../notifications/notifications.service';

const COMMENT_INCLUDE = {
  user: {
    select: { id: true, name: true, username: true, avatarUrl: true },
  },
} as const;

@Injectable()
export class MatchCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly inbox: InboxService,
    private readonly notifications: NotificationsService,
  ) {}

  private async loadMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: {
          select: { id: true, slug: true, name: true, isPublic: true, settings: true },
        },
        homeTeam: { select: { id: true, name: true, registeredByUserId: true } },
        awayTeam: { select: { id: true, name: true, registeredByUserId: true } },
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  async list(matchId: string, viewerId?: string) {
    const match = await this.loadMatch(matchId);
    const settings = tournamentSettingsSchema.parse(match.tournament.settings ?? {});
    const canManage = viewerId
      ? await this.access.canManageTournament(match.tournament.id, viewerId)
      : false;
    if (!match.tournament.isPublic && !canManage) {
      throw new NotFoundException('Match not found');
    }
    const items = await this.prisma.matchComment.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
      include: COMMENT_INCLUDE,
    });
    return {
      enabled: settings.enableMatchComments,
      canManage,
      items,
    };
  }

  async create(matchId: string, userId: string, body: string) {
    const match = await this.loadMatch(matchId);
    const settings = tournamentSettingsSchema.parse(match.tournament.settings ?? {});
    if (!settings.enableMatchComments) {
      throw new BadRequestException('Comments are disabled for this tournament');
    }
    const canManage = await this.access.canManageTournament(match.tournament.id, userId);
    if (!match.tournament.isPublic && !canManage) {
      throw new NotFoundException('Match not found');
    }
    const comment = await this.prisma.matchComment.create({
      data: { matchId, userId, body: body.trim() },
      include: COMMENT_INCLUDE,
    });

    // Notify the other side's registrant (and the host) about the new comment.
    const recipients = new Set<string>();
    for (const team of [match.homeTeam, match.awayTeam]) {
      if (team?.registeredByUserId && team.registeredByUserId !== userId) {
        recipients.add(team.registeredByUserId);
      }
    }
    if (recipients.size) {
      const label = `${match.homeTeam?.name ?? 'TBD'} vs ${match.awayTeam?.name ?? 'TBD'}`;
      const title = `New comment on ${label}`;
      const excerpt = `${comment.user.name}: ${body.trim().slice(0, 140)}`;
      const href = `/t/${match.tournament.slug}/m/${match.id}`;
      await this.inbox.notifyMany([...recipients], {
        type: 'match_comment',
        title,
        body: excerpt,
        href,
      });
      const emailTo = await this.inbox.usersAllowingEmail(
        [...recipients],
        'emailMatchComments',
      );
      if (emailTo.length) {
        const url = `${this.notifications.appUrl()}${href}`;
        const html = this.notifications.emailLayout(
          title,
          `<p>${excerpt}</p><p>Tournament: <strong>${match.tournament.name}</strong></p>`,
          { label: 'Open match', url },
        );
        for (const user of emailTo) {
          await this.notifications.sendEmail(user.email, title, html);
        }
      }
    }
    return comment;
  }

  async remove(matchId: string, commentId: string, userId: string) {
    const comment = await this.prisma.matchComment.findFirst({
      where: { id: commentId, matchId },
      include: { match: { select: { tournamentId: true } } },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) {
      const canManage = await this.access.canManageTournament(
        comment.match.tournamentId,
        userId,
      );
      if (!canManage) throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.matchComment.delete({ where: { id: commentId } });
    return { ok: true };
  }
}
