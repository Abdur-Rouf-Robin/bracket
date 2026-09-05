import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import type {
  ChangePasswordInput,
  UpdateAccountInput,
} from '@bracket/shared';
import { isReservedUsername } from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { NotificationsService } from '../notifications/notifications.service';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const VERIFICATION_RATE_LIMIT_MS = 60 * 1000;

export type AccountUser = {
  id: string;
  email: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string;
  locale: string;
  plan: 'FREE' | 'PREMIER';
  planExpiresAt: string | null;
  emailVerified: boolean;
  role: 'USER' | 'ADMIN';
  countryCode: string | null;
  createdAt: string;
};

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  name: true,
  username: true,
  avatarUrl: true,
  bio: true,
  timezone: true,
  locale: true,
  plan: true,
  planExpiresAt: true,
  emailVerified: true,
  role: true,
  countryCode: true,
  createdAt: true,
} as const;

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  bio: true,
  countryCode: true,
  createdAt: true,
} as const;

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function newToken() {
  const raw = randomBytes(32).toString('hex');
  return { raw, hash: sha256(raw) };
}

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  /** userId → last verification email timestamp (in-memory rate limit). */
  private readonly verificationSentAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------
  // Account
  // ---------------------------------------------------------------------

  async getAccount(userId: string): Promise<AccountUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: ACCOUNT_SELECT,
    });
    if (!user) throw new UnauthorizedException();
    const plan = await this.access.userPlan(userId);
    return this.toAccountUser({ ...user, plan });
  }

  toAccountUser(user: {
    id: string;
    email: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    timezone: string;
    locale: string;
    plan: 'FREE' | 'PREMIER';
    planExpiresAt: Date | null;
    emailVerified: boolean;
    role: 'USER' | 'ADMIN';
    countryCode: string | null;
    createdAt: Date;
  }): AccountUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      timezone: user.timezone,
      locale: user.locale,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString() : null,
      emailVerified: user.emailVerified,
      role: user.role,
      countryCode: user.countryCode,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateAccount(userId: string, input: UpdateAccountInput) {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl || null;
    if (input.bio !== undefined) data.bio = input.bio || null;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.locale !== undefined) data.locale = input.locale;
    if (input.countryCode !== undefined) data.countryCode = input.countryCode || null;
    if (input.username !== undefined) {
      if (input.username === null || input.username === '') {
        data.username = null;
      } else {
        const username = input.username.toLowerCase();
        if (isReservedUsername(username)) {
          throw new BadRequestException('That username is reserved');
        }
        const taken = await this.prisma.user.findFirst({
          where: { username, NOT: { id: userId } },
          select: { id: true },
        });
        if (taken) throw new ConflictException('That username is already taken');
        data.username = username;
      }
    }
    if (Object.keys(data).length) {
      await this.prisma.user.update({ where: { id: userId }, data });
    }
    return this.getAccount(userId);
  }

  async usernameAvailable(username: string, forUserId?: string) {
    const normalized = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalized)) {
      return { available: false, reason: 'Use 3–24 lowercase letters, numbers or underscores' };
    }
    if (isReservedUsername(normalized)) {
      return { available: false, reason: 'That username is reserved' };
    }
    const existing = await this.prisma.user.findUnique({
      where: { username: normalized },
      select: { id: true },
    });
    if (existing && existing.id !== forUserId) {
      return { available: false, reason: 'Already taken' };
    }
    return { available: true, reason: null };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    return { ok: true };
  }

  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new BadRequestException('Password is incorrect');

    const [tournaments, communities, events] = await Promise.all([
      this.prisma.tournament.count({ where: { createdById: userId } }),
      this.prisma.community.count({ where: { ownerId: userId } }),
      this.prisma.event.count({ where: { ownerId: userId } }),
    ]);
    if (tournaments || communities || events) {
      const parts: string[] = [];
      if (tournaments) parts.push(`${tournaments} tournament${tournaments === 1 ? '' : 's'}`);
      if (communities) parts.push(`${communities} communit${communities === 1 ? 'y' : 'ies'}`);
      if (events) parts.push(`${events} event${events === 1 ? '' : 's'}`);
      throw new BadRequestException(
        `You still own ${parts.join(', ')}. Delete or transfer them before deleting your account.`,
      );
    }

    await this.prisma.user.delete({ where: { id: userId } });
    this.verificationSentAt.delete(userId);
    return { ok: true };
  }

  // ---------------------------------------------------------------------
  // Email verification
  // ---------------------------------------------------------------------

  /** Create a fresh verification token and email the confirm link. */
  async sendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, emailVerified: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) return { sent: false, alreadyVerified: true };

    const { raw, hash } = newToken();
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
    });

    const url = `${this.notifications.appUrl()}/verify-email?token=${raw}`;
    const html = this.notifications.emailLayout(
      'Verify your email',
      `<p>Hi ${escapeHtml(user.name)},</p><p>Confirm your email address to unlock tournament sign-ups that require a verified account.</p>`,
      { label: 'Verify email', url },
    );
    await this.notifications.sendEmail(user.email, 'Verify your Bracket email', html);
    this.logger.log(`Verification email queued for ${user.email}`);
    return { sent: true, alreadyVerified: false };
  }

  /** Rate-limited variant used by the authenticated resend endpoint. */
  async requestVerification(userId: string) {
    const last = this.verificationSentAt.get(userId) ?? 0;
    const waitMs = last + VERIFICATION_RATE_LIMIT_MS - Date.now();
    if (waitMs > 0) {
      throw new BadRequestException(
        `Please wait ${Math.ceil(waitMs / 1000)}s before requesting another verification email`,
      );
    }
    const res = await this.sendVerificationEmail(userId);
    if (res.sent) this.verificationSentAt.set(userId, Date.now());
    return res;
  }

  async confirmVerification(rawToken: string) {
    const row = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: { select: { id: true, emailVerified: true } } },
    });
    if (!row || row.usedAt) {
      throw new BadRequestException('This verification link is invalid or has already been used');
    }
    if (row.expiresAt < new Date()) {
      throw new BadRequestException('This verification link has expired. Request a new one.');
    }
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: row.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      }),
    ]);
    return { verified: true, userId: row.userId };
  }

  // ---------------------------------------------------------------------
  // Password reset
  // ---------------------------------------------------------------------

  /** Always resolves (no user enumeration). */
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      this.logger.log(`Password reset requested for unknown email ${email}`);
      return { ok: true };
    }
    const { raw, hash } = newToken();
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    const url = `${this.notifications.appUrl()}/reset-password?token=${raw}`;
    const html = this.notifications.emailLayout(
      'Reset your password',
      `<p>Hi ${escapeHtml(user.name)},</p><p>We received a request to reset your Bracket password. This link is valid for one hour. If you did not request this, you can ignore this email.</p>`,
      { label: 'Choose a new password', url },
    );
    await this.notifications.sendEmail(user.email, 'Reset your Bracket password', html);
    return { ok: true };
  }

  async resetPassword(rawToken: string, password: string) {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    if (!row || row.usedAt) {
      throw new BadRequestException('This reset link is invalid or has already been used');
    }
    if (row.expiresAt < new Date()) {
      throw new BadRequestException('This reset link has expired. Request a new one.');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      }),
    ]);
    return { ok: true };
  }

  // ---------------------------------------------------------------------
  // Public profiles
  // ---------------------------------------------------------------------

  async publicProfile(username: string, viewerId?: string) {
    const normalized = username.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { username: normalized },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    const isSelf = viewerId === user.id;

    const [hosted, teams, communities, hostedCount] = await Promise.all([
      this.prisma.tournament.findMany({
        where: { createdById: user.id, isPublic: true },
        orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          format: true,
          startAt: true,
          logoUrl: true,
          game: { select: { id: true, name: true, category: true } },
          _count: { select: { teams: true } },
        },
      }),
      this.prisma.team.findMany({
        where: {
          registeredByUserId: user.id,
          tournament: { isPublic: true },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          name: true,
          seed: true,
          withdrawn: true,
          tournament: {
            select: {
              id: true,
              slug: true,
              name: true,
              status: true,
              startAt: true,
              logoUrl: true,
              game: { select: { id: true, name: true } },
            },
          },
          standings: {
            where: { groupId: null },
            select: { rank: true, wins: true, losses: true, draws: true },
            take: 1,
          },
          wonMatches: { select: { id: true } },
        },
      }),
      this.prisma.community.findMany({
        where: {
          isPublic: true,
          OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
        },
        take: 20,
        select: { id: true, slug: true, name: true, logoUrl: true },
      }),
      this.prisma.tournament.count({
        where: { createdById: user.id, ...(isSelf ? {} : { isPublic: true }) },
      }),
    ]);

    const wins = teams.reduce((sum, t) => sum + t.wonMatches.length, 0);
    const participated = teams.map((t) => ({
      team: { id: t.id, name: t.name, seed: t.seed, withdrawn: t.withdrawn },
      tournament: {
        ...t.tournament,
        startAt: t.tournament.startAt ? t.tournament.startAt.toISOString() : null,
      },
      finalRank:
        t.tournament.status === 'COMPLETED' && t.standings[0]?.rank
          ? t.standings[0].rank
          : null,
      record: t.standings[0]
        ? {
            wins: t.standings[0].wins,
            losses: t.standings[0].losses,
            draws: t.standings[0].draws,
          }
        : null,
    }));

    return {
      user: { ...user, createdAt: user.createdAt.toISOString() },
      stats: {
        tournamentsHosted: hostedCount,
        tournamentsPlayed: teams.length,
        wins,
      },
      hosted: hosted.map((t) => ({
        ...t,
        startAt: t.startAt ? t.startAt.toISOString() : null,
        teamCount: t._count.teams,
      })),
      participated,
      communities,
    };
  }

  async assertNotDeleted(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!u) throw new ForbiddenException();
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
