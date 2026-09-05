import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';

import { MatchStatus, TournamentFormat, TournamentStatus } from '@prisma/client';

import {

  computeEventStandings,

  computeFinalPlacements,

  computeFreeForAllStandings,

  computeStandings,

  generateRoundRobin,

  generateSwiss,

  pairSwissRound,

  pickGroupAdvancers,

  pickGroupAdvancersWithBestThirdsDetailed,

  seedKnockoutRound1,

} from '@bracket/bracket-engine';

import { tournamentSettingsSchema, type RankBy } from '@bracket/shared';

import { PrismaService } from '../prisma/prisma.service';

import { RealtimeGateway } from '../realtime/realtime.gateway';

import { JobsService } from '../jobs/jobs.service';

import { BracketRepairService } from '../bracket/bracket-repair.service';

import { computeCricketNrrByTeam } from '../cricket/cricket-nrr.util';



@Injectable()

export class StandingsService {

  private readonly logger = new Logger(StandingsService.name);



  constructor(

    private readonly prisma: PrismaService,

    private readonly realtime: RealtimeGateway,

    @Inject(forwardRef(() => JobsService))

    private readonly jobs: JobsService,

    private readonly bracketRepair: BracketRepairService,

  ) {}



  async recompute(tournamentId: string) {

    const tournament = await this.prisma.tournament.findUnique({

      where: { id: tournamentId },

      include: {

        teams: true,

        matches: { include: { cricketMatch: { include: { innings: true } } } },

        groups: true,

        eventResults: true,

      },

    });

    if (!tournament) return null;



    const settings = tournamentSettingsSchema.parse(tournament.settings ?? {});



    const eventFormats: TournamentFormat[] = [

      TournamentFormat.TIME_TRIAL,

      TournamentFormat.SINGLE_RACE,

      TournamentFormat.GRAND_PRIX,

      TournamentFormat.LEADERBOARD,

      TournamentFormat.FREE_FOR_ALL,

    ];



    let rows;

    if (tournament.format && eventFormats.includes(tournament.format)) {

      if (tournament.format === TournamentFormat.FREE_FOR_ALL) {

        rows = computeFreeForAllStandings(

          tournament.teams.map((t) => ({

            id: t.id,

            name: t.name,

            groupId: t.groupId,

          })),

          tournament.eventResults.map((r) => ({

            teamId: r.teamId,

            value: r.value,

            points: r.points,

            position: r.position,

            status: r.status,

          })),

        );

      } else {

        const mode =

          tournament.format === TournamentFormat.TIME_TRIAL ? 'time' : 'points';

        rows = computeEventStandings(

          tournament.teams.map((t) => ({

            id: t.id,

            name: t.name,

            groupId: t.groupId,

          })),

          tournament.eventResults.map((r) => ({

            teamId: r.teamId,

            value: r.value,

            points: r.points,

            position: r.position,

            status: r.status,

          })),

          mode,

        );

      }

    } else {

      const cricketData = tournament.matches

        .map((m) => m.cricketMatch)

        .filter((c): c is NonNullable<typeof c> => !!c);

      const netRunRateByTeam =

        cricketData.length > 0

          ? computeCricketNrrByTeam(

              tournament.teams.map((t) => t.id),

              cricketData.map((c) => ({

                ballsPerOver: c.ballsPerOver,

                match: tournament.matches.find((m) => m.id === c.matchId) ?? null,

                innings: c.innings.map((i) => ({

                  battingTeamId: i.battingTeamId,

                  runs: i.runs,

                  legalBalls: i.legalBalls,

                  isSuperOver: i.isSuperOver,

                })),

              })),

            )

          : undefined;

      const adjustmentRows = await this.prisma.standingAdjustment.findMany({
        where: { tournamentId },
      });
      const adjustments = new Map<string, number>();
      for (const a of adjustmentRows) {
        adjustments.set(a.teamId, (adjustments.get(a.teamId) ?? 0) + a.points);
      }

      // Chronological order matters for the form column; byes are not results.
      const leagueMatches = tournament.matches
        .filter((m) => !m.isBye)
        .sort((a, b) => a.round - b.round || a.position - b.position);

      rows = computeStandings(
        tournament.teams.map((t) => ({
          id: t.id,
          name: t.name,
          groupId: t.groupId,
          fairPlayPoints: t.fairPlayPoints,
        })),
        leagueMatches.map((m) => ({
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          winnerTeamId: m.winnerTeamId,
          isDraw: m.isDraw,
          isNoResult: m.isNoResult,
          status: m.status,
          groupId: m.groupId,
          homeSetsWon: m.homeSetsWon,
          awaySetsWon: m.awaySetsWon,
        })),
        tournament.pointsWin,
        tournament.pointsDraw,
        {
          rankBy: settings.rankBy as RankBy,
          pointsLoss: settings.pointsLoss ?? 0,
          criteria: settings.standingsCriteria?.length
            ? settings.standingsCriteria
            : undefined,
          adjustments,
          useHeadToHead: settings.useHeadToHead,
          enableToss: settings.enableToss,
          useBuchholz: settings.useBuchholzSwiss,
          useFairPlay: settings.useFairPlayTiebreaker,
          tossSeed: tournamentId,
          netRunRateByTeam,
        },
      );

      // Knockout formats: once the bracket has a champion, rank by placement.
      const knockoutFormats: TournamentFormat[] = [
        TournamentFormat.SINGLE_ELIMINATION,
        TournamentFormat.DOUBLE_ELIMINATION,
      ];
      const isGroupsKo =
        tournament.format === TournamentFormat.GROUPS_KNOCKOUT &&
        tournament.matches.some(
          (m) => m.bracketSide !== 'GROUP' && m.key.startsWith('gk-'),
        );
      if (
        tournament.format &&
        (knockoutFormats.includes(tournament.format) || isGroupsKo)
      ) {
        const koMatches = tournament.matches.filter(
          (m) => !isGroupsKo || m.bracketSide !== 'GROUP',
        );
        const koTeamIds = isGroupsKo
          ? [
              ...new Set(
                koMatches.flatMap((m) => [m.homeTeamId, m.awayTeamId]).filter(
                  (id): id is string => !!id,
                ),
              ),
            ]
          : tournament.teams.map((t) => t.id);
        if (koTeamIds.length) {
          const placements = computeFinalPlacements({
            format: tournament.format,
            teamIds: koTeamIds,
            matches: koMatches.map((m) => ({
              key: m.key,
              round: m.round,
              bracketSide: m.bracketSide,
              status: m.status,
              homeTeamId: m.homeTeamId,
              awayTeamId: m.awayTeamId,
              winnerTeamId: m.winnerTeamId,
              isBye: m.isBye,
              isDraw: m.isDraw,
              isPlacement: m.isPlacement,
              placementRank: m.placementRank,
              legNumber: m.legNumber,
            })),
          });
          if (placements.championTeamId) {
            const rankByTeam = new Map(
              placements.placements.map((p) => [p.teamId, p.rank]),
            );
            if (isGroupsKo) {
              // Knockout teams rank ahead of everyone eliminated in the groups.
              const koCount = koTeamIds.length;
              const rest = rows
                .filter((r) => !rankByTeam.has(r.teamId))
                .sort((a, b) => a.rank - b.rank || b.points - a.points);
              rest.forEach((r, i) => {
                r.rank = koCount + i + 1;
              });
            }
            for (const r of rows) {
              const rank = rankByTeam.get(r.teamId);
              if (rank != null) r.rank = rank;
            }
          }
        }
      }
    }



    await this.prisma.$transaction(async (tx) => {

      await tx.standing.deleteMany({ where: { tournamentId } });

      if (rows.length) {

        await tx.standing.createMany({

          data: rows.map((r) => ({

            tournamentId,

            teamId: r.teamId,

            groupId: r.groupId,

            played: r.played,

            wins: r.wins,

            losses: r.losses,

            draws: r.draws,

            pointsFor: r.pointsFor,

            pointsAgainst: r.pointsAgainst,

            points: r.points,

            rank: r.rank,

            netRunRate: r.netRunRate ?? null,

            setsWon: r.setsWon ?? 0,

            setsLost: r.setsLost ?? 0,

            adjustments: r.adjustments ?? 0,

            buchholz: r.buchholz ?? null,

            sonnebornBerger: r.sonnebornBerger ?? null,

          })),

        });

      }

    });



    if (tournament.format === TournamentFormat.GROUPS_KNOCKOUT) {

      await this.maybeSeedKnockout(tournamentId);

    }

    await this.bracketRepair.repairBracketAdvancement(tournamentId);

    if (tournament.format === TournamentFormat.SWISS) {

      await this.maybeAdvanceSwiss(tournamentId);

    }



    await this.maybeCompleteTournament(tournamentId);



    const standings = await this.prisma.standing.findMany({

      where: { tournamentId },

      include: { team: true, group: true },

      orderBy: [{ groupId: 'asc' }, { rank: 'asc' }],

    });



    this.realtime.emitStandingsUpdated(tournamentId, standings);

    this.realtime.emitBracketUpdated(tournamentId);

    return standings;

  }



