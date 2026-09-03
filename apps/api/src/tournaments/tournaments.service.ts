import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BracketSide,
  MatchStatus,
  TournamentFormat,
  TournamentStatus,
} from '@prisma/client';
import slugify from 'slugify';
import {
  assignTeamsToGroupsWithMode,
  applySeedingOrder,
  expandTwoLeggedGroup,
  expandTwoLeggedKnockout,
  generateDoubleElimination,
  generateGroupsKnockout,
  generateRoundRobin,
  generateSingleElimination,
  generateSwiss,
  planFreeForAll,
  planGrandPrix,
  planLeaderboard,
  planSingleRace,
  planTimeTrial,
  suggestFormats,
  type GeneratedMatch,
  type PlannedEvent,
} from '@bracket/bracket-engine';
import type {
  BulkTeamsInput,
  CreateTournamentInput,
  GenerateBracketInput,
  TournamentSettings,
} from '@bracket/shared';
import {
  DEFAULT_TOURNAMENT_SETTINGS,
  createDrawSeed,
  hashSeed,
  profileForGameName,
  rosterLimits,
  suggestFormatPlans,
  tournamentSettingsSchema,
} from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { JobsService } from '../jobs/jobs.service';
import { BracketRepairService } from '../bracket/bracket-repair.service';
import { canUseBracketPredictions, validatePredictionCustomFields } from './bracket-prediction-policy';

