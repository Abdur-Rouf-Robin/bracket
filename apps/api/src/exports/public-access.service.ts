import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { tournamentSettingsSchema, type TournamentSettings } from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { verifyViewToken } from './view-token.util';

export const EXPORT_INCLUDE = {
  game: true,
  groups: { orderBy: { order: 'asc' as const } },
  teams: {
    orderBy: { seed: 'asc' as const },
    include: { players: { orderBy: { order: 'asc' as const } } },
  },
  matches: {
    orderBy: [
      { bracketSide: 'asc' as const },
      { round: 'asc' as const },
      { position: 'asc' as const },
    ],
    include: {
      homeTeam: true,
      awayTeam: true,
      winnerTeam: true,
      group: true,
      stationRef: true,
    },
  },
  standings: {
    orderBy: [{ groupId: 'asc' as const }, { rank: 'asc' as const }],
    include: { team: true, group: true },
  },
  createdBy: { select: { id: true, name: true, plan: true } },
  community: { select: { id: true, slug: true, name: true } },
};

export type ExportTournament = Prisma.TournamentGetPayload<{
  include: typeof EXPORT_INCLUDE;
}>;
export type ExportMatch = ExportTournament['matches'][number];
export type ExportTeam = ExportTournament['teams'][number];
export type ExportStanding = ExportTournament['standings'][number];

export type ResolvedTournament = {
  tournament: ExportTournament;
  settings: TournamentSettings;
  canManage: boolean;
  /** Plan of the tournament owner (drives branding removal). */
  ownerPlan: 'FREE' | 'PREMIER';
};

/**
 * Resolves a tournament for public/managed export endpoints while enforcing
 * visibility (isPublic) and the optional view password gate.
 */
@Injectable()
export class PublicAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  appUrl(): string {
    return (this.config.get<string>('APP_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  apiUrl(): string {
    return (
      this.config.get<string>('API_URL') ??
      this.config.get<string>('API_PUBLIC_URL') ??
      `http://localhost:${this.config.get<string>('API_PORT') ?? 3001}`
    ).replace(/\/$/, '');
  }

  userIdFromAuthHeader(auth?: string): string | undefined {
    if (!auth?.startsWith('Bearer ')) return undefined;
    try {
      const payload = this.jwt.verify<{ sub: string }>(auth.slice(7));
      return payload.sub;
    } catch {
      return undefined;
    }
  }

  async resolveBySlug(
    slug: string,
    opts: { userId?: string; viewToken?: string | null } = {},
  ): Promise<ResolvedTournament> {
    const t = (await this.prisma.tournament.findUnique({
      where: { slug },
      include: EXPORT_INCLUDE,
    }));
    if (!t) throw new NotFoundException('Tournament not found');
    return this.finish(t, opts);
  }

  async resolveById(
    id: string,
    opts: { userId?: string; viewToken?: string | null } = {},
  ): Promise<ResolvedTournament> {
    const t = (await this.prisma.tournament.findUnique({
      where: { id },
      include: EXPORT_INCLUDE,
    }));
    if (!t) throw new NotFoundException('Tournament not found');
    return this.finish(t, opts);
  }

  /** Manager-only resolution (throws 403 when not allowed). */
  async resolveManaged(id: string, userId: string): Promise<ResolvedTournament> {
    await this.access.requireTournamentManager(id, userId);
    const t = (await this.prisma.tournament.findUnique({
      where: { id },
      include: EXPORT_INCLUDE,
    }));
    if (!t) throw new NotFoundException('Tournament not found');
    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    return {
      tournament: t,
      settings,
      canManage: true,
      ownerPlan: await this.access.userPlan(t.createdById),
    };
  }

  private async finish(
    t: ExportTournament,
    opts: { userId?: string; viewToken?: string | null },
  ): Promise<ResolvedTournament> {
    const canManage = await this.access.canManageTournament(t.id, opts.userId);
    if (!t.isPublic && !canManage) {
      throw new NotFoundException('Tournament not found');
    }
    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    if (
      t.viewPasswordHash &&
      settings.viewPasswordEnabled &&
      !canManage &&
      !verifyViewToken(opts.viewToken, t.slug)
    ) {
      throw new ForbiddenException({
        message: 'This tournament is password protected',
        code: 'PASSWORD_REQUIRED',
        requiresPassword: true,
      });
    }
    return {
      tournament: t,
      settings,
      canManage,
      ownerPlan: await this.access.userPlan(t.createdById),
    };
  }
}
