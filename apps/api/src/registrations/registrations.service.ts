import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MatchStatus,
  PaymentStatus,
  Prisma,
  RegistrationStatus,
  TournamentStatus,
} from '@prisma/client';
import Stripe from 'stripe';
import {
  matchResultSchema,
  rosterLimits,
  tournamentSettingsSchema,
  validateCustomFields,
} from '@bracket/shared';
import type {
  CheckInStatus,
  RegistrationClosedReason,
  RegistrationFieldDef,
  RegistrationFormConfig,
  RegistrationManualInput,
  RegistrationPlayer,
  RegistrationReviewInput,
  RegistrationSubmitInput,
  TournamentSettings,
} from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { InboxService } from '../inbox/inbox.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MatchesService } from '../matches/matches.service';

type ReqUser = { id: string; email: string; name: string; role?: string } | null | undefined;

const REGISTRATION_INCLUDE = {
  user: {
    select: { id: true, name: true, email: true, avatarUrl: true, username: true },
  },
  team: { include: { players: { orderBy: { order: 'asc' as const } } } },
} satisfies Prisma.RegistrationInclude;

function maskEmail(email: string | null | undefined) {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'*'.repeat(Math.max(1, local.length - head.length))}@${domain}`;
}

function normalizePlayers(raw: unknown): RegistrationPlayer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (typeof p === 'string') return { name: p, isCaptain: false };
      if (p && typeof p === 'object' && typeof (p as { name?: unknown }).name === 'string') {
        return {
          name: (p as { name: string }).name,
          isCaptain: (p as { isCaptain?: boolean }).isCaptain === true,
        };
      }
      return null;
    })
    .filter((p): p is RegistrationPlayer => !!p && p.name.trim().length > 0);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name);
  private stripe: Stripe | null | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtime: RealtimeGateway,
    private readonly inbox: InboxService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => MatchesService))
    private readonly matches: MatchesService,
  ) {}

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private getStripe(): Stripe | null {
    if (this.stripe !== undefined) return this.stripe;
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
    return this.stripe;
  }

  private appUrl() {
    return this.notifications.appUrl();
  }

  private settingsOf(t: { settings: unknown }): TournamentSettings {
    return tournamentSettingsSchema.parse(t.settings ?? {});
  }

  private async loadBySlug(slug: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { slug },
      include: {
        game: { select: { id: true, name: true, category: true } },
        _count: { select: { matches: true, teams: true } },
      },
    });
    if (!t) throw new NotFoundException('Tournament not found');
    return t;
  }

  private async counts(tournamentId: string) {
    const rows = await this.prisma.registration.groupBy({
      by: ['status'],
      where: { tournamentId },
      _count: { _all: true },
    });
    const get = (s: RegistrationStatus) =>
      rows.find((r) => r.status === s)?._count._all ?? 0;
    return {
      approved: get('APPROVED'),
      pending: get('PENDING'),
      waitlisted: get('WAITLISTED'),
      rejected: get('REJECTED'),
      withdrawn: get('WITHDRAWN'),
    };
  }

  /** Approved capacity counts registrations AND host-listed teams without a registration. */
  private async approvedCount(tournamentId: string) {
    const [approvedRegs, orphanTeams] = await Promise.all([
      this.prisma.registration.count({
        where: { tournamentId, status: 'APPROVED' },
      }),
      this.prisma.team.count({
        where: { tournamentId, registration: null, withdrawn: false },
      }),
    ]);
    return approvedRegs + orphanTeams;
  }

  private openState(
    t: {
      isPublic: boolean;
      status: TournamentStatus;
      _count: { matches: number };
    },
    settings: TournamentSettings,
    approved: number,
    now = new Date(),
  ): { isOpen: boolean; reason: RegistrationClosedReason | null; spotsLeft: number } {
    const spotsLeft = Math.max(0, settings.maxParticipants - approved);
    if (settings.registrationMode !== 'OPEN_SIGNUP') {
      return { isOpen: false, reason: 'HOST_LIST', spotsLeft };
    }
    if (!t.isPublic || !settings.signupPagePublic) {
      return { isOpen: false, reason: 'NOT_PUBLIC', spotsLeft };
    }
    if (t.status === TournamentStatus.COMPLETED) {
      return { isOpen: false, reason: 'COMPLETED', spotsLeft };
    }
    if (t._count.matches > 0) {
      return { isOpen: false, reason: 'BRACKET_GENERATED', spotsLeft };
    }
    if (settings.registrationOpensAt) {
      const opens = new Date(settings.registrationOpensAt);
      if (!Number.isNaN(opens.getTime()) && opens > now) {
        return { isOpen: false, reason: 'NOT_OPEN_YET', spotsLeft };
      }
    }
    if (settings.registrationClosesAt) {
      const closes = new Date(settings.registrationClosesAt);
      if (!Number.isNaN(closes.getTime()) && closes <= now) {
        return { isOpen: false, reason: 'CLOSED', spotsLeft };
      }
    }
    if (spotsLeft <= 0 && !settings.waitlistEnabled) {
      return { isOpen: false, reason: 'FULL', spotsLeft };
    }
    return { isOpen: true, reason: null, spotsLeft };
  }

  private checkInWindow(
    t: { startAt: Date | null },
    settings: TournamentSettings,
    now = new Date(),
  ) {
    if (!settings.requireCheckIn) {
      return { required: false, opensAt: null as string | null, closesAt: null as string | null, isOpenNow: false };
    }
    if (!t.startAt) {
      // No start time: check-in is open whenever it's required.
      return { required: true, opensAt: null, closesAt: null, isOpenNow: true };
    }
    const opens = new Date(
      t.startAt.getTime() - settings.checkInOpensMinutesBefore * 60_000,
    );
    return {
      required: true,
      opensAt: opens.toISOString(),
      closesAt: t.startAt.toISOString(),
      isOpenNow: now >= opens,
    };
  }

  private async managerIds(tournamentId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { createdById: true, admins: { select: { userId: true } } },
    });
    if (!t) return [];
    return [...new Set([t.createdById, ...t.admins.map((a) => a.userId)])];
  }

  private async managerEmails(tournamentId: string) {
    const ids = await this.managerIds(tournamentId);
    if (!ids.length) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { email: true },
    });
    return users.map((u) => u.email);
  }

  private async nextWaitlistPosition(tournamentId: string) {
    const last = await this.prisma.registration.findFirst({
      where: { tournamentId, status: 'WAITLISTED' },
      orderBy: { waitlistPosition: 'desc' },
      select: { waitlistPosition: true },
    });
    return (last?.waitlistPosition ?? 0) + 1;
  }

  private async renumberWaitlist(tournamentId: string) {
    const rows = await this.prisma.registration.findMany({
      where: { tournamentId, status: 'WAITLISTED' },
      orderBy: [{ waitlistPosition: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, waitlistPosition: true },
    });
    const updates = rows
      .map((r, idx) => ({ id: r.id, pos: idx + 1, current: r.waitlistPosition }))
      .filter((r) => r.current !== r.pos)
      .map((r) =>
        this.prisma.registration.update({
          where: { id: r.id },
          data: { waitlistPosition: r.pos },
        }),
      );
    if (updates.length) await this.prisma.$transaction(updates);
  }

  private async createTeamForRegistration(
    reg: {
      id: string;
      tournamentId: string;
      teamName: string;
      players: unknown;
      userId: string | null;
      teamId: string | null;
    },
    settings: TournamentSettings,
  ) {
    if (reg.teamId) {
      const existing = await this.prisma.team.findUnique({ where: { id: reg.teamId } });
      if (existing) {
        if (existing.withdrawn) {
          await this.prisma.team.update({
            where: { id: existing.id },
            data: { withdrawn: false, withdrawnAt: null },
          });
        }
        return existing;
      }
    }
    const limits = rosterLimits(settings);
    const players = normalizePlayers(reg.players);
    const team = await this.prisma.team.create({
      data: {
        tournamentId: reg.tournamentId,
        name: reg.teamName,
        seed: null,
        registeredByUserId: reg.userId,
      },
    });
    const roster =
      players.length > 0
        ? players
        : settings.playersPerTeam === 1
          ? [{ name: reg.teamName, isCaptain: true }]
          : [];
    if (roster.length) {
      const hasCaptain = roster.some((p) => p.isCaptain);
      await this.prisma.teamPlayer.createMany({
        data: roster.map((p, order) => ({
          teamId: team.id,
          name: p.name.trim(),
          order,
          isCaptain: hasCaptain ? p.isCaptain === true : order === 0,
          isSub: settings.allowSubstitutes && order >= limits.starters,
        })),
      });
    }
    await this.prisma.registration.update({
      where: { id: reg.id },
      data: { teamId: team.id },
    });
    return team;
  }

  private async removeTeamForRegistration(
    reg: { teamId: string | null; tournamentId: string },
  ) {
    if (!reg.teamId) return;
    const matches = await this.prisma.match.count({
      where: { tournamentId: reg.tournamentId },
    });
    if (matches > 0) {
      throw new BadRequestException(
        'Bracket already generated; withdraw the participant instead',
      );
    }
    await this.prisma.team.delete({ where: { id: reg.teamId } }).catch(() => undefined);
  }

  private async notifyRegistrant(
    reg: {
      id: string;
      userId: string | null;
      email: string | null;
      teamName: string;
      status: RegistrationStatus;
      waitlistPosition: number | null;
    },
    tournament: { id: string; slug: string; name: string },
    kind: 'received' | 'approved' | 'rejected' | 'waitlisted' | 'pending' | 'withdrawn',
  ) {
    const href = `/t/${tournament.slug}/register?registration=${reg.id}`;
    const url = `${this.appUrl()}${href}`;
    const tName = escapeHtml(tournament.name);
    const team = escapeHtml(reg.teamName);
    let title: string;
    let body: string;
    let type: string;
    switch (kind) {
      case 'approved':
        type = 'registration_approved';
        title = `You're in: ${tournament.name}`;
        body = `<p><strong>${team}</strong> has been approved for <strong>${tName}</strong>. See you at the tournament!</p>`;
        break;
      case 'rejected':
        type = 'registration_rejected';
        title = `Registration declined: ${tournament.name}`;
        body = `<p>The host declined the registration of <strong>${team}</strong> for <strong>${tName}</strong>.</p>`;
        break;
      case 'waitlisted':
        type = 'registration_waitlisted';
        title = `Waitlisted #${reg.waitlistPosition ?? '?'}: ${tournament.name}`;
        body = `<p><strong>${team}</strong> is on the waitlist for <strong>${tName}</strong>${reg.waitlistPosition ? ` at position #${reg.waitlistPosition}` : ''}. We'll let you know if a spot opens up.</p>`;
        break;
      case 'pending':
        type = 'registration_pending';
        title = `Registration under review: ${tournament.name}`;
        body = `<p><strong>${team}</strong> is awaiting host approval for <strong>${tName}</strong>.</p>`;
        break;
      case 'withdrawn':
        type = 'registration_withdrawn';
        title = `Withdrawn from ${tournament.name}`;
        body = `<p><strong>${team}</strong> has been withdrawn from <strong>${tName}</strong>.</p>`;
        break;
      case 'received':
      default:
        type = 'registration_received';
        title =
          reg.status === 'APPROVED'
            ? `You're in: ${tournament.name}`
            : reg.status === 'WAITLISTED'
              ? `Waitlisted #${reg.waitlistPosition ?? '?'}: ${tournament.name}`
              : `Registration received: ${tournament.name}`;
        body =
          reg.status === 'APPROVED'
            ? `<p><strong>${team}</strong> is registered for <strong>${tName}</strong>.</p>`
            : reg.status === 'WAITLISTED'
              ? `<p><strong>${team}</strong> is on the waitlist for <strong>${tName}</strong>${reg.waitlistPosition ? ` at position #${reg.waitlistPosition}` : ''}.</p>`
              : `<p>We received the registration of <strong>${team}</strong> for <strong>${tName}</strong>. The host will review it shortly.</p>`;
    }
    if (reg.userId) {
      await this.inbox.notify(reg.userId, {
        type,
        title,
        body: body.replace(/<[^>]+>/g, ''),
        href,
      });
    }
    if (reg.email) {
      const allowEmail =
        !reg.userId || (await this.inbox.allowsEmail(reg.userId, 'emailRegistration'));
      if (allowEmail) {
        await this.notifications.sendEmail(
          reg.email,
          title,
          this.notifications.emailLayout(title, body, { label: 'View registration', url }),
        );
      }
    }
  }

  private async notifyManagersReceived(
    reg: { id: string; teamName: string; status: RegistrationStatus },
    tournament: { id: string; slug: string; name: string },
  ) {
    const ids = await this.managerIds(tournament.id);
    await this.inbox.notifyMany(ids, {
      type: 'registration_received',
      title: `New registration: ${reg.teamName}`,
      body: `${reg.teamName} signed up for ${tournament.name} (${reg.status.toLowerCase()}).`,
      href: `/t/${tournament.slug}/manage?tab=registrations&sub=${
        reg.status === 'APPROVED' ? 'approved' : reg.status === 'WAITLISTED' ? 'waitlist' : 'pending'
      }`,
    });
  }

  // ---------------------------------------------------------------------
  // Public sign-up page
  // ---------------------------------------------------------------------

  async formConfig(slug: string, user: ReqUser): Promise<RegistrationFormConfig> {
    const t = await this.loadBySlug(slug);
    const settings = this.settingsOf(t);
    const canManage = user ? await this.access.canManageTournament(t.id, user.id) : false;
    if (!t.isPublic && !canManage) throw new NotFoundException('Tournament not found');

    const [counts, approved] = await Promise.all([this.counts(t.id), this.approvedCount(t.id)]);
    const state = this.openState(t, settings, approved);

    let viewer: RegistrationFormConfig['viewer'] = {
      loggedIn: false,
      emailVerified: false,
      email: null,
      name: null,
      countryCode: null,
      existingRegistration: null,
    };
    if (user) {
      const [dbUser, existing] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: user.id },
          select: { email: true, name: true, emailVerified: true, countryCode: true },
        }),
        this.prisma.registration.findFirst({
          where: {
            tournamentId: t.id,
            userId: user.id,
            status: { in: ['PENDING', 'APPROVED', 'WAITLISTED'] },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, waitlistPosition: true, paymentStatus: true },
        }),
      ]);
      viewer = {
        loggedIn: true,
        emailVerified: dbUser?.emailVerified ?? false,
        email: dbUser?.email ?? user.email ?? null,
        name: dbUser?.name ?? user.name ?? null,
        countryCode: dbUser?.countryCode ?? null,
        existingRegistration: existing
          ? {
              id: existing.id,
              status: existing.status,
              waitlistPosition: existing.waitlistPosition,
              paymentStatus: existing.paymentStatus,
            }
          : null,
      };
    }

    const checkIn = this.checkInWindow(t, settings);

    return {
      tournament: {
        id: t.id,
        slug: t.slug,
        name: t.name,
        logoUrl: t.logoUrl,
        startAt: t.startAt ? t.startAt.toISOString() : null,
        timezone: t.timezone,
        game: t.game,
      },
      isOpen: state.isOpen,
      reason: state.reason,
      maxParticipants: settings.maxParticipants,
      approvedCount: approved,
      pendingCount: counts.pending,
      waitlistCount: counts.waitlisted,
      spotsLeft: state.spotsLeft,
      waitlistEnabled: settings.waitlistEnabled,
      autoApprove: settings.autoApproveRegistrations,
      requireTeamRegistration: settings.requireTeamRegistration,
      playersPerTeam: settings.playersPerTeam,
      substituteSlots: settings.allowSubstitutes ? settings.substituteSlots : 0,
      allowSubstitutes: settings.allowSubstitutes,
      registrationFields: settings.registrationFields as RegistrationFieldDef[],
      waiverText: settings.waiverText ?? null,
      entryFeeCents: settings.entryFeeCents,
      currency: settings.currency,
      requireVerifiedEmail: settings.requireVerifiedEmail,
      restrictByCountry: settings.restrictByCountry,
      allowedCountries: settings.allowedCountries,
      collectSkillLevel: settings.collectSkillLevel,
      registrationOpensAt: settings.registrationOpensAt ?? null,
      registrationClosesAt: settings.registrationClosesAt ?? null,
      viewer,
      checkIn: {
        required: checkIn.required,
        opensAt: checkIn.opensAt,
        isOpenNow: checkIn.isOpenNow,
      },
    };
  }

  async submit(slug: string, user: ReqUser, input: RegistrationSubmitInput) {
    const t = await this.loadBySlug(slug);
    if (!t.isPublic) throw new NotFoundException('Tournament not found');
    const settings = this.settingsOf(t);
    const approved = await this.approvedCount(t.id);
    const state = this.openState(t, settings, approved);
    if (!state.isOpen) {
      const messages: Record<RegistrationClosedReason, string> = {
        HOST_LIST: 'This tournament uses a host-managed participant list',
        NOT_PUBLIC: 'The sign-up page is not public',
        COMPLETED: 'Registration is closed — tournament completed',
        BRACKET_GENERATED: 'Registration closed — bracket has already been generated',
        NOT_OPEN_YET: 'Registration has not opened yet',
        CLOSED: 'Registration has closed',
        FULL: 'Tournament is full',
      };
      throw new BadRequestException({
        message: messages[state.reason ?? 'CLOSED'],
        code: state.reason ?? 'CLOSED',
      });
    }

    const dbUser = user
      ? await this.prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, email: true, name: true, emailVerified: true, countryCode: true },
        })
      : null;

    if (settings.requireVerifiedEmail && (!dbUser || !dbUser.emailVerified)) {
      throw new ForbiddenException({
        message: dbUser
          ? 'Verify your email before registering'
          : 'Sign in with a verified email to register',
        code: 'EMAIL_VERIFICATION_REQUIRED',
      });
    }

    const email = (input.email ?? dbUser?.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException({
        message: 'Email is required',
        fieldErrors: { email: ['Email is required'] },
      });
    }

    const countryCode = (input.countryCode ?? dbUser?.countryCode ?? null) || null;
    if (settings.restrictByCountry && settings.allowedCountries.length) {
      if (!countryCode || !settings.allowedCountries.includes(countryCode)) {
        throw new BadRequestException({
          message: 'Registration is restricted to selected regions',
          code: 'COUNTRY_RESTRICTED',
        });
      }
    }

    if (settings.collectSkillLevel && !input.skillLevel) {
      throw new BadRequestException({
        message: 'Select your skill level',
        fieldErrors: { skillLevel: ['Skill level is required'] },
      });
    }

    if (settings.waiverText && settings.waiverText.trim() && !input.acceptWaiver) {
      throw new BadRequestException({
        message: 'You must accept the waiver to register',
        fieldErrors: { acceptWaiver: ['Accept the waiver to continue'] },
      });
    }

    // Roster validation
    const limits = rosterLimits(settings);
    const players = input.players
      .map((p) => ({ name: p.name.trim(), isCaptain: p.isCaptain === true }))
      .filter((p) => p.name.length > 0);
    if (settings.requireTeamRegistration && players.length < limits.minRoster) {
      throw new BadRequestException(
        `Provide at least ${limits.minRoster} player name(s)`,
      );
    }
    if (players.length > limits.maxRoster) {
      throw new BadRequestException(
        settings.allowSubstitutes
          ? `Maximum ${limits.maxRoster} players (${limits.starters} starters + ${limits.substituteSlots} substitutes)`
          : `Maximum ${limits.maxRoster} players per team`,
      );
    }
    if (players.filter((p) => p.isCaptain).length > 1) {
      throw new BadRequestException('Only one captain per team');
    }

    // Custom fields
    const fields = settings.registrationFields as RegistrationFieldDef[];
    const cf = validateCustomFields(fields, input.customFields ?? {});
    if (Object.keys(cf.errors).length) {
      throw new BadRequestException({
        message: Object.values(cf.errors).join('; '),
        fieldErrors: Object.fromEntries(
          Object.entries(cf.errors).map(([k, v]) => [k, [v]]),
        ),
      });
    }

    // Duplicates
    const teamName = input.teamName.trim();
    const dupe = await this.prisma.registration.findFirst({
      where: {
        tournamentId: t.id,
        status: { in: ['PENDING', 'APPROVED', 'WAITLISTED'] },
        OR: [
          ...(dbUser ? [{ userId: dbUser.id }] : []),
          { email: { equals: email, mode: 'insensitive' as const } },
        ],
      },
      select: { id: true, status: true },
    });
    if (dupe) {
      throw new ConflictException({
        message: 'You already have an active registration for this tournament',
        code: 'DUPLICATE',
        registrationId: dupe.id,
        status: dupe.status,
      });
    }
    const nameTaken = await this.prisma.team.findFirst({
      where: { tournamentId: t.id, name: { equals: teamName, mode: 'insensitive' } },
      select: { id: true },
    });
    const nameRegistered = nameTaken
      ? nameTaken
      : await this.prisma.registration.findFirst({
          where: {
            tournamentId: t.id,
            teamName: { equals: teamName, mode: 'insensitive' },
            status: { in: ['PENDING', 'APPROVED', 'WAITLISTED'] },
          },
          select: { id: true },
        });
    if (nameRegistered) {
      throw new ConflictException({
        message: 'That team name is already registered',
        code: 'NAME_TAKEN',
      });
    }

    // Capacity + status
    const fee = settings.entryFeeCents;
    const paymentStatus: PaymentStatus = fee > 0 ? 'UNPAID' : 'FREE';
    let status: RegistrationStatus;
    let waitlistPosition: number | null = null;
    if (approved >= settings.maxParticipants) {
      if (!settings.waitlistEnabled) {
        throw new BadRequestException({ message: 'Tournament is full', code: 'FULL' });
      }
      status = 'WAITLISTED';
      waitlistPosition = await this.nextWaitlistPosition(t.id);
    } else if (settings.autoApproveRegistrations && fee === 0) {
      status = 'APPROVED';
    } else {
      status = 'PENDING';
    }

    const reg = await this.prisma.registration.create({
      data: {
        tournamentId: t.id,
        userId: dbUser?.id ?? null,
        teamName,
        players: players as unknown as Prisma.InputJsonValue,
        email,
        phone: input.phone ?? null,
        countryCode,
        skillLevel: input.skillLevel ?? null,
        customFields: cf.values as Prisma.InputJsonValue,
        waiverAcceptedAt: settings.waiverText && input.acceptWaiver ? new Date() : null,
        status,
        waitlistPosition,
        paymentStatus,
        amountCents: fee,
        currency: settings.currency,
      },
    });

    if (status === 'APPROVED') {
      await this.createTeamForRegistration(reg, settings);
    }

    let checkoutUrl: string | null = null;
    if (fee > 0) {
      checkoutUrl = await this.createCheckoutSession(reg.id, t, settings, email);
    }

    const full = await this.prisma.registration.findUnique({
      where: { id: reg.id },
      include: REGISTRATION_INCLUDE,
    });

    await this.notifyRegistrant(reg, t, 'received');
    await this.notifyManagersReceived(reg, t);
    this.realtime.emitBracketUpdated(t.id);

    return { registration: full, checkoutUrl };
  }

  private async createCheckoutSession(
    registrationId: string,
    t: { id: string; slug: string; name: string },
    settings: TournamentSettings,
    email: string,
  ): Promise<string | null> {
    const stripe = this.getStripe();
    if (!stripe) {
      this.logger.warn('STRIPE_SECRET_KEY not set — entry fee left UNPAID without checkout');
      return null;
    }
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: settings.currency.toLowerCase(),
              unit_amount: settings.entryFeeCents,
              product_data: { name: `Entry fee — ${t.name}` },
            },
          },
        ],
        metadata: { type: 'registration', registrationId, tournamentId: t.id },
        success_url: `${this.appUrl()}/t/${t.slug}/register?paid=1&registration=${registrationId}`,
        cancel_url: `${this.appUrl()}/t/${t.slug}/register?cancelled=1&registration=${registrationId}`,
      });
      await this.prisma.registration.update({
        where: { id: registrationId },
        data: { stripeSessionId: session.id },
      });
      return session.url ?? null;
    } catch (err) {
      this.logger.warn(`Stripe checkout failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Retry checkout for an unpaid registration (owner or manager). */
  async checkoutUrl(slug: string, registrationId: string, user: ReqUser) {
    const t = await this.loadBySlug(slug);
    const reg = await this.prisma.registration.findFirst({
      where: { id: registrationId, tournamentId: t.id },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    const canManage = user ? await this.access.canManageTournament(t.id, user.id) : false;
    if (!canManage && (!user || reg.userId !== user.id)) {
      throw new ForbiddenException();
    }
    if (reg.paymentStatus !== 'UNPAID') {
      return { checkoutUrl: null, paymentStatus: reg.paymentStatus };
    }
    const settings = this.settingsOf(t);
    const url = await this.createCheckoutSession(reg.id, t, settings, reg.email ?? user?.email ?? '');
    return { checkoutUrl: url, paymentStatus: reg.paymentStatus };
  }

  /** Public status lookup for the success page (email masked). */
  async statusById(slug: string, registrationId: string) {
    const t = await this.loadBySlug(slug);
    let reg = await this.prisma.registration.findFirst({
      where: { id: registrationId, tournamentId: t.id },
      include: { team: { select: { id: true, name: true, seed: true, checkedIn: true, withdrawn: true } } },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.paymentStatus === 'UNPAID' && reg.stripeSessionId) {
      const verified = await this.verifyStripePayment(reg.id);
      if (verified) {
        reg = (await this.prisma.registration.findUnique({
          where: { id: reg.id },
          include: { team: { select: { id: true, name: true, seed: true, checkedIn: true, withdrawn: true } } },
        }))!;
      }
    }
    const checkIn = this.checkInWindow(t, this.settingsOf(t));
    return {
      id: reg.id,
      tournament: { id: t.id, slug: t.slug, name: t.name, startAt: t.startAt?.toISOString() ?? null },
      teamName: reg.teamName,
      status: reg.status,
      waitlistPosition: reg.waitlistPosition,
      paymentStatus: reg.paymentStatus,
      amountCents: reg.amountCents,
      currency: reg.currency,
      email: maskEmail(reg.email),
      team: reg.team,
      createdAt: reg.createdAt.toISOString(),
      checkIn,
    };
  }

  /** Ask Stripe whether the checkout session was paid; promote if so. Returns true when newly marked PAID. */
  private async verifyStripePayment(registrationId: string): Promise<boolean> {
    const stripe = this.getStripe();
    const reg = await this.prisma.registration.findUnique({ where: { id: registrationId } });
    if (!stripe || !reg?.stripeSessionId || reg.paymentStatus !== 'UNPAID') return false;
    try {
      const session = await stripe.checkout.sessions.retrieve(reg.stripeSessionId);
      if (session.payment_status === 'paid') {
        await this.markPaid(reg.id);
        return true;
      }
    } catch (err) {
      this.logger.warn(`Stripe verify failed: ${(err as Error).message}`);
    }
    return false;
  }

  /** Mark PAID and auto-approve when the host allows it and there is capacity. */
  async markPaid(registrationId: string) {
    const reg = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { tournament: true },
    });
    if (!reg) return null;
    const settings = this.settingsOf(reg.tournament);
    await this.prisma.registration.update({
      where: { id: reg.id },
      data: { paymentStatus: 'PAID' },
    });
    if (reg.status === 'PENDING' && settings.autoApproveRegistrations) {
      const approved = await this.approvedCount(reg.tournamentId);
      if (approved < settings.maxParticipants) {
        await this.transition(reg.id, 'APPROVED', null);
      }
    }
    return this.prisma.registration.findUnique({ where: { id: reg.id }, include: REGISTRATION_INCLUDE });
  }

  async withdrawMine(slug: string, userId: string) {
    const t = await this.loadBySlug(slug);
    const reg = await this.prisma.registration.findFirst({
      where: {
        tournamentId: t.id,
        userId,
        status: { in: ['PENDING', 'APPROVED', 'WAITLISTED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!reg) throw new NotFoundException('You have no active registration for this tournament');
    if (t._count.matches > 0) {
      throw new BadRequestException(
        'The bracket has already started — contact the host to withdraw',
      );
    }
    if (reg.teamId) {
      await this.prisma.team.delete({ where: { id: reg.teamId } }).catch(() => undefined);
    }
    const updated = await this.prisma.registration.update({
      where: { id: reg.id },
      data: { status: 'WITHDRAWN', waitlistPosition: null, teamId: null },
    });
    await this.renumberWaitlist(t.id);
    const ids = await this.managerIds(t.id);
    await this.inbox.notifyMany(ids, {
      type: 'registration_withdrawn',
      title: `${reg.teamName} withdrew`,
      body: `${reg.teamName} withdrew from ${t.name}.`,
      href: `/t/${t.slug}/manage?tab=registrations&sub=approved`,
    });
    this.realtime.emitBracketUpdated(t.id);
    return updated;
  }

  // ---------------------------------------------------------------------
  // Manager
  // ---------------------------------------------------------------------

  async list(tournamentId: string, userId: string, status?: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const statuses = status
      ? status
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter((s): s is RegistrationStatus =>
            (Object.values(RegistrationStatus) as string[]).includes(s),
          )
      : undefined;
    const [items, counts] = await Promise.all([
      this.prisma.registration.findMany({
        where: {
          tournamentId,
          ...(statuses?.length ? { status: { in: statuses } } : {}),
        },
        orderBy: [{ waitlistPosition: 'asc' }, { createdAt: 'asc' }],
        include: REGISTRATION_INCLUDE,
      }),
      this.counts(tournamentId),
    ]);
    return { items, counts };
  }

  private async transition(
    registrationId: string,
    status: 'APPROVED' | 'REJECTED' | 'WAITLISTED' | 'PENDING',
    reviewerId: string | null,
    opts: { force?: boolean } = {},
  ) {
    const reg = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { tournament: true },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    const settings = this.settingsOf(reg.tournament);
    const t = reg.tournament;

    if (reg.status === status && status !== 'APPROVED') {
      return reg;
    }

    if (status === 'APPROVED') {
      if (reg.status !== 'APPROVED' && !opts.force) {
        const approved = await this.approvedCount(t.id);
        if (approved >= settings.maxParticipants) {
          throw new BadRequestException({
            message: `Tournament is full (${settings.maxParticipants} participants). Increase the limit or reject someone first.`,
            code: 'FULL',
          });
        }
      }
      await this.createTeamForRegistration(reg, settings);
    } else {
      await this.removeTeamForRegistration(reg);
    }

    const waitlistPosition =
      status === 'WAITLISTED'
        ? reg.status === 'WAITLISTED' && reg.waitlistPosition
          ? reg.waitlistPosition
          : await this.nextWaitlistPosition(t.id)
        : null;

    const updated = await this.prisma.registration.update({
      where: { id: reg.id },
      data: {
        status,
        waitlistPosition,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        ...(status !== 'APPROVED' ? { teamId: null } : {}),
      },
    });
    await this.renumberWaitlist(t.id);

    const kind =
      status === 'APPROVED'
        ? 'approved'
        : status === 'REJECTED'
          ? 'rejected'
          : status === 'WAITLISTED'
            ? 'waitlisted'
            : 'pending';
    const refreshed = await this.prisma.registration.findUnique({ where: { id: reg.id } });
    if (refreshed && reg.status !== status) {
      await this.notifyRegistrant(refreshed, t, kind);
    }
    this.realtime.emitBracketUpdated(t.id);
    return refreshed ?? updated;
  }

  async review(
    tournamentId: string,
    registrationId: string,
    userId: string,
    input: RegistrationReviewInput,
  ) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const reg = await this.prisma.registration.findFirst({
      where: { id: registrationId, tournamentId },
    });
    if (!reg) throw new NotFoundException('Registration not found');

    const data: Prisma.RegistrationUpdateInput = {};
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus;
    if (Object.keys(data).length) {
      await this.prisma.registration.update({ where: { id: reg.id }, data });
    }
    if (input.status) {
      await this.transition(reg.id, input.status, userId);
    }
    return this.prisma.registration.findUnique({
      where: { id: reg.id },
      include: REGISTRATION_INCLUDE,
    });
  }

  async promoteNext(tournamentId: string, userId: string) {
    const t = await this.access.requireTournamentManager(tournamentId, userId);
    const settings = this.settingsOf(t);
    const approved = await this.approvedCount(tournamentId);
    if (approved >= settings.maxParticipants) {
      throw new BadRequestException({
        message: 'No capacity — increase max participants first',
        code: 'FULL',
      });
    }
    const next = await this.prisma.registration.findFirst({
      where: { tournamentId, status: 'WAITLISTED' },
      orderBy: [{ waitlistPosition: 'asc' }, { createdAt: 'asc' }],
    });
    if (!next) throw new BadRequestException('The waitlist is empty');
    await this.transition(next.id, 'APPROVED', userId);
    return this.prisma.registration.findUnique({
      where: { id: next.id },
      include: REGISTRATION_INCLUDE,
    });
  }

  async approveAllPending(tournamentId: string, userId: string) {
    const t = await this.access.requireTournamentManager(tournamentId, userId);
    const settings = this.settingsOf(t);
    const pending = await this.prisma.registration.findMany({
      where: { tournamentId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    let approvedNow = await this.approvedCount(tournamentId);
    let approved = 0;
    let waitlisted = 0;
    for (const p of pending) {
      if (approvedNow < settings.maxParticipants) {
        await this.transition(p.id, 'APPROVED', userId);
        approvedNow += 1;
        approved += 1;
      } else if (settings.waitlistEnabled) {
        await this.transition(p.id, 'WAITLISTED', userId);
        waitlisted += 1;
      } else {
        break;
      }
    }
    return { approved, waitlisted, remaining: pending.length - approved - waitlisted };
  }

  async manual(tournamentId: string, userId: string, input: RegistrationManualInput) {
    const t = await this.access.requireTournamentManager(tournamentId, userId);
    const settings = this.settingsOf(t);
    const teamName = input.teamName.trim();
    const nameTaken = await this.prisma.team.findFirst({
      where: { tournamentId, name: { equals: teamName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (nameTaken) throw new ConflictException('A participant with that name already exists');

    const email = input.email?.trim().toLowerCase() || null;
    const linkedUser = email
      ? await this.prisma.user.findUnique({ where: { email }, select: { id: true } })
      : null;

    const reg = await this.prisma.registration.create({
      data: {
        tournamentId,
        userId: linkedUser?.id ?? null,
        teamName,
        players: (input.players ?? []).map((p) => ({
          name: p.name.trim(),
          isCaptain: p.isCaptain === true,
        })) as unknown as Prisma.InputJsonValue,
        email,
        phone: input.phone ?? null,
        countryCode: input.countryCode ?? null,
        status: 'APPROVED',
        paymentStatus: settings.entryFeeCents > 0 ? 'UNPAID' : 'FREE',
        amountCents: settings.entryFeeCents,
        currency: settings.currency,
        notes: input.notes ?? null,
        reviewedAt: new Date(),
        reviewedById: userId,
      },
    });
    await this.createTeamForRegistration(reg, settings);
    if (linkedUser) {
      await this.notifyRegistrant({ ...reg, userId: linkedUser.id }, t, 'approved');
    }
    this.realtime.emitBracketUpdated(tournamentId);
    return this.prisma.registration.findUnique({
      where: { id: reg.id },
      include: REGISTRATION_INCLUDE,
    });
  }

  async remove(tournamentId: string, registrationId: string, userId: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const reg = await this.prisma.registration.findFirst({
      where: { id: registrationId, tournamentId },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.teamId) {
      const matches = await this.prisma.match.count({ where: { tournamentId } });
      if (matches > 0) {
        throw new BadRequestException(
          'Bracket already generated; withdraw the participant instead',
        );
      }
      await this.prisma.team.delete({ where: { id: reg.teamId } }).catch(() => undefined);
    }
    await this.prisma.registration.delete({ where: { id: reg.id } });
    await this.renumberWaitlist(tournamentId);
    this.realtime.emitBracketUpdated(tournamentId);
    return { ok: true };
  }

  async reorderWaitlist(tournamentId: string, userId: string, orderedIds: string[]) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const rows = await this.prisma.registration.findMany({
      where: { tournamentId, status: 'WAITLISTED' },
      select: { id: true },
    });
    const valid = new Set(rows.map((r) => r.id));
    const ordered = orderedIds.filter((id) => valid.has(id));
    const rest = rows.map((r) => r.id).filter((id) => !ordered.includes(id));
    const finalOrder = [...ordered, ...rest];
    await this.prisma.$transaction(
      finalOrder.map((id, idx) =>
        this.prisma.registration.update({
          where: { id },
          data: { waitlistPosition: idx + 1 },
        }),
      ),
    );
    return this.list(tournamentId, userId, 'WAITLISTED');
  }

  async verifyPayment(tournamentId: string, registrationId: string, userId: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const reg = await this.prisma.registration.findFirst({
      where: { id: registrationId, tournamentId },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.paymentStatus === 'PAID') {
      return { verified: true, paymentStatus: 'PAID' as const, changed: false };
    }
    if (!reg.stripeSessionId) {
      throw new BadRequestException('No Stripe checkout session is attached to this registration');
    }
    if (!this.getStripe()) {
      throw new BadRequestException('Stripe is not configured on the server');
    }
    const changed = await this.verifyStripePayment(reg.id);
    const fresh = await this.prisma.registration.findUnique({ where: { id: reg.id } });
    return {
      verified: fresh?.paymentStatus === 'PAID',
      paymentStatus: fresh?.paymentStatus ?? reg.paymentStatus,
      changed,
    };
  }

  // ---------------------------------------------------------------------
  // Withdraw / reinstate (Score7)
  // ---------------------------------------------------------------------

  async withdrawTeam(tournamentId: string, teamId: string, userId: string) {
    const t = await this.access.requireTournamentManager(tournamentId, userId);
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId },
      include: { registration: { select: { id: true, status: true } } },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.withdrawn) throw new BadRequestException('Participant already withdrawn');

    await this.prisma.team.update({
      where: { id: team.id },
      data: { withdrawn: true, withdrawnAt: new Date() },
    });

    const open = await this.prisma.match.findMany({
      where: {
        tournamentId,
        status: { not: MatchStatus.COMPLETED },
        isBye: false,
        OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
      },
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
    });

    let forfeits = 0;
    const skipped: string[] = [];
    for (const m of open) {
      // Re-read: earlier forfeits may have advanced opponents into later matches.
      const fresh = await this.prisma.match.findUnique({ where: { id: m.id } });
      if (!fresh || fresh.status === MatchStatus.COMPLETED) continue;
      if (!fresh.homeTeamId || !fresh.awayTeamId) {
        skipped.push(fresh.id);
        continue;
      }
      const forfeitSide = fresh.homeTeamId === team.id ? 'home' : 'away';
      try {
        await this.matches.setResult(
          fresh.id,
          userId,
          matchResultSchema.parse({ isForfeit: true, forfeitSide, force: true }),
        );
        forfeits += 1;
      } catch (err) {
        this.logger.warn(
          `Forfeit for match ${fresh.id} failed: ${(err as Error).message}`,
        );
        skipped.push(fresh.id);
      }
    }

    if (team.registration) {
      await this.prisma.registration.update({
        where: { id: team.registration.id },
        data: { status: 'WITHDRAWN', waitlistPosition: null },
      });
      await this.renumberWaitlist(tournamentId);
      const reg = await this.prisma.registration.findUnique({ where: { id: team.registration.id } });
      if (reg) await this.notifyRegistrant(reg, t, 'withdrawn');
    } else if (team.registeredByUserId) {
      await this.inbox.notify(team.registeredByUserId, {
        type: 'registration_withdrawn',
        title: `Withdrawn from ${t.name}`,
        body: `${team.name} has been withdrawn from ${t.name}.`,
        href: `/t/${t.slug}`,
      });
    }

    this.realtime.emitBracketUpdated(tournamentId);
    return {
      teamId: team.id,
      withdrawn: true,
      forfeitsRecorded: forfeits,
      matchesLeftForProgression: skipped.length,
    };
  }

  async reinstateTeam(tournamentId: string, teamId: string, userId: string) {
    const t = await this.access.requireTournamentManager(tournamentId, userId);
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId },
      include: { registration: { select: { id: true } } },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (!team.withdrawn) throw new BadRequestException('Participant is not withdrawn');

    const forfeitsAfter = await this.prisma.match.count({
      where: {
        tournamentId,
        isForfeit: true,
        status: MatchStatus.COMPLETED,
        OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
        ...(team.withdrawnAt ? { updatedAt: { gte: team.withdrawnAt } } : {}),
      },
    });
    if (forfeitsAfter > 0) {
      throw new BadRequestException(
        'Forfeits were recorded after withdrawal — clear those results before reinstating',
      );
    }

    await this.prisma.team.update({
      where: { id: team.id },
      data: { withdrawn: false, withdrawnAt: null },
    });

    if (team.registration) {
      const settings = this.settingsOf(t);
      const approved = await this.approvedCount(tournamentId);
      // The team already exists, so it is counted in approvedCount only via registration status.
      const status: RegistrationStatus =
        approved < settings.maxParticipants || t.status !== 'DRAFT' ? 'APPROVED' : 'WAITLISTED';
      await this.prisma.registration.update({
        where: { id: team.registration.id },
        data: {
          status,
          teamId: team.id,
          waitlistPosition:
            status === 'WAITLISTED' ? await this.nextWaitlistPosition(tournamentId) : null,
          reviewedAt: new Date(),
          reviewedById: userId,
        },
      });
      const reg = await this.prisma.registration.findUnique({ where: { id: team.registration.id } });
      if (reg) await this.notifyRegistrant(reg, t, status === 'APPROVED' ? 'approved' : 'waitlisted');
    } else if (team.registeredByUserId) {
      await this.inbox.notify(team.registeredByUserId, {
        type: 'registration_approved',
        title: `Reinstated in ${t.name}`,
        body: `${team.name} is back in ${t.name}.`,
        href: `/t/${t.slug}`,
      });
    }

    this.realtime.emitBracketUpdated(tournamentId);
    return { teamId: team.id, withdrawn: false };
  }

  // ---------------------------------------------------------------------
  // Check-in
  // ---------------------------------------------------------------------

  async checkInStatus(slug: string): Promise<CheckInStatus> {
    const t = await this.loadBySlug(slug);
    if (!t.isPublic) throw new NotFoundException('Tournament not found');
    const settings = this.settingsOf(t);
    const window = this.checkInWindow(t, settings);
    const [total, checkedInCount] = await Promise.all([
      this.prisma.team.count({ where: { tournamentId: t.id, withdrawn: false } }),
      this.prisma.team.count({
        where: { tournamentId: t.id, withdrawn: false, checkedIn: true },
      }),
    ]);
    return { ...window, checkedInCount, total };
  }

  /** "Process check-in results early": mark every active team as checked in. */
  async processCheckInEarly(tournamentId: string, userId: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const res = await this.prisma.team.updateMany({
      where: { tournamentId, withdrawn: false, checkedIn: false },
      data: { checkedIn: true, checkedInAt: new Date() },
    });
    this.realtime.emitBracketUpdated(tournamentId);
    return { checkedIn: res.count };
  }
}