@Injectable()
export class TournamentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly jobs: JobsService,
    private readonly bracketRepair: BracketRepairService,
  ) {}

  async create(userId: string, input: CreateTournamentInput) {
    const settings = tournamentSettingsSchema.parse(input.settings ?? {});
    let slug =
      input.slug?.trim() ||
      slugify(input.name, { lower: true, strict: true }) ||
      'tournament';
    let i = 1;
    const base = slug;
    while (await this.prisma.tournament.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }

    return this.prisma.tournament.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        slug,
        gameId: input.gameId ?? null,
        startAt: input.startAt ? new Date(input.startAt) : null,
        venueType: input.venueType ?? null,
        venueName: input.venueName ?? null,
        venueAddress: input.venueAddress ?? null,
        venueUrl: input.venueUrl ?? null,
        isPublic: input.isPublic ?? true,
        pointsWin: input.pointsWin ?? 3,
        pointsDraw: input.pointsDraw ?? 1,
        allowPercent: input.allowPercent ?? true,
        backgroundImageUrl: input.backgroundImageUrl ?? null,
        logoUrl: input.logoUrl ?? null,
        advancePerGroup: settings.advancePerGroup,
        swissRounds: settings.swissRounds,
        raceCount: settings.raceCount,
        eventCount: settings.eventCount,
        settings,
        createdById: userId,
      },
      include: { game: true },
    });
  }

  listMine(userId: string) {
    return this.prisma.tournament.findMany({
      where: {
        OR: [
          { createdById: userId },
          { admins: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { teams: true, matches: true } },
      },
    });
  }

  async getOwned(id: string, userId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id },
      include: this.fullInclude(),
    });
    if (!t) throw new NotFoundException('Tournament not found');
    if (t.createdById !== userId) throw new ForbiddenException();
    return t;
  }

  async getPublicBySlug(slug: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { slug },
      include: this.fullInclude(),
    });
    if (!t || !t.isPublic) throw new NotFoundException('Tournament not found');
    return t;
  }

  async setTeams(id: string, userId: string, input: BulkTeamsInput) {
    const t = await this.requireOwner(id, userId);
    if (t.status !== TournamentStatus.DRAFT && t.matches.length > 0) {
      throw new BadRequestException(
        'Cannot change teams after bracket is generated',
      );
    }

    const groupNames = [
      ...new Set(
        input.teams
          .map((x) => x.groupName?.trim())
          .filter((x): x is string => !!x),
      ),
    ];

    await this.prisma.$transaction(async (tx) => {
      await tx.standing.deleteMany({ where: { tournamentId: id } });
      await tx.match.deleteMany({ where: { tournamentId: id } });
      await tx.eventResult.deleteMany({ where: { tournamentId: id } });
      await tx.team.deleteMany({ where: { tournamentId: id } });
      await tx.group.deleteMany({ where: { tournamentId: id } });

      const groups =
        groupNames.length > 0
          ? await Promise.all(
              groupNames.map((name, order) =>
                tx.group.create({
                  data: { tournamentId: id, name, order },
                }),
              ),
            )
          : [];

      const groupMap = new Map(groups.map((g) => [g.name, g.id]));

      await tx.team.createMany({
        data: input.teams.map((team, idx) => ({
          tournamentId: id,
          name: team.name,
          seed: idx + 1,
          logoUrl: team.logoUrl ?? null,
          teamPhotoUrl: team.teamPhotoUrl ?? null,
          groupId: team.groupName
            ? (groupMap.get(team.groupName.trim()) ?? null)
            : null,
        })),
      });

      const createdTeams = await tx.team.findMany({
        where: { tournamentId: id },
        orderBy: { seed: 'asc' },
      });
      for (let i = 0; i < createdTeams.length; i++) {
        const players = input.teams[i]?.players ?? [];
        if (players.length) {
          await tx.teamPlayer.createMany({
            data: players.map((entry, order) => {
              const parsed =
                typeof entry === 'string'
                  ? { name: entry, photoUrl: null as string | null, isCaptain: false }
                  : {
                      name: entry.name,
                      photoUrl: entry.photoUrl ?? null,
                      isCaptain: entry.isCaptain ?? false,
                    };
              return {
                teamId: createdTeams[i].id,
                name: parsed.name,
                order,
                photoUrl: parsed.photoUrl,
                isCaptain: parsed.isCaptain,
              };
            }),
          });
        }
      }

      await tx.tournament.update({
        where: { id },
        data: {
          format: null,
          status: TournamentStatus.DRAFT,
        },
      });
    });

    return this.getOwned(id, userId);
  }

  async formatSuggestions(id: string, userId: string) {
    const t = await this.requireOwner(id, userId);
    const gameName = (t as { game?: { name?: string } }).game?.name;
    const profile = gameName ? profileForGameName(gameName) : undefined;
    return suggestFormatPlans(t.teams.length, profile);
  }

  async generate(id: string, userId: string, input: GenerateBracketInput) {
    const t = await this.requireOwner(id, userId);
    if (t.teams.length < 2) {
      throw new BadRequestException('Need at least 2 teams');
    }

    const saved = tournamentSettingsSchema.parse(
      (t as { settings?: unknown }).settings ?? {},
    );
    const settings: TournamentSettings = {
      ...DEFAULT_TOURNAMENT_SETTINGS,
      ...saved,
      ...(input.advancePerGroup != null
        ? { advancePerGroup: input.advancePerGroup }
        : {}),
      ...(input.swissRounds != null ? { swissRounds: input.swissRounds } : {}),
      ...(input.raceCount != null ? { raceCount: input.raceCount } : {}),
      ...(input.eventCount != null ? { eventCount: input.eventCount } : {}),
    };

    let format = input.format as TournamentFormat | undefined;
    if (!format && input.useSavedSettings !== false) {
      if (settings.stageMode === 'TWO_STAGE') {
        format = TournamentFormat.GROUPS_KNOCKOUT;
      } else {
        format = settings.singleStageFormat as TournamentFormat;
      }
    }
    if (!format) {
      throw new BadRequestException('Format is required');
    }

    if (settings.requireCheckIn) {
      const unchecked = t.teams.filter((team) => !team.checkedIn);
      if (unchecked.length > 0) {
        throw new BadRequestException(
          `${unchecked.length} team(s) not checked in — check in all participants before generating`,
        );
      }
    }

    await this.prisma.match.deleteMany({ where: { tournamentId: id } });
    await this.prisma.standing.deleteMany({ where: { tournamentId: id } });
    await this.prisma.eventResult.deleteMany({ where: { tournamentId: id } });

    const orderedTeams = [...t.teams].sort((a, b) => {
      if (settings.seedingMode === 'LIST_ORDER') {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
      return (a.seed ?? 999) - (b.seed ?? 999);
    });

    const seededIds = applySeedingOrder(
      orderedTeams.map((team) => team.id),
      settings.seedingMode,
    );
    const teamById = new Map(orderedTeams.map((team) => [team.id, team]));

    const engineTeams = seededIds.map((id, idx) => {
      const team = teamById.get(id)!;
      return {
        id: team.id,
        name: team.name,
        seed: settings.seedingMode === 'LIST_ORDER' ? idx + 1 : (team.seed ?? idx + 1),
        groupId: team.groupId,
      };
    });

    const genOptions = {
      breakTiesWithPlacement: settings.breakTiesWithPlacement,
      doubleElimBracketReset: settings.doubleElimBracketReset,
      knockoutBestOf: settings.knockoutBestOf,
    };

    let generated: GeneratedMatch[] = [];
    let groupRemap: Map<string, string> | null = null;
    let plannedEvents: PlannedEvent[] = [];
    const swissRounds = settings.swissRounds;
    const raceCount = settings.raceCount;
    const eventCount = settings.eventCount;
    const advancePerGroup = settings.advancePerGroup;
    const meetings = settings.meetingsPerPair;

    if (format === 'ROUND_ROBIN') {
      if (t.groups.length > 0) {
        for (const g of t.groups) {
          const gTeams = engineTeams.filter((x) => x.groupId === g.id);
          for (let m = 0; m < meetings; m++) {
            const rr = generateRoundRobin(gTeams, g.id).map((match, idx) => ({
              ...match,
              key: `${match.key}-leg${m + 1}`,
              round: match.round + m * (gTeams.length - (gTeams.length % 2 === 0 ? 1 : 0) || 1),
              position: match.position + idx * 0,
            }));
            // re-key properly
            generated.push(
              ...generateRoundRobin(gTeams, g.id).map((match) => ({
                ...match,
                key: `${match.key}-leg${m + 1}`,
                round: match.round + m * 100,
              })),
            );
            void rr;
          }
        }
      } else {
        for (let m = 0; m < meetings; m++) {
          generated.push(
            ...generateRoundRobin(engineTeams).map((match) => ({
              ...match,
              key: `${match.key}-leg${m + 1}`,
              round: match.round + m * 100,
            })),
          );
        }
      }
    } else if (format === 'SINGLE_ELIMINATION') {
      generated = generateSingleElimination(engineTeams, genOptions);
    } else if (format === 'DOUBLE_ELIMINATION') {
      generated = generateDoubleElimination(engineTeams, genOptions);
    } else if (format === 'SWISS') {
      generated = generateSwiss(engineTeams, swissRounds);
    } else if (
      format === 'TIME_TRIAL' ||
      format === 'SINGLE_RACE' ||
      format === 'GRAND_PRIX' ||
      format === 'LEADERBOARD' ||
      format === 'FREE_FOR_ALL'
    ) {
      if (format === 'TIME_TRIAL') plannedEvents = planTimeTrial(engineTeams);
      else if (format === 'SINGLE_RACE')
        plannedEvents = planSingleRace(engineTeams);
      else if (format === 'GRAND_PRIX')
        plannedEvents = planGrandPrix(engineTeams, raceCount);
      else if (format === 'FREE_FOR_ALL')
        plannedEvents = planFreeForAll(engineTeams);
      else
        plannedEvents = planLeaderboard(engineTeams, eventCount);
    } else if (format === 'GROUPS_KNOCKOUT') {
      const perGroup = settings.participantsPerGroup;
      const groupCount =
        input.groupCount ??
        (t.groups.length > 0
          ? t.groups.length
          : Math.max(2, Math.ceil(t.teams.length / perGroup)));

      if (t.groups.length === 0) {
        const drawSeed = settings.auditableDraw
          ? createDrawSeed(id, 'group-draw')
          : undefined;
        const assigned = assignTeamsToGroupsWithMode(
          engineTeams,
          groupCount,
          settings.groupDrawMode ?? 'SERPENTINE',
          drawSeed,
        );
        if (drawSeed) {
          await this.prisma.tournament.update({
            where: { id },
            data: {
              settings: {
                ...settings,
                drawSeed,
                drawAuditLog: [
                  ...(settings.drawAuditLog ?? []),
                  {
                    at: new Date().toISOString(),
                    operation: 'group-draw',
                    seed: drawSeed,
                    seedHash: hashSeed(drawSeed),
                    inputOrder: engineTeams.map((t) => t.id),
                    outputOrder: assigned.teams.map((t) => t.id),
                  },
                ],
              },
            },
          });
        }
        await this.prisma.group.deleteMany({ where: { tournamentId: id } });
        groupRemap = new Map();
        for (const g of assigned.groups) {
          const created = await this.prisma.group.create({
            data: {
              tournamentId: id,
              name: g.name,
              order: g.order,
            },
          });
          groupRemap.set(g.id, created.id);
        }
        for (const team of assigned.teams) {
          const realGroupId = team.groupId
            ? groupRemap.get(team.groupId)!
            : null;
          await this.prisma.team.update({
            where: { id: team.id },
            data: { groupId: realGroupId },
          });
          team.groupId = realGroupId;
        }
        // Group RR with meetings, then KO by finalStageFormat
        generated = [];
        for (const g of assigned.groups) {
          const gTeams = assigned.teams.filter((x) => x.groupId === g.id);
          const realGid = groupRemap.get(g.id)!;
          if (settings.twoLeggedGroup) {
            const rr = generateRoundRobin(gTeams, realGid).map((match) => ({
              ...match,
              groupId: realGid,
            }));
            generated.push(...expandTwoLeggedGroup(rr));
          } else {
            for (let m = 0; m < meetings; m++) {
              generated.push(
                ...generateRoundRobin(gTeams, realGid).map((match) => ({
                  ...match,
                  groupId: realGid,
                  key: `${match.key}-leg${m + 1}`,
                  round: match.round + m * 100,
                })),
              );
            }
          }
        }
        const finalFmt = settings.finalStageFormat;
        const slots = assigned.groups.length * advancePerGroup;
        const placeholders = Array.from({ length: Math.max(2, slots) }, (_, i) => ({
          id: `tbd-advancer-${i}`,
          name: `Qualifier ${i + 1}`,
          seed: i + 1,
        }));
        let ko: GeneratedMatch[] = [];
        if (finalFmt === 'DOUBLE_ELIMINATION') {
          ko = generateDoubleElimination(placeholders, genOptions).map((m) => ({
            ...m,
            key: m.key.replace(/^(de-|se-)/, 'gk-'),
            homeFromMatchKey: m.homeFromMatchKey?.replace(/^(de-|se-)/, 'gk-') ?? null,
            awayFromMatchKey: m.awayFromMatchKey?.replace(/^(de-|se-)/, 'gk-') ?? null,
            nextMatchKey: m.nextMatchKey?.replace(/^(de-|se-)/, 'gk-') ?? null,
            homeTeamId: null,
            awayTeamId: null,
          }));
        } else if (finalFmt === 'ROUND_ROBIN' || finalFmt === 'SWISS') {
          // Final stage RR/Swiss is created after group stage completes
          ko = [];
        } else {
          ko = generateSingleElimination(placeholders, genOptions).map((m) => ({
            ...m,
            key: m.key.replace(/^se-/, 'gk-'),
            homeFromMatchKey: m.homeFromMatchKey?.replace(/^se-/, 'gk-') ?? null,
            awayFromMatchKey: m.awayFromMatchKey?.replace(/^se-/, 'gk-') ?? null,
            nextMatchKey: m.nextMatchKey?.replace(/^se-/, 'gk-') ?? null,
            homeTeamId: null,
            awayTeamId: null,
            isBye: false,
          }));
        }
        // rebuild next pointers
        const byKey = new Map(ko.map((m) => [m.key, m]));
        for (const m of ko) {
          m.nextMatchKey = null;
          m.nextMatchSlot = null;
        }
        for (const m of ko) {
          if (m.homeFromMatchKey && byKey.get(m.homeFromMatchKey)) {
            byKey.get(m.homeFromMatchKey)!.nextMatchKey = m.key;
            byKey.get(m.homeFromMatchKey)!.nextMatchSlot = 'home';
          }
          if (m.awayFromMatchKey && byKey.get(m.awayFromMatchKey)) {
            byKey.get(m.awayFromMatchKey)!.nextMatchKey = m.key;
            byKey.get(m.awayFromMatchKey)!.nextMatchSlot = 'away';
          }
        }
        generated.push(...ko);
      } else {
        generated = [];
        for (const g of t.groups) {
          const gTeams = engineTeams.filter((x) => x.groupId === g.id);
          for (let m = 0; m < meetings; m++) {
            generated.push(
              ...generateRoundRobin(gTeams, g.id).map((match) => ({
                ...match,
                key: `${match.key}-leg${m + 1}`,
                round: match.round + m * 100,
              })),
            );
          }
        }
        const result = generateGroupsKnockout(
          engineTeams,
          t.groups.length,
          advancePerGroup,
        );
        generated.push(...result.matches.filter((m) => m.key.startsWith('gk-')));
      }
    }

    if (settings.twoLeggedKnockout) {
      generated = expandTwoLeggedKnockout(generated);
    }

    const keyToId = new Map<string, string>();
    for (const m of generated) {
      const isPlaceholder =
        (m.homeTeamId?.startsWith('tbd-') ?? false) ||
        (m.awayTeamId?.startsWith('tbd-') ?? false);
      const created = await this.prisma.match.create({
        data: {
          tournamentId: id,
          key: m.key,
          round: m.round,
          position: m.position,
          bracketSide: m.bracketSide as BracketSide,
          groupId: m.groupId ?? null,
          homeTeamId: isPlaceholder
            ? null
            : (m.homeTeamId && !m.homeTeamId.startsWith('__')
                ? m.homeTeamId
                : null),
          awayTeamId: isPlaceholder
            ? null
            : (m.awayTeamId && !m.awayTeamId.startsWith('__')
                ? m.awayTeamId
                : null),
          isBye: !!m.isBye,
          bestOf: m.bestOf ?? null,
          tieId: m.tieId ?? null,
          legNumber: m.legNumber ?? null,
          status:
            m.homeTeamId &&
            m.awayTeamId &&
            !m.homeTeamId.startsWith('tbd-') &&
            !m.awayTeamId.startsWith('tbd-')
              ? MatchStatus.READY
              : m.isBye
                ? MatchStatus.READY
                : MatchStatus.PENDING,
        },
      });
      keyToId.set(m.key, created.id);
    }

    for (const m of generated) {
      const matchId = keyToId.get(m.key)!;
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          nextMatchId: m.nextMatchKey
            ? (keyToId.get(m.nextMatchKey) ?? null)
            : null,
          nextMatchSlot: m.nextMatchSlot ?? null,
          loserNextMatchId: m.loserNextMatchKey
            ? (keyToId.get(m.loserNextMatchKey) ?? null)
            : null,
          loserNextMatchSlot: m.loserNextMatchSlot ?? null,
        },
      });
    }

    // Resolve byes automatically
    const byeMatches = await this.prisma.match.findMany({
      where: { tournamentId: id, isBye: true },
    });
    for (const bye of byeMatches) {
      const winnerId = bye.homeTeamId ?? bye.awayTeamId;
      if (!winnerId || !bye.nextMatchId || !bye.nextMatchSlot) continue;
      await this.prisma.match.update({
        where: { id: bye.id },
        data: {
          status: MatchStatus.COMPLETED,
          winnerTeamId: winnerId,
          homeScore: bye.homeTeamId ? 1 : 0,
          awayScore: bye.awayTeamId ? 1 : 0,
        },
      });
      await this.prisma.match.update({
        where: { id: bye.nextMatchId },
        data: {
          ...(bye.nextMatchSlot === 'home'
            ? { homeTeamId: winnerId }
            : { awayTeamId: winnerId }),
        },
      });
    }

    // Mark READY when both teams present
    const all = await this.prisma.match.findMany({ where: { tournamentId: id } });
    for (const m of all) {
      if (
        m.status !== MatchStatus.COMPLETED &&
        m.homeTeamId &&
        m.awayTeamId
      ) {
        await this.prisma.match.update({
          where: { id: m.id },
          data: { status: MatchStatus.READY },
        });
      }
    }

    await this.prisma.tournament.update({
      where: { id },
      data: {
        format: format as TournamentFormat,
        status: TournamentStatus.ACTIVE,
        advancePerGroup,
        swissRounds,
        raceCount,
        eventCount,
        settings,
      },
    });

    if (plannedEvents.length) {
      for (const ev of plannedEvents) {
        for (const teamId of ev.teamIds) {
          await this.prisma.eventResult.create({
            data: {
              tournamentId: id,
              teamId,
              eventKey: ev.eventKey,
              eventIndex: ev.eventIndex,
              eventLabel: ev.eventLabel,
              value: 0,
              status: MatchStatus.READY,
            },
          });
        }
      }
    }

    await this.jobs.recomputeStandings(id);
    this.realtime.emitBracketUpdated(id);

    return this.getOwned(id, userId);
  }

  async update(
    id: string,
    userId: string,
    input: import('@bracket/shared').UpdateTournamentInput,
  ) {
    const venueKeys = [
      'venueType',
      'venueName',
      'venueAddress',
      'venueUrl',
    ] as const;
    const definedKeys = (
      Object.keys(input) as Array<keyof typeof input>
    ).filter((k) => input[k] !== undefined);
    const venueOnly =
      definedKeys.length > 0 &&
      definedKeys.every((k) => venueKeys.includes(k as (typeof venueKeys)[number]));

    if (venueOnly) {
      await this.requireManage(id, userId);
    } else {
      await this.requireOwner(id, userId);
    }
    const existing = await this.prisma.tournament.findUnique({ where: { id } });
    const mergedSettings = tournamentSettingsSchema.parse({
      ...((existing?.settings as object) ?? {}),
      ...(input.settings ?? {}),
    });

    let slug = input.slug;
    if (slug) {
      let candidate = slug;
      let i = 1;
      while (
        await this.prisma.tournament.findFirst({
          where: { slug: candidate, NOT: { id } },
        })
      ) {
        candidate = `${slug}-${i++}`;
      }
      slug = candidate;
    }

    return this.prisma.tournament.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(slug ? { slug } : {}),
        ...(input.gameId !== undefined ? { gameId: input.gameId } : {}),
        ...(input.startAt !== undefined
          ? { startAt: input.startAt ? new Date(input.startAt) : null }
          : {}),
        ...(input.venueType !== undefined ? { venueType: input.venueType } : {}),
        ...(input.venueName !== undefined ? { venueName: input.venueName } : {}),
        ...(input.venueAddress !== undefined
          ? { venueAddress: input.venueAddress }
          : {}),
        ...(input.venueUrl !== undefined ? { venueUrl: input.venueUrl } : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
        ...(input.pointsWin !== undefined ? { pointsWin: input.pointsWin } : {}),
        ...(input.pointsDraw !== undefined
          ? { pointsDraw: input.pointsDraw }
          : {}),
        ...(input.allowPercent !== undefined
          ? { allowPercent: input.allowPercent }
          : {}),
        ...(input.backgroundImageUrl !== undefined
          ? { backgroundImageUrl: input.backgroundImageUrl }
          : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        settings: mergedSettings,
        advancePerGroup: mergedSettings.advancePerGroup,
        swissRounds: mergedSettings.swissRounds,
        raceCount: mergedSettings.raceCount,
        eventCount: mergedSettings.eventCount,
      },
      include: this.fullInclude(),
    });
  }

  async remove(id: string, userId: string) {
    await this.requireOwner(id, userId);
    await this.prisma.tournament.delete({ where: { id } });
    return { ok: true };
  }

  async updateTeamMedia(
    id: string,
    teamId: string,
    userId: string,
    input: import('@bracket/shared').TeamRosterInput,
  ) {
    await this.requireManage(id, userId);
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    const settings = tournamentSettingsSchema.parse(tournament.settings ?? {});
    const limits = rosterLimits(settings);

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId: id },
    });
    if (!team) throw new NotFoundException('Team not found');

    const hasBracket =
      (await this.prisma.match.count({ where: { tournamentId: id } })) > 0;
    const rosterLocked = settings.lockRosterAfterGenerate && hasBracket;

    if (rosterLocked && input.players?.length) {
      for (const p of input.players) {
        if (p.delete) {
          throw new BadRequestException(
            'Roster is locked after bracket generation',
          );
        }
        if (!p.id) {
          throw new BadRequestException(
            'Roster is locked after bracket generation',
          );
        }
        if (!settings.playerNamesEditable && p.name !== undefined) {
          throw new BadRequestException(
            'Player names are locked for this tournament',
          );
        }
        if (p.isSub !== undefined || p.isCaptain !== undefined) {
          throw new BadRequestException(
            'Roster is locked after bracket generation',
          );
        }
      }
    } else if (input.players?.length && !settings.playerNamesEditable) {
      for (const p of input.players) {
        if (p.id && p.name !== undefined) {
          throw new BadRequestException(
            'Player names are locked for this tournament',
          );
        }
      }
    }

    await this.prisma.team.update({
      where: { id: teamId },
      data: {
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
        ...(input.teamPhotoUrl !== undefined
          ? { teamPhotoUrl: input.teamPhotoUrl }
          : {}),
        ...(input.fairPlayPoints !== undefined
          ? { fairPlayPoints: input.fairPlayPoints }
          : {}),
      },
    });

    if (input.players?.length) {
      for (const p of input.players) {
        if (p.delete && p.id) {
          await this.prisma.teamPlayer.deleteMany({
            where: { id: p.id, teamId },
          });
          continue;
        }

        if (!p.id && p.name?.trim()) {
          const count = await this.prisma.teamPlayer.count({ where: { teamId } });
          if (count >= limits.maxRoster) {
            throw new BadRequestException(
              settings.allowSubstitutes
                ? `Maximum ${limits.maxRoster} players (${limits.starters} starters + ${limits.substituteSlots} subs)`
                : `Maximum ${limits.maxRoster} players per team`,
            );
          }
          const isSub = p.isSub === true;
          if (isSub && !settings.allowSubstitutes) {
            throw new BadRequestException(
              'Substitute players are not enabled for this tournament',
            );
          }
          const starterCount = await this.prisma.teamPlayer.count({
            where: { teamId, isSub: false },
          });
          if (!isSub && starterCount >= limits.starters) {
            throw new BadRequestException(
              settings.allowSubstitutes
                ? `Starter limit is ${limits.starters} — mark extra players as substitutes`
                : `Starter limit is ${limits.starters}`,
            );
          }
          if (p.isCaptain) {
            await this.prisma.teamPlayer.updateMany({
              where: { teamId },
              data: { isCaptain: false },
            });
          }
          await this.prisma.teamPlayer.create({
            data: {
              teamId,
              name: p.name.trim(),
              order: count,
              photoUrl: p.photoUrl ?? null,
              isCaptain: p.isCaptain ?? false,
              isSub,
            },
          });
          continue;
        }

        if (p.id) {
          if (p.isCaptain) {
            await this.prisma.teamPlayer.updateMany({
              where: { teamId, NOT: { id: p.id } },
              data: { isCaptain: false },
            });
          }
          await this.prisma.teamPlayer.updateMany({
            where: { id: p.id, teamId },
            data: {
              ...(p.name !== undefined ? { name: p.name.trim() } : {}),
              ...(p.photoUrl !== undefined ? { photoUrl: p.photoUrl } : {}),
              ...(p.isCaptain !== undefined ? { isCaptain: p.isCaptain } : {}),
              ...(p.isSub !== undefined ? { isSub: p.isSub } : {}),
            },
          });
        }
      }
    }

    const meta = await this.prisma.tournament.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (!meta) throw new NotFoundException('Tournament not found');
    return this.getBySlugForUser(meta.slug, userId);
  }

  async getDrawAuditBySlug(slug: string) {
    const t = await this.prisma.tournament.findUnique({ where: { slug } });
    if (!t || !t.isPublic) throw new NotFoundException('Tournament not found');
    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    if (!settings.auditableDraw) {
      return { enabled: false, log: [], drawSeed: null };
    }
    return {
      enabled: true,
      log: settings.drawAuditLog ?? [],
      drawSeed: settings.drawSeed ?? null,
    };
  }

  async getBySlugForUser(slug: string, userId?: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { slug },
      include: this.fullInclude(),
    });
    if (!t) throw new NotFoundException('Tournament not found');
    const isOwner = !!(userId && t.createdById === userId);
    const isAdmin = !!(
      userId &&
      t.admins?.some((a) => a.userId === userId)
    );
    const canManage = isOwner || isAdmin;
    if (!t.isPublic && !canManage) {
      throw new NotFoundException('Tournament not found');
    }

    if (canManage) {
      await this.bracketRepair.repairBracketAdvancement(t.id);
    }

    const refreshed = canManage
      ? await this.prisma.tournament.findUnique({
          where: { slug },
          include: this.fullInclude(),
        })
      : t;
    const tournament = refreshed ?? t;

    const settings = tournamentSettingsSchema.parse(tournament.settings ?? {});
    if (settings.hideBracketPreviewPublic && !canManage) {
      return {
        ...tournament,
        matches: [],
        eventResults: [],
        previewHidden: true,
        settings,
        isOwner,
        canManage,
      };
    }

    const hideSeeds = settings.hideSeedNumbers && !canManage;
    const teams = hideSeeds
      ? tournament.teams.map((team) => ({ ...team, seed: null }))
      : tournament.teams;
    const matches = tournament.matches.map((m) => ({
      ...m,
      homeTeam: m.homeTeam
        ? { ...m.homeTeam, seed: hideSeeds ? null : m.homeTeam.seed }
        : m.homeTeam,
      awayTeam: m.awayTeam
        ? { ...m.awayTeam, seed: hideSeeds ? null : m.awayTeam.seed }
        : m.awayTeam,
    }));
    const standings =
      settings.showStandings === false && !canManage ? [] : tournament.standings;

    return {
      ...tournament,
      teams,
      matches,
      standings,
      settings,
      previewHidden: false,
      isOwner,
      canManage,
    };
  }

  async resetBracket(id: string, userId: string) {
    await this.requireOwner(id, userId);
    await this.prisma.match.deleteMany({ where: { tournamentId: id } });
    await this.prisma.eventResult.deleteMany({ where: { tournamentId: id } });
    await this.prisma.standing.deleteMany({ where: { tournamentId: id } });
    await this.prisma.tournament.update({
      where: { id },
      data: { format: null, status: TournamentStatus.DRAFT },
    });
    this.realtime.emitBracketUpdated(id);
    return this.getOwned(id, userId);
  }

  private fullInclude() {
    return {
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
          mvpPlayer: { include: { team: true } },
          playerStats: {
            include: { player: true, team: true },
            orderBy: { mvpScore: 'desc' as const },
          },
        },
      },
      eventResults: {
        orderBy: [
          { eventIndex: 'asc' as const },
          { position: 'asc' as const },
        ],
        include: { team: true },
      },
      standings: {
        orderBy: [{ groupId: 'asc' as const }, { rank: 'asc' as const }],
        include: { team: true, group: true },
      },
      announcements: {
        orderBy: [
          { pinned: 'desc' as const },
          { createdAt: 'desc' as const },
        ],
        include: { author: { select: { id: true, name: true } } },
      },
      admins: {
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      },
    };
  }

  private async requireOwner(id: string, userId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        groups: true,
        teams: true,
        matches: true,
      },
    });
    if (!t) throw new NotFoundException('Tournament not found');
    if (t.createdById !== userId) throw new ForbiddenException();
    return t;
  }

  async requireManage(id: string, userId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id },
      include: { admins: true },
    });
    if (!t) throw new NotFoundException('Tournament not found');
    const allowed =
      t.createdById === userId ||
      t.admins.some((a) => a.userId === userId);
    if (!allowed) throw new ForbiddenException();
    return t;
  }

  async requireManageBySlug(slug: string, userId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { slug },
      include: { admins: true },
    });
    if (!t) throw new NotFoundException('Tournament not found');
    const allowed =
      t.createdById === userId ||
      t.admins.some((a) => a.userId === userId);
    if (!allowed) throw new ForbiddenException();
    return t;
  }

  async listBrowsable() {
    const rows = await this.prisma.tournament.findMany({
      where: { isPublic: true },
      orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        game: { select: { id: true, name: true, category: true } },
        _count: { select: { teams: true, matches: true } },
      },
    });
    return rows.filter((t) => {
      const settings = tournamentSettingsSchema.parse(t.settings ?? {});
      return settings.browsableInIndex !== false;
    });
  }

  async registerForTournament(
    slug: string,
    userId: string,
    input: import('@bracket/shared').TournamentSignupInput,
  ) {
    const t = await this.prisma.tournament.findUnique({
      where: { slug },
      include: { teams: true, matches: true },
    });
    if (!t || !t.isPublic) {
      throw new NotFoundException('Tournament not found');
    }

    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    if (settings.registrationMode !== 'OPEN_SIGNUP') {
      throw new BadRequestException('This tournament is not open for signup');
    }
    if (t.status === TournamentStatus.COMPLETED) {
      throw new BadRequestException('Registration is closed');
    }
    if (t.matches.length > 0) {
      throw new BadRequestException(
        'Registration closed — bracket has already been generated',
      );
    }
    if (t.teams.length >= settings.maxParticipants) {
      throw new BadRequestException('Tournament is full');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (settings.requireVerifiedEmail && !user.emailVerified) {
      throw new BadRequestException('Verify your email before registering');
    }
    if (
      settings.restrictByCountry &&
      settings.allowedCountries.length
    ) {
      if (
        !user.countryCode ||
        !settings.allowedCountries.includes(user.countryCode)
      ) {
        throw new BadRequestException('Registration is restricted for your region');
      }
    }

    const duplicate = t.teams.some(
      (team) => team.name.toLowerCase() === input.teamName.trim().toLowerCase(),
    );
    if (duplicate) {
      throw new BadRequestException('That team name is already registered');
    }

    const limits = rosterLimits(settings);
    if (
      settings.requireTeamRegistration &&
      input.players.length < limits.minRoster
    ) {
      throw new BadRequestException(
        `Provide at least ${limits.minRoster} player name(s)`,
      );
    }
    if (input.players.length > limits.maxRoster) {
      throw new BadRequestException(
        settings.allowSubstitutes
          ? `Maximum ${limits.maxRoster} players (${limits.starters} starters + ${limits.substituteSlots} substitutes)`
          : `Maximum ${limits.maxRoster} players per team`,
      );
    }

    const seed = t.teams.length + 1;
    const team = await this.prisma.team.create({
      data: {
        tournamentId: t.id,
        name: input.teamName.trim(),
        seed,
        registeredByUserId: userId,
      },
    });

    const playerNames =
      input.players.length > 0
        ? input.players
        : settings.playersPerTeam === 1
          ? [user.name]
          : [];

    if (playerNames.length) {
      await this.prisma.teamPlayer.createMany({
        data: playerNames.map((name, order) => ({
          teamId: team.id,
          name: name.trim(),
          order,
          isCaptain: order === 0,
          isSub:
            settings.allowSubstitutes && order >= limits.starters,
        })),
      });
    }

    this.realtime.emitBracketUpdated(t.id);
    return this.getBySlugForUser(slug, userId);
  }

  async checkInTeam(
    tournamentId: string,
    teamId: string,
    userId: string,
    checkedIn: boolean,
  ) {
    await this.requireManage(tournamentId, userId);
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId },
    });
    if (!team) throw new NotFoundException('Team not found');
    await this.prisma.team.update({
      where: { id: teamId },
      data: {
        checkedIn,
        checkedInAt: checkedIn ? new Date() : null,
      },
    });
    this.realtime.emitBracketUpdated(tournamentId);
    return { teamId, checkedIn };
  }

  async checkInSelf(slug: string, userId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { slug },
      include: { teams: true },
    });
    if (!t || !t.isPublic) throw new NotFoundException('Tournament not found');
    const team = t.teams.find((x) => x.registeredByUserId === userId);
    if (!team) {
      throw new BadRequestException('You are not registered for this tournament');
    }
    if (team.checkedIn) {
      throw new BadRequestException('Already checked in');
    }
    await this.prisma.team.update({
      where: { id: team.id },
      data: { checkedIn: true, checkedInAt: new Date() },
    });
    this.realtime.emitBracketUpdated(t.id);
    return this.getBySlugForUser(slug, userId);
  }

  async getBracketPrediction(
    tournamentId: string,
    userId: string | null,
    guestKey?: string,
  ) {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!t) throw new NotFoundException('Tournament not found');
    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    if (!settings.enableBracketPredictions) {
      return { enabled: false, picks: {}, customFields: {} };
    }

    let row = null;
    if (canUseBracketPredictions(settings, userId, guestKey)) {
      if (userId) {
        row = await this.prisma.bracketPrediction.findUnique({
          where: {
            tournamentId_userId: { tournamentId, userId },
          },
        });
      } else if (guestKey) {
        row = await this.prisma.bracketPrediction.findUnique({
          where: {
            tournamentId_guestKey: { tournamentId, guestKey },
          },
        });
      }
    }

    return {
      enabled: true,
      picks: (row?.picks as Record<string, string>) ?? {},
      customFields: (row?.customFields as Record<string, string | number>) ?? {},
      guestName: row?.guestName ?? null,
    };
  }

  async saveBracketPrediction(
    tournamentId: string,
    userId: string | null,
    body: {
      picks: Record<string, string>;
      customFields?: Record<string, string | number>;
      guestKey?: string;
      guestName?: string;
    },
  ) {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!t) throw new NotFoundException('Tournament not found');
    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    if (!settings.enableBracketPredictions) {
      throw new BadRequestException('Bracket predictions are disabled');
    }
    if (t.status === TournamentStatus.COMPLETED) {
      throw new BadRequestException('Predictions are closed');
    }

    let customFields: Record<string, string | number> = {};
    try {
      customFields = validatePredictionCustomFields(settings, body.customFields);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    if (userId) {
      await this.prisma.bracketPrediction.upsert({
        where: {
          tournamentId_userId: { tournamentId, userId },
        },
        create: {
          tournamentId,
          userId,
          picks: body.picks,
          customFields,
        },
        update: {
          picks: body.picks,
          customFields,
        },
      });
    } else if (canUseBracketPredictions(settings, null, body.guestKey)) {
      await this.prisma.bracketPrediction.upsert({
        where: {
          tournamentId_guestKey: { tournamentId, guestKey: body.guestKey! },
        },
        create: {
          tournamentId,
          guestKey: body.guestKey!,
          guestName: body.guestName ?? 'Guest',
          picks: body.picks,
          customFields,
        },
        update: {
          picks: body.picks,
          customFields,
          guestName: body.guestName ?? 'Guest',
        },
      });
    } else {
      throw new BadRequestException('Sign in or enable anonymous predictions');
    }

    return { ok: true, picks: body.picks };
  }
}