  async maybeAdvanceSwiss(tournamentId: string) {

    const tournament = await this.prisma.tournament.findUnique({

      where: { id: tournamentId },

      include: { matches: true, standings: true, teams: true },

    });

    if (!tournament || tournament.format !== TournamentFormat.SWISS) return false;

    const swissSettings = tournamentSettingsSchema.parse(tournament.settings ?? {});

    // POTS mode pre-generates every round at bracket generation time.
    if (swissSettings.swissMode === 'POTS') return false;

    const maxRound = Math.max(0, ...tournament.matches.map((m) => m.round));

    if (maxRound >= tournament.swissRounds) return false;



    const current = tournament.matches.filter((m) => m.round === maxRound);

    if (!current.length) return false;

    if (!current.every((m) => m.status === MatchStatus.COMPLETED || m.isBye)) {

      return false;

    }



    if (tournament.matches.some((m) => m.round === maxRound + 1)) return false;



    const priorPairs = new Set<string>();

    for (const m of tournament.matches) {

      if (m.homeTeamId && m.awayTeamId) {

        priorPairs.add([m.homeTeamId, m.awayTeamId].sort().join(':'));

      }

    }



    const standingRows =

      tournament.standings.length > 0

        ? tournament.standings

            .sort((a, b) => a.rank - b.rank)

            .map((s) => ({

              teamId: s.teamId,

              played: s.played,

              wins: s.wins,

              losses: s.losses,

              draws: s.draws,

              pointsFor: s.pointsFor,

              pointsAgainst: s.pointsAgainst,

              points: s.points,

              rank: s.rank,

              groupId: s.groupId,

            }))

        : tournament.teams

            .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))

            .map((t, i) => ({

              teamId: t.id,

              played: 0,

              wins: 0,

              losses: 0,

              draws: 0,

              pointsFor: 0,

              pointsAgainst: 0,

              points: 0,

              rank: i + 1,

              groupId: null,

            }));



    const seeds = new Map<string, number>();
    for (const team of tournament.teams) {
      seeds.set(team.id, team.seed ?? 999);
    }

    const colorBalance = new Map<string, number>();
    for (const m of tournament.matches) {
      if (m.bracketSide !== 'SWISS' || m.status !== MatchStatus.COMPLETED) continue;
      if (m.homeTeamId) {
        colorBalance.set(m.homeTeamId, (colorBalance.get(m.homeTeamId) ?? 0) + 1);
      }
      if (m.awayTeamId) {
        colorBalance.set(m.awayTeamId, (colorBalance.get(m.awayTeamId) ?? 0) - 1);
      }
    }

    const next = pairSwissRound(standingRows, maxRound + 1, priorPairs, {
      seeds,
      colorBalance,
      mode: swissSettings.swissPairingMode ?? 'SIMPLE',
    });

    for (const m of next) {

      const created = await this.prisma.match.create({

        data: {

          tournamentId,

          key: m.key,

          round: m.round,

          position: m.position,

          bracketSide: 'SWISS',

          homeTeamId: m.homeTeamId ?? null,

          awayTeamId: m.awayTeamId ?? null,

          isBye: !!m.isBye,

          status:

            m.isBye || (m.homeTeamId && m.awayTeamId)

              ? MatchStatus.READY

              : MatchStatus.PENDING,

        },

      });

      if (m.isBye && m.homeTeamId) {

        await this.prisma.match.update({

          where: { id: created.id },

          data: {

            status: MatchStatus.COMPLETED,

            winnerTeamId: m.homeTeamId,

            homeScore: 1,

            awayScore: 0,

          },

        });

      }

    }

    this.logger.log(`Swiss round ${maxRound + 1} created for ${tournamentId}`);

    this.realtime.emitBracketUpdated(tournamentId);

    return true;

  }

  /** Classic Swiss: explicitly generate the next round (used by the manager endpoint). */
  async generateNextSwissRound(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { matches: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (tournament.format !== TournamentFormat.SWISS) {
      throw new BadRequestException('Tournament is not a Swiss tournament');
    }
    const settings = tournamentSettingsSchema.parse(tournament.settings ?? {});
    if (settings.swissMode === 'POTS') {
      throw new BadRequestException('All rounds are already drawn in pots mode');
    }
    const maxRound = Math.max(0, ...tournament.matches.map((m) => m.round));
    if (maxRound >= tournament.swissRounds) {
      throw new BadRequestException('All Swiss rounds have been generated');
    }
    const current = tournament.matches.filter((m) => m.round === maxRound);
    if (current.some((m) => m.status !== MatchStatus.COMPLETED && !m.isBye)) {
      throw new BadRequestException(
        `Round ${maxRound} still has unfinished matches`,
      );
    }
    const created = await this.maybeAdvanceSwiss(tournamentId);
    return { created, round: created ? maxRound + 1 : maxRound };
  }

  // ---------------------------------------------------------------------
  // Manual standings adjustments
  // ---------------------------------------------------------------------

  listAdjustments(tournamentId: string) {
    return this.prisma.standingAdjustment.findMany({
      where: { tournamentId },
      include: {
        team: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addAdjustment(
    tournamentId: string,
    userId: string,
    input: { teamId: string; groupId?: string | null; points: number; reason: string },
  ) {
    const team = await this.prisma.team.findFirst({
      where: { id: input.teamId, tournamentId },
    });
    if (!team) throw new NotFoundException('Team not found in this tournament');
    const created = await this.prisma.standingAdjustment.create({
      data: {
        tournamentId,
        teamId: input.teamId,
        groupId: input.groupId ?? team.groupId ?? null,
        points: input.points,
        reason: input.reason.trim(),
        createdById: userId,
      },
      include: {
        team: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    await this.recompute(tournamentId);
    return created;
  }

  async removeAdjustment(tournamentId: string, adjustmentId: string) {
    const existing = await this.prisma.standingAdjustment.findFirst({
      where: { id: adjustmentId, tournamentId },
    });
    if (!existing) throw new NotFoundException('Adjustment not found');
    await this.prisma.standingAdjustment.delete({ where: { id: adjustmentId } });
    await this.recompute(tournamentId);
    return { ok: true };
  }



  async maybeSeedKnockout(tournamentId: string) {

    const tournament = await this.prisma.tournament.findUnique({

      where: { id: tournamentId },

      include: {

        groups: { orderBy: { order: 'asc' } },

        matches: true,

        standings: true,

        teams: true,

      },

    });

    if (!tournament || tournament.format !== TournamentFormat.GROUPS_KNOCKOUT) {

      return;

    }



    const settings = tournamentSettingsSchema.parse(tournament.settings ?? {});

    const finalFmt = settings.finalStageFormat;



    const groupMatches = tournament.matches.filter(

      (m) => m.bracketSide === 'GROUP',

    );

    if (!groupMatches.length) return;

    if (!groupMatches.every((m) => m.status === MatchStatus.COMPLETED)) {

      return;

    }



    const standingRows = tournament.standings.map((s) => ({
      teamId: s.teamId,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      points: s.points,
      rank: s.rank,
      groupId: s.groupId,
      fairPlayPoints:
        tournament.teams.find((t) => t.id === s.teamId)?.fairPlayPoints ?? 0,
    }));
    const groupRows = tournament.groups.map((g) => ({
      id: g.id,
      name: g.name,
      order: g.order,
    }));

    let advancers: string[];
    let thirdGroupIndices: number[] | undefined;
    if (settings.advanceBestThirds) {
      const detailed = pickGroupAdvancersWithBestThirdsDetailed(
        standingRows,
        groupRows,
        tournament.advancePerGroup,
        settings.bestThirdsCount ?? 4,
      );
      advancers = detailed.advancers;
      thirdGroupIndices = detailed.thirdGroupIndices;
    } else {
      advancers = pickGroupAdvancers(
        standingRows,
        groupRows,
        tournament.advancePerGroup,
      );
    }



    const anyFinalDone = tournament.matches.some(

      (m) =>

        m.bracketSide !== 'GROUP' && m.status === MatchStatus.COMPLETED,

    );

    if (anyFinalDone) return;



    if (finalFmt === 'ROUND_ROBIN' || finalFmt === 'SWISS') {

      const existingFinal = tournament.matches.filter(

        (m) => m.bracketSide !== 'GROUP' && m.key.startsWith('final-'),

      );

      if (existingFinal.length) return;



      const advancerTeams = advancers.map((id, i) => ({

        id,

        name: tournament.teams.find((t) => t.id === id)?.name ?? `Team ${i + 1}`,

        seed: i + 1,

      }));



      const generated =

        finalFmt === 'ROUND_ROBIN'

          ? generateRoundRobin(advancerTeams).map((m) => ({

              ...m,

              key: m.key.replace(/^rr-/, 'final-rr-'),

              bracketSide: 'FINAL' as const,

              groupId: null,

            }))

          : generateSwiss(advancerTeams, settings.swissRounds).map((m) => ({

              ...m,

              key: m.key.replace(/^swiss-/, 'final-swiss-'),

              bracketSide: 'SWISS' as const,

            }));



      for (const m of generated) {

        await this.prisma.match.create({

          data: {

            tournamentId,

            key: m.key,

            round: m.round,

            position: m.position,

            bracketSide: m.bracketSide,

            homeTeamId: m.homeTeamId ?? null,

            awayTeamId: m.awayTeamId ?? null,

            isBye: !!m.isBye,

            status:

              m.isBye || (m.homeTeamId && m.awayTeamId)

                ? MatchStatus.READY

                : MatchStatus.PENDING,

          },

        });

      }

      this.logger.log(`Final ${finalFmt} stage created for ${tournamentId}`);

      return;

    }



    const koR1 = tournament.matches.filter(

      (m) => m.bracketSide !== 'GROUP' && m.round === 1 && m.key.startsWith('gk-'),

    );

    if (!koR1.length) return;

    if (koR1.every((m) => m.homeTeamId && m.awayTeamId)) return;



    const seeds = seedKnockoutRound1(

      koR1.map((m) => ({

        id: m.id,

        position: m.position,

        homeTeamId: m.homeTeamId,

        awayTeamId: m.awayTeamId,

      })),

      advancers,

      tournament.groups.length,

      tournament.advancePerGroup,

      thirdGroupIndices,

    );



    for (const seed of seeds) {

      const both = seed.homeTeamId && seed.awayTeamId;

      const one = seed.homeTeamId || seed.awayTeamId;

      await this.prisma.match.update({

        where: { id: seed.matchId },

        data: {

          homeTeamId: seed.homeTeamId,

          awayTeamId: seed.awayTeamId,

          status: both || one ? MatchStatus.READY : MatchStatus.PENDING,

          isBye: !!(one && !both),

        },

      });



      if (one && !both) {

        const m = await this.prisma.match.findUnique({

          where: { id: seed.matchId },

        });

        if (m?.nextMatchId && m.nextMatchSlot) {

          const winnerId = seed.homeTeamId ?? seed.awayTeamId;

          await this.prisma.match.update({

            where: { id: seed.matchId },

            data: {

              status: MatchStatus.COMPLETED,

              winnerTeamId: winnerId,

              homeScore: seed.homeTeamId ? 1 : 0,

              awayScore: seed.awayTeamId ? 1 : 0,

            },

          });

          await this.prisma.match.update({

            where: { id: m.nextMatchId },

            data: {

              ...(m.nextMatchSlot === 'home'

                ? { homeTeamId: winnerId }

                : { awayTeamId: winnerId }),

            },

          });

          const next = await this.prisma.match.findUnique({

            where: { id: m.nextMatchId },

          });

          if (next?.homeTeamId && next?.awayTeamId) {

            await this.prisma.match.update({

              where: { id: m.nextMatchId },

              data: { status: MatchStatus.READY },

            });

          }

        }

      }

    }



    this.logger.log(`Seeded KO for tournament ${tournamentId}`);

  }



  async maybeCompleteTournament(tournamentId: string) {

    const tournament = await this.prisma.tournament.findUnique({

      where: { id: tournamentId },

      include: { matches: true, eventResults: true },

    });

    if (!tournament) return;



    const eventFormats = [

      TournamentFormat.TIME_TRIAL,

      TournamentFormat.SINGLE_RACE,

      TournamentFormat.GRAND_PRIX,

      TournamentFormat.LEADERBOARD,

      TournamentFormat.FREE_FOR_ALL,

    ];



    if (

      tournament.format &&

      (eventFormats as TournamentFormat[]).includes(tournament.format)

    ) {

      if (

        tournament.eventResults.length &&

        tournament.eventResults.every((r) => r.status === MatchStatus.COMPLETED)

      ) {

        await this.prisma.tournament.update({

          where: { id: tournamentId },

          data: { status: TournamentStatus.COMPLETED },

        });

      }

      return;

    }



    const matches = tournament.matches;

    if (!matches.length) return;

    if (matches.every((m) => m.status === MatchStatus.COMPLETED)) {

      await this.prisma.tournament.update({

        where: { id: tournamentId },

        data: { status: TournamentStatus.COMPLETED },

      });

      const settings = tournamentSettingsSchema.parse(

        tournament.settings ?? {},

      );

      if (settings.sendFinalResultsEmail) {

        await this.jobs.enqueueWebhook({

          type: 'final_results',

          tournamentId,

          tournamentName: tournament.name,

        });

      }

    }

  }

}


