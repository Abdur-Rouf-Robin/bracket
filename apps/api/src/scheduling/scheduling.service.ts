import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MatchStatus, Prisma, StationStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import {
  dateKeyInZone,
  detectConflicts,
  generateSchedule,
  summarizeSchedule,
  type SchedulableMatch,
  type ScheduleConflict,
} from '@bracket/bracket-engine';
import {
  DEFAULT_SCHEDULE_CONFIG,
  refereeAvailabilityWindowSchema,
  scheduleConfigSchema,
  type AutoScheduleInput,
  type AutoScheduleResponse,
  type BulkShiftInput,
  type MatchResultInput,
  type MatchSlotInput,
  type PublicScheduleResponse,
  type RefereeAvailabilityWindow,
  type RefereeDto,
  type RefereeInput,
  type RefereePortalResponse,
  type RefereeUpdateInput,
  type ScheduleConfigInput,
  type ScheduleConfigResponse,
  type ScheduleMatchDto,
  type ScheduleStationDto,
  type StationInput,
  type StationQueueResponse,
  type StationUpdateInput,
} from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MatchesService } from '../matches/matches.service';

const matchInclude = {
  homeTeam: {
    select: { id: true, name: true, seed: true, logoUrl: true, poolColor: true },
  },
  awayTeam: {
    select: { id: true, name: true, seed: true, logoUrl: true, poolColor: true },
  },
  stationRef: true,
  referee: { select: { id: true, name: true } },
  group: { select: { name: true } },
} satisfies Prisma.MatchInclude;

type MatchRow = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;

const availabilityListSchema = z.array(refereeAvailabilityWindowSchema);

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtime: RealtimeGateway,
    @Inject(forwardRef(() => MatchesService))
    private readonly matches: MatchesService,
  ) {}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private appUrl(): string {
    return (
      this.config.get<string>('APP_URL') ??
      this.config.get<string>('NEXT_PUBLIC_APP_URL') ??
      'http://localhost:3000'
    );
  }

  private async tournamentBySlug(slug: string) {
    const t = await this.prisma.tournament.findUnique({ where: { slug } });
    if (!t) throw new NotFoundException('Tournament not found');
    return t;
  }

  parseConfig(raw: unknown, tournamentTimezone?: string): ScheduleConfigInput {
    const parsed = scheduleConfigSchema.safeParse(raw ?? {});
    const cfg = parsed.success ? parsed.data : { ...DEFAULT_SCHEDULE_CONFIG };
    if (!parsed.success || !(raw as { timezone?: string } | null)?.timezone) {
      cfg.timezone = tournamentTimezone || cfg.timezone || 'UTC';
    }
    return cfg;
  }

  private stationDto(s: {
    id: string;
    name: string;
    status: StationStatus;
    order: number;
    privateDetails?: string | null;
  }, includePrivate: boolean): ScheduleStationDto {
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      order: s.order,
      ...(includePrivate ? { privateDetails: s.privateDetails ?? null } : {}),
    };
  }

  private buildFeederMap(
    rows: { id: string; nextMatchId: string | null; loserNextMatchId: string | null }[],
  ): Map<string, string[]> {
    const feeders = new Map<string, string[]>();
    for (const m of rows) {
      for (const target of [m.nextMatchId, m.loserNextMatchId]) {
        if (!target) continue;
        const list = feeders.get(target);
        if (list) list.push(m.id);
        else feeders.set(target, [m.id]);
      }
    }
    return feeders;
  }

  private toDto(
    m: MatchRow,
    feeders: Map<string, string[]>,
    opts: { includeReferee: boolean; includePrivateStation?: boolean },
  ): ScheduleMatchDto {
    const duration = m.durationMinutes ?? null;
    const endAt =
      m.scheduledAt && duration
        ? new Date(m.scheduledAt.getTime() + duration * 60_000).toISOString()
        : null;
    return {
      id: m.id,
      key: m.key,
      round: m.round,
      position: m.position,
      bracketSide: m.bracketSide,
      groupId: m.groupId,
      groupName: m.group?.name ?? null,
      status: m.status,
      isBye: m.isBye,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      winnerTeamId: m.winnerTeamId,
      isDraw: m.isDraw,
      scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
      endAt,
      durationMinutes: duration,
      stationId: m.stationId,
      station: m.stationRef
        ? this.stationDto(m.stationRef, !!opts.includePrivateStation)
        : null,
      stationLabel: m.station ?? m.stationRef?.name ?? null,
      refereeId: m.refereeId,
      ...(opts.includeReferee ? { referee: m.referee ?? null } : {}),
      feederMatchIds: feeders.get(m.id) ?? [],
    };
  }

  private async loadMatches(tournamentId: string): Promise<MatchRow[]> {
    return this.prisma.match.findMany({
      where: { tournamentId },
      include: matchInclude,
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
    });
  }

  private async conflictsFor(
    tournamentId: string,
    rows?: MatchRow[],
    cfg?: ScheduleConfigInput,
  ): Promise<ScheduleConflict[]> {
    const all = rows ?? (await this.loadMatches(tournamentId));
    let config = cfg;
    if (!config) {
      const t = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { scheduleConfig: true, timezone: true },
      });
      config = this.parseConfig(t?.scheduleConfig, t?.timezone);
    }
    const feeders = this.buildFeederMap(all);
    const scheduled = all
      .filter((m) => m.scheduledAt && m.status !== MatchStatus.COMPLETED && !m.isBye)
      .map((m) => {
        const duration = m.durationMinutes ?? config!.slotMinutes;
        return {
          matchId: m.id,
          startAt: m.scheduledAt!.toISOString(),
          endAt: new Date(m.scheduledAt!.getTime() + duration * 60_000).toISOString(),
          stationId: m.stationId,
          refereeId: m.refereeId,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          feederMatchIds: feeders.get(m.id) ?? [],
        };
      });
    return detectConflicts(scheduled, config.restMinutes ?? config.slotMinutes);
  }

  // -------------------------------------------------------------------------
  // Stations
  // -------------------------------------------------------------------------

  async listStations(tournamentId: string, userId: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    return this.stationsWithCurrent(tournamentId, true);
  }

  private async stationsWithCurrent(tournamentId: string, includePrivate: boolean) {
    const stations = await this.prisma.station.findMany({
      where: { tournamentId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    const current = await this.prisma.match.findMany({
      where: {
        tournamentId,
        status: MatchStatus.READY,
        stationId: { in: stations.map((s) => s.id) },
      },
      include: matchInclude,
      orderBy: [{ scheduledAt: 'asc' }, { round: 'asc' }, { position: 'asc' }],
    });
    const feeders = new Map<string, string[]>();
    const currentByStation = new Map<string, ScheduleMatchDto>();
    for (const m of current) {
      if (m.stationId && !currentByStation.has(m.stationId)) {
        currentByStation.set(
          m.stationId,
          this.toDto(m, feeders, { includeReferee: includePrivate }),
        );
      }
    }
    return stations.map((s) => ({
      ...this.stationDto(s, includePrivate),
      currentMatchId: currentByStation.get(s.id)?.id ?? null,
      currentMatch: currentByStation.get(s.id) ?? null,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async listPublicStations(slug: string, userId?: string | null) {
    const t = await this.tournamentBySlug(slug);
    const canManage = await this.access.canManageTournament(t.id, userId);
    return this.stationsWithCurrent(t.id, canManage);
  }

  async createStation(tournamentId: string, userId: string, input: StationInput) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const count = await this.prisma.station.count({ where: { tournamentId } });
    try {
      const station = await this.prisma.station.create({
        data: {
          tournamentId,
          name: input.name,
          privateDetails: input.privateDetails ?? null,
          status: input.status ?? StationStatus.OPEN,
          order: input.order ?? count,
        },
      });
      this.realtime.emitBracketUpdated(tournamentId);
      return station;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('A station with that name already exists');
      }
      throw e;
    }
  }

  async updateStation(
    tournamentId: string,
    stationId: string,
    userId: string,
    input: StationUpdateInput,
  ) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const existing = await this.prisma.station.findFirst({
      where: { id: stationId, tournamentId },
    });
    if (!existing) throw new NotFoundException('Station not found');
    try {
      const station = await this.prisma.station.update({
        where: { id: stationId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.privateDetails !== undefined
            ? { privateDetails: input.privateDetails }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.order !== undefined ? { order: input.order } : {}),
        },
      });
      if (input.name && input.name !== existing.name) {
        await this.prisma.match.updateMany({
          where: { stationId },
          data: { station: input.name },
        });
      }
      this.realtime.emitBracketUpdated(tournamentId);
      return station;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('A station with that name already exists');
      }
      throw e;
    }
  }

  async deleteStation(tournamentId: string, stationId: string, userId: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const existing = await this.prisma.station.findFirst({
      where: { id: stationId, tournamentId },
    });
    if (!existing) throw new NotFoundException('Station not found');
    await this.prisma.$transaction([
      this.prisma.match.updateMany({
        where: { stationId },
        data: { stationId: null, station: null },
      }),
      this.prisma.station.delete({ where: { id: stationId } }),
    ]);
    this.realtime.emitBracketUpdated(tournamentId);
    return { ok: true };
  }

  async reorderStations(tournamentId: string, userId: string, ids: string[]) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const stations = await this.prisma.station.findMany({
      where: { tournamentId },
      select: { id: true },
    });
    const known = new Set(stations.map((s) => s.id));
    const ordered = ids.filter((id) => known.has(id));
    await this.prisma.$transaction(
      ordered.map((id, order) =>
        this.prisma.station.update({ where: { id }, data: { order } }),
      ),
    );
    this.realtime.emitBracketUpdated(tournamentId);
    return this.stationsWithCurrent(tournamentId, true);
  }

  /**
   * IN_USE if a READY match assigned to the station is due now (no time or a
   * start time in the past); otherwise OPEN. CLOSED stations are left alone.
   */
  async refreshStationStatuses(tournamentId: string) {
    const stations = await this.prisma.station.findMany({
      where: { tournamentId, status: { not: StationStatus.CLOSED } },
      select: { id: true, status: true },
    });
    if (!stations.length) return;
    const now = new Date();
    const live = await this.prisma.match.findMany({
      where: {
        tournamentId,
        status: MatchStatus.READY,
        stationId: { in: stations.map((s) => s.id) },
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
      },
      select: { stationId: true },
    });
    const inUse = new Set(live.map((m) => m.stationId));
    const updates: { id: string; status: StationStatus }[] = [];
    for (const s of stations) {
      const next = inUse.has(s.id) ? StationStatus.IN_USE : StationStatus.OPEN;
      if (next !== s.status) updates.push({ id: s.id, status: next });
    }
    if (updates.length) {
      await this.prisma.$transaction(
        updates.map((u) =>
          this.prisma.station.update({
            where: { id: u.id },
            data: { status: u.status },
          }),
        ),
      );
    }
  }

  // -------------------------------------------------------------------------
  // Referees
  // -------------------------------------------------------------------------

  private parseAvailability(raw: unknown): RefereeAvailabilityWindow[] {
    const parsed = availabilityListSchema.safeParse(raw ?? []);
    return parsed.success ? parsed.data : [];
  }

  private refereeDto(
    r: {
      id: string;
      name: string;
      email: string | null;
      userId: string | null;
      availability: unknown;
      order: number;
      accessTokenHash: string | null;
      createdAt: Date;
      _count?: { matches: number };
    },
  ): RefereeDto {
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      userId: r.userId,
      availability: this.parseAvailability(r.availability),
      order: r.order,
      hasAccessLink: !!r.accessTokenHash,
      assignedCount: r._count?.matches ?? 0,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private async refereeRows(tournamentId: string) {
    const rows = await this.prisma.referee.findMany({
      where: { tournamentId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: { matches: { where: { status: { not: MatchStatus.COMPLETED } } } },
        },
      },
    });
    return rows.map((r) => this.refereeDto(r));
  }

  async listReferees(tournamentId: string, userId: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    return this.refereeRows(tournamentId);
  }

  async createReferee(tournamentId: string, userId: string, input: RefereeInput) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const count = await this.prisma.referee.count({ where: { tournamentId } });
    const r = await this.prisma.referee.create({
      data: {
        tournamentId,
        name: input.name,
        email: input.email ?? null,
        availability: (input.availability ?? []) as Prisma.InputJsonValue,
        order: input.order ?? count,
      },
    });
    return this.refereeDto(r);
  }

  async updateReferee(
    tournamentId: string,
    refereeId: string,
    userId: string,
    input: RefereeUpdateInput,
  ) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const existing = await this.prisma.referee.findFirst({
      where: { id: refereeId, tournamentId },
    });
    if (!existing) throw new NotFoundException('Referee not found');
    const r = await this.prisma.referee.update({
      where: { id: refereeId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.availability !== undefined
          ? { availability: input.availability as Prisma.InputJsonValue }
          : {}),
        ...(input.order !== undefined ? { order: input.order } : {}),
      },
      include: { _count: { select: { matches: true } } },
    });
    return this.refereeDto(r);
  }

  async deleteReferee(tournamentId: string, refereeId: string, userId: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const existing = await this.prisma.referee.findFirst({
      where: { id: refereeId, tournamentId },
    });
    if (!existing) throw new NotFoundException('Referee not found');
    await this.prisma.$transaction([
      this.prisma.match.updateMany({
        where: { refereeId },
        data: { refereeId: null },
      }),
      this.prisma.referee.delete({ where: { id: refereeId } }),
    ]);
    this.realtime.emitBracketUpdated(tournamentId);
    return { ok: true };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Generates a fresh courtside access link (any previous link is revoked). */
  async createRefereeAccessLink(
    tournamentId: string,
    refereeId: string,
    userId: string,
  ) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const existing = await this.prisma.referee.findFirst({
      where: { id: refereeId, tournamentId },
    });
    if (!existing) throw new NotFoundException('Referee not found');
    const token = randomBytes(24).toString('base64url');
    await this.prisma.referee.update({
      where: { id: refereeId },
      data: { accessTokenHash: this.hashToken(token) },
    });
    return { url: `${this.appUrl()}/r/${token}`, token };
  }

  private async refereeByToken(token: string) {
    if (!token || token.length < 8) throw new NotFoundException('Invalid link');
    const referee = await this.prisma.referee.findUnique({
      where: { accessTokenHash: this.hashToken(token) },
      include: {
        tournament: {
          select: {
            id: true,
            slug: true,
            name: true,
            timezone: true,
            format: true,
            status: true,
            createdById: true,
          },
        },
      },
    });
    if (!referee) throw new NotFoundException('Invalid or revoked referee link');
    return referee;
  }

  async refereePortal(token: string): Promise<RefereePortalResponse> {
    const referee = await this.refereeByToken(token);
    const rows = await this.prisma.match.findMany({
      where: { refereeId: referee.id, tournamentId: referee.tournamentId, isBye: false },
      include: matchInclude,
      orderBy: [{ scheduledAt: 'asc' }, { round: 'asc' }, { position: 'asc' }],
    });
    const feeders = new Map<string, string[]>();
    return {
      referee: { id: referee.id, name: referee.name, email: referee.email },
      tournament: {
        id: referee.tournament.id,
        slug: referee.tournament.slug,
        name: referee.tournament.name,
        timezone: referee.tournament.timezone,
        format: referee.tournament.format,
        status: referee.tournament.status,
      },
      matches: rows.map((m) => this.toDto(m, feeders, { includeReferee: true })),
    };
  }

  /**
   * Referee result entry. MatchesService.setResult runs its permission check
   * against a user id; referees are not users, so once we have verified the
   * referee token AND that the match is assigned to this referee, we act on
   * behalf of the tournament owner (createdById).
   */
  async refereeReportResult(token: string, matchId: string, input: MatchResultInput) {
    const referee = await this.refereeByToken(token);
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, tournamentId: true, refereeId: true },
    });
    if (!match || match.tournamentId !== referee.tournamentId) {
      throw new NotFoundException('Match not found');
    }
    if (match.refereeId !== referee.id) {
      throw new ForbiddenException('This match is not assigned to you');
    }
    const result = await this.matches.setResult(
      matchId,
      referee.tournament.createdById,
      input,
    );
    await this.refreshStationStatuses(referee.tournamentId);
    return result;
  }

  // -------------------------------------------------------------------------
  // Schedule config
  // -------------------------------------------------------------------------

  async getScheduleConfig(tournamentId: string, userId: string): Promise<ScheduleConfigResponse> {
    const t = await this.access.requireTournamentManager(tournamentId, userId);
    const [stations, referees] = await Promise.all([
      this.prisma.station.findMany({
        where: { tournamentId },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
      this.refereeRows(tournamentId),
    ]);
    return {
      config: this.parseConfig(t.scheduleConfig, t.timezone),
      stations: stations.map((s) => this.stationDto(s, true)),
      referees,
      timezone: t.timezone,
    };
  }

  async saveScheduleConfig(
    tournamentId: string,
    userId: string,
    input: ScheduleConfigInput,
  ): Promise<ScheduleConfigResponse> {
    await this.access.requireTournamentManager(tournamentId, userId);
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { scheduleConfig: input as unknown as Prisma.InputJsonValue },
    });
    return this.getScheduleConfig(tournamentId, userId);
  }

  // -------------------------------------------------------------------------
  // Auto-schedule
  // -------------------------------------------------------------------------

  async generate(
    tournamentId: string,
    userId: string,
    input: AutoScheduleInput,
  ): Promise<AutoScheduleResponse> {
    const t = await this.access.requireTournamentManager(tournamentId, userId);
    let config = this.parseConfig(t.scheduleConfig, t.timezone);
    if (input.config) {
      const merged = scheduleConfigSchema.safeParse({ ...config, ...input.config });
      if (!merged.success) {
        throw new BadRequestException(merged.error.flatten());
      }
      config = merged.data;
      await this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { scheduleConfig: config as unknown as Prisma.InputJsonValue },
      });
    }
    if (!config.days.length) {
      throw new BadRequestException('Add at least one schedule day first');
    }

    const stationsAll = await this.prisma.station.findMany({
      where: { tournamentId, status: { not: StationStatus.CLOSED } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    const allow = new Set(config.stationIds ?? []);
    const stations =
      allow.size && stationsAll.some((s) => allow.has(s.id))
        ? stationsAll.filter((s) => allow.has(s.id))
        : stationsAll;
    if (!stations.length) {
      throw new BadRequestException('Add at least one open station first');
    }
    const referees = config.useReferees
      ? await this.prisma.referee.findMany({
          where: { tournamentId },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        })
      : [];

    const rows = await this.loadMatches(tournamentId);
    const feeders = this.buildFeederMap(rows);
    const candidates = rows.filter(
      (m) => m.status !== MatchStatus.COMPLETED && !m.isBye,
    );
    const keepExisting = !input.clearExisting && input.keepLocked;
    const schedulable: SchedulableMatch[] = candidates.map((m) => ({
      id: m.id,
      round: m.round,
      position: m.position,
      bracketSide: m.bracketSide,
      groupId: m.groupId,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      isBye: m.isBye,
      feederMatchIds: feeders.get(m.id) ?? [],
      locked:
        keepExisting && m.scheduledAt
          ? {
              startAt: m.scheduledAt.toISOString(),
              stationId: m.stationId,
              refereeId: m.refereeId,
            }
          : null,
    }));

    const result = generateSchedule(schedulable, {
      days: config.days,
      slotMinutes: config.slotMinutes,
      breakMinutes: config.breakMinutes,
      restMinutes: config.restMinutes ?? undefined,
      maxMatchesPerTeamPerDay: config.maxMatchesPerTeamPerDay ?? undefined,
      stationIds: stations.map((s) => s.id),
      referees: referees.map((r) => ({
        id: r.id,
        availability: this.parseAvailability(r.availability),
      })),
      timezone: config.timezone || t.timezone,
      respectRounds: config.respectRounds,
      stageOrder: config.stageOrder,
    });

    const stationName = new Map(stations.map((s) => [s.id, s.name]));
    const lockedIds = new Set(
      schedulable.filter((m) => m.locked).map((m) => m.id),
    );
    const newAssignments = result.assignments.filter((a) => !lockedIds.has(a.matchId));

    if (!input.dryRun) {
      await this.prisma.$transaction(async (tx) => {
        if (input.clearExisting) {
          await tx.match.updateMany({
            where: { tournamentId, status: { not: MatchStatus.COMPLETED } },
            data: {
              scheduledAt: null,
              durationMinutes: null,
              stationId: null,
              station: null,
              refereeId: null,
            },
          });
        }
        for (const a of newAssignments) {
          await tx.match.update({
            where: { id: a.matchId },
            data: {
              scheduledAt: new Date(a.startAt),
              durationMinutes: config.slotMinutes,
              stationId: a.stationId,
              station: stationName.get(a.stationId) ?? null,
              refereeId: a.refereeId ?? null,
            },
          });
        }
      });
      await this.refreshStationStatuses(tournamentId);
      this.realtime.emitBracketUpdated(tournamentId);
    }

    // Preview / response payload with the proposed assignments overlaid.
    const byMatch = new Map(result.assignments.map((a) => [a.matchId, a]));
    const matches = candidates.map((m) => {
      const dto = this.toDto(m, feeders, { includeReferee: true, includePrivateStation: true });
      const a = byMatch.get(m.id);
      if (a) {
        dto.scheduledAt = a.startAt;
        dto.endAt = a.endAt;
        dto.durationMinutes = config.slotMinutes;
        dto.stationId = a.stationId || null;
        const st = stations.find((s) => s.id === a.stationId);
        dto.station = st ? this.stationDto(st, true) : dto.station;
        dto.stationLabel = st?.name ?? dto.stationLabel;
        dto.refereeId = a.refereeId ?? null;
        const ref = referees.find((r) => r.id === a.refereeId);
        dto.referee = ref ? { id: ref.id, name: ref.name } : null;
      }
      return dto;
    });

    return {
      dryRun: input.dryRun,
      assignments: result.assignments,
      unscheduled: result.unscheduled,
      conflicts: result.conflicts,
      summary: summarizeSchedule(
        result.assignments,
        candidates.length,
        config.timezone || t.timezone,
      ),
      matches,
    };
  }

  // -------------------------------------------------------------------------
  // Manual editing
  // -------------------------------------------------------------------------

  async updateMatchSlot(
    tournamentId: string,
    matchId: string,
    userId: string,
    input: MatchSlotInput,
  ) {
    const t = await this.access.requireTournamentManager(tournamentId, userId);
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, tournamentId },
    });
    if (!match) throw new NotFoundException('Match not found');

    const data: Prisma.MatchUncheckedUpdateInput = {};
    if (input.scheduledAt !== undefined) {
      data.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    }
    if (input.durationMinutes !== undefined) {
      data.durationMinutes = input.durationMinutes;
    }
    if (input.stationId !== undefined) {
      if (input.stationId) {
        const station = await this.prisma.station.findFirst({
          where: { id: input.stationId, tournamentId },
        });
        if (!station) throw new BadRequestException('Station not found');
        data.stationId = station.id;
        data.station = station.name;
      } else {
        data.stationId = null;
        data.station = input.station ?? null;
      }
    } else if (input.station !== undefined) {
      data.station = input.station;
    }
    if (input.refereeId !== undefined) {
      if (input.refereeId) {
        const ref = await this.prisma.referee.findFirst({
          where: { id: input.refereeId, tournamentId },
        });
        if (!ref) throw new BadRequestException('Referee not found');
        data.refereeId = ref.id;
      } else {
        data.refereeId = null;
      }
    }

    await this.prisma.match.update({ where: { id: matchId }, data });
    await this.refreshStationStatuses(tournamentId);

    const rows = await this.loadMatches(tournamentId);
    const feeders = this.buildFeederMap(rows);
    const updated = rows.find((m) => m.id === matchId)!;
    const conflicts = await this.conflictsFor(
      tournamentId,
      rows,
      this.parseConfig(t.scheduleConfig, t.timezone),
    );
    const dto = this.toDto(updated, feeders, { includeReferee: true, includePrivateStation: true });
    this.realtime.emitMatchUpdated(tournamentId, dto);
    this.realtime.emitBracketUpdated(tournamentId);
    return { match: dto, conflicts };
  }

  async clearSchedule(tournamentId: string, userId: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const res = await this.prisma.match.updateMany({
      where: { tournamentId, status: { not: MatchStatus.COMPLETED } },
      data: {
        scheduledAt: null,
        durationMinutes: null,
        stationId: null,
        station: null,
        refereeId: null,
      },
    });
    await this.refreshStationStatuses(tournamentId);
    this.realtime.emitBracketUpdated(tournamentId);
    return { ok: true, cleared: res.count };
  }

  async shiftSchedule(tournamentId: string, userId: string, input: BulkShiftInput) {
    const t = await this.access.requireTournamentManager(tournamentId, userId);
    const rows = await this.prisma.match.findMany({
      where: {
        tournamentId,
        status: { not: MatchStatus.COMPLETED },
        scheduledAt: { not: null },
      },
      select: { id: true, scheduledAt: true },
    });
    const targets = rows.filter(
      (m) =>
        m.scheduledAt &&
        (!input.date || dateKeyInZone(m.scheduledAt, t.timezone) === input.date),
    );
    await this.prisma.$transaction(
      targets.map((m) =>
        this.prisma.match.update({
          where: { id: m.id },
          data: {
            scheduledAt: new Date(m.scheduledAt!.getTime() + input.minutes * 60_000),
          },
        }),
      ),
    );
    await this.refreshStationStatuses(tournamentId);
    this.realtime.emitBracketUpdated(tournamentId);
    const conflicts = await this.conflictsFor(tournamentId);
    return { ok: true, shifted: targets.length, conflicts };
  }

  async getConflicts(tournamentId: string, userId: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    return this.conflictsFor(tournamentId);
  }

  // -------------------------------------------------------------------------
  // Public views
  // -------------------------------------------------------------------------

  async publicSchedule(slug: string, userId?: string | null): Promise<PublicScheduleResponse> {
    const t = await this.tournamentBySlug(slug);
    const canManage = await this.access.canManageTournament(t.id, userId);
    const [rows, stations] = await Promise.all([
      this.loadMatches(t.id),
      this.prisma.station.findMany({
        where: { tournamentId: t.id },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    const feeders = this.buildFeederMap(rows);
    const visible = rows.filter((m) => !m.isBye);
    const dtos = visible.map((m) =>
      this.toDto(m, feeders, { includeReferee: canManage, includePrivateStation: canManage }),
    );
    const byDay = new Map<string, ScheduleMatchDto[]>();
    const unscheduled: ScheduleMatchDto[] = [];
    for (const d of dtos) {
      if (!d.scheduledAt) {
        unscheduled.push(d);
        continue;
      }
      const key = dateKeyInZone(d.scheduledAt, t.timezone);
      const list = byDay.get(key);
      if (list) list.push(d);
      else byDay.set(key, [d]);
    }
    const stationOrder = new Map(stations.map((s) => [s.id, s.order]));
    const days = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, matches]) => ({
        date,
        matches: matches.sort(
          (a, b) =>
            Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!) ||
            (stationOrder.get(a.stationId ?? '') ?? 999) -
              (stationOrder.get(b.stationId ?? '') ?? 999) ||
            a.round - b.round ||
            a.position - b.position,
        ),
      }));
    const cfg = this.parseConfig(t.scheduleConfig, t.timezone);
    return {
      tournament: { id: t.id, slug: t.slug, name: t.name, timezone: t.timezone },
      canManage,
      days,
      unscheduled,
      stations: stations.map((s) => this.stationDto(s, canManage)),
      conflicts: canManage ? await this.conflictsFor(t.id, rows, cfg) : [],
    };
  }

  async stationQueue(slug: string, userId?: string | null): Promise<StationQueueResponse> {
    const t = await this.tournamentBySlug(slug);
    const canManage = await this.access.canManageTournament(t.id, userId);
    const [rows, stations] = await Promise.all([
      this.loadMatches(t.id),
      this.prisma.station.findMany({
        where: { tournamentId: t.id },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    const feeders = new Map<string, string[]>();
    const dto = (m: MatchRow) =>
      this.toDto(m, feeders, { includeReferee: canManage, includePrivateStation: canManage });
    const byTime = (a: MatchRow, b: MatchRow) =>
      (a.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
      a.round - b.round ||
      a.position - b.position;

    const entries = stations.map((s) => {
      const mine = rows.filter((m) => m.stationId === s.id && !m.isBye);
      const ready = mine.filter((m) => m.status === MatchStatus.READY).sort(byTime);
      const pending = mine.filter((m) => m.status === MatchStatus.PENDING).sort(byTime);
      const completed = mine
        .filter((m) => m.status === MatchStatus.COMPLETED)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const current = ready[0] ?? null;
      const upNext = [...ready.slice(1), ...pending].slice(0, 3);
      return {
        station: this.stationDto(s, canManage),
        current: current ? dto(current) : null,
        upNext: upNext.map(dto),
        recentlyCompleted: completed.slice(0, 2).map(dto),
      };
    });
    const unassigned = rows
      .filter((m) => m.status === MatchStatus.READY && !m.stationId && !m.isBye)
      .sort(byTime)
      .map(dto);
    return {
      tournament: { id: t.id, slug: t.slug, name: t.name, timezone: t.timezone },
      generatedAt: new Date().toISOString(),
      stations: entries,
      unassigned,
    };
  }

  async teamSchedule(slug: string, teamId: string, userId?: string | null) {
    const t = await this.tournamentBySlug(slug);
    const canManage = await this.access.canManageTournament(t.id, userId);
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId: t.id },
      select: { id: true, name: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    const rows = await this.loadMatches(t.id);
    const feeders = this.buildFeederMap(rows);
    const mine = rows
      .filter((m) => !m.isBye && (m.homeTeamId === teamId || m.awayTeamId === teamId))
      .sort(
        (a, b) =>
          (a.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
            (b.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
          a.round - b.round,
      );
    return {
      tournament: { id: t.id, slug: t.slug, name: t.name, timezone: t.timezone },
      team,
      matches: mine.map((m) =>
        this.toDto(m, feeders, { includeReferee: canManage, includePrivateStation: canManage }),
      ),
    };
  }

  async icsFeed(slug: string): Promise<string> {
    const t = await this.tournamentBySlug(slug);
    const rows = await this.prisma.match.findMany({
      where: { tournamentId: t.id, isBye: false, scheduledAt: { not: null } },
      include: matchInclude,
      orderBy: { scheduledAt: 'asc' },
    });
    const cfg = this.parseConfig(t.scheduleConfig, t.timezone);
    const esc = (s: string) =>
      s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const stamp = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const now = stamp(new Date());
    const link = `${this.appUrl()}/t/${t.slug}`;
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//bracket//schedule//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${esc(t.name)}`,
      `X-WR-TIMEZONE:${esc(t.timezone)}`,
    ];
    for (const m of rows) {
      const start = m.scheduledAt!;
      const end = new Date(
        start.getTime() + (m.durationMinutes ?? cfg.slotMinutes) * 60_000,
      );
      const home = m.homeTeam?.name ?? 'TBD';
      const away = m.awayTeam?.name ?? 'TBD';
      const roundLabel = `${m.bracketSide === 'GROUP' && m.group?.name ? `${m.group.name} · ` : ''}Round ${m.round}`;
      const score =
        m.status === MatchStatus.COMPLETED && m.homeScore != null && m.awayScore != null
          ? ` (${m.homeScore}–${m.awayScore})`
          : '';
      lines.push(
        'BEGIN:VEVENT',
        `UID:${m.id}@bracket`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(start)}`,
        `DTEND:${stamp(end)}`,
        `SUMMARY:${esc(`${home} vs ${away}${score}`)}`,
        ...(m.stationRef?.name || m.station
          ? [`LOCATION:${esc(m.stationRef?.name ?? m.station ?? '')}`]
          : []),
        `DESCRIPTION:${esc(`${t.name} · ${roundLabel}\n${link}`)}`,
        `URL:${link}`,
        `STATUS:${m.status === MatchStatus.COMPLETED ? 'CONFIRMED' : 'TENTATIVE'}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return lines.map(foldIcsLine).join('\r\n') + '\r\n';
  }
}

/** RFC 5545: lines longer than 75 octets are folded with CRLF + space. */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
}
