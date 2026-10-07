import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus, Prisma } from '@prisma/client';
import {
  resolveSetsResult,
  resolveSingleLegKnockoutTie,
  resolveTwoLeggedTie,
  resolveWinnerTeamId,
  validateSeriesResult,
} from '@bracket/bracket-engine';
import type {
  MatchArrivalInput,
  MatchAttachmentInput,
  MatchDisputeInput,
  MatchNoShowInput,
  MatchResultInput,
  MatchScheduleInput,
} from '@bracket/shared';
import { PLANS, gameRuleForGameName, tournamentSettingsSchema, rollupTeamFairPlayFromStats } from '@bracket/shared';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { JobsService } from '../jobs/jobs.service';
import { MvpService } from '../mvp/mvp.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { BracketRepairService } from '../bracket/bracket-repair.service';
import { RankingsService } from '../rankings/rankings.service';
import { InboxService } from '../inbox/inbox.service';

@Injectable()
export class MatchesService {
  private readonly rankingsLogger = new Logger(MatchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly jobs: JobsService,
    private readonly mvp: MvpService,
    private readonly tournaments: TournamentsService,
    private readonly bracketRepair: BracketRepairService,
    private readonly rankings: RankingsService,
    private readonly access: AccessService,
    private readonly inbox: InboxService,
  ) {}

  async setResult(
    matchId: string,
    userId: string | null,
    input: MatchResultInput,
    opts?: { teamId?: string },
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: { include: { game: true } },
        homeTeam: true,
        awayTeam: true,
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (opts?.teamId) {
      await this.assertTeamCanReport(match, opts.teamId);
    } else if (userId) {
      await this.assertCanReportResult(match, userId);
    } else {
      throw new ForbiddenException();
    }
    if (!match.homeTeamId || !match.awayTeamId) {
      throw new BadRequestException('Match teams are not set yet');
    }
    await this.assertActiveTournament(match.tournamentId);

    if (match.status === MatchStatus.COMPLETED && !input.force) {
      throw new BadRequestException(
        'Match already completed. Pass force=true to overwrite (only if later matches are not completed).',
      );
    }

    if (match.status === MatchStatus.COMPLETED && input.force) {
      await this.assertCanOverwrite(match);
    }

    const settings = tournamentSettingsSchema.parse(
      match.tournament.settings ?? {},
    );

    if (input.winnersOnly && !settings.quickAdvanceWinnersOnly) {
      throw new BadRequestException(
        'Winners-only reporting is disabled for this tournament',
      );
    }

    const isElimination =
      match.tournament.format === 'SINGLE_ELIMINATION' ||
      match.tournament.format === 'DOUBLE_ELIMINATION' ||
      (match.tournament.format === 'GROUPS_KNOCKOUT' &&
        match.bracketSide !== 'GROUP');

    if (isElimination && input.isDraw && !match.legNumber && !input.isNoResult) {
      throw new BadRequestException('Draws are not allowed in elimination');
    }

    if (settings.requireCheckIn) {
      if (!match.homeTeam?.checkedIn || !match.awayTeam?.checkedIn) {
        throw new BadRequestException(
          'Both teams must check in before reporting a result',
        );
      }
    }

    const isManager = userId ? await this.manages(match.tournamentId, userId) : false;
    if (
      settings.requireMatchCheckIn &&
      !input.isForfeit &&
      !input.acceptProposal &&
      (!match.homeArrivedAt || !match.awayArrivedAt)
    ) {
      throw new BadRequestException(
        'Both teams must check in at the court before a score is saved',
      );
    }

    if (input.live) {
      if (match.status === MatchStatus.COMPLETED) {
        throw new BadRequestException('This match is already final');
      }
      const live = await this.prisma.match.update({
        where: { id: matchId },
        data: {
          homeScore: input.homeScore,
          awayScore: input.awayScore,
          winnerTeamId: null,
          isDraw: false,
          isForfeit: false,
          status: MatchStatus.IN_PROGRESS,
        },
        include: { homeTeam: true, awayTeam: true, winnerTeam: true },
      });
      this.realtime.emitMatchUpdated(match.tournamentId, live);
      this.realtime.emitBracketUpdated(match.tournamentId);
      return live;
    }

    let homeScore = input.homeScore;
    let awayScore = input.awayScore;
    let isDraw = input.isDraw;
    let winnerTeamId = input.winnerTeamId;
    let isForfeit = input.isForfeit ?? false;

    if (input.isForfeit) {
      if (!input.forfeitSide) {
        throw new BadRequestException('forfeitSide is required when isForfeit is true');
      }
      if (input.isDraw) {
        throw new BadRequestException('Forfeit matches cannot be draws');
      }
      const wScore = settings.forfeitScoreWinner ?? 3;
      const lScore = settings.forfeitScoreLoser ?? 0;
      if (input.forfeitSide === 'home') {
        homeScore = lScore;
        awayScore = wScore;
        winnerTeamId = match.awayTeamId;
      } else {
        homeScore = wScore;
        awayScore = lScore;
        winnerTeamId = match.homeTeamId;
      }
      isDraw = false;
      isForfeit = true;
    }

    const bestOf = match.bestOf ?? settings.knockoutBestOf ?? 1;
    const isKnockoutMatch =
      isElimination ||
      (match.tournament.format === 'GROUPS_KNOCKOUT' &&
        match.bracketSide !== 'GROUP');

    // Set-based scoring (tennis / volleyball style): the sets decide the match,
    // homeScore/awayScore become sets won and the per-set games are kept in `sets`.
    let setData: {
      sets: { home: number; away: number }[];
      homeSetsWon: number;
      awaySetsWon: number;
    } | null = null;
    const useSets =
      settings.setBasedScoring &&
      !input.winnersOnly &&
      !input.isForfeit &&
      !input.isNoResult;
    if (useSets) {
      if (!input.sets?.length) {
        throw new BadRequestException(
          'This tournament uses set-based scoring — enter the score of each set',
        );
      }
      const setsResolved = resolveSetsResult(input.sets, settings.setsBestOf);
      if (!setsResolved.valid) {
        throw new BadRequestException(setsResolved.message ?? 'Invalid set scores');
      }
      homeScore = setsResolved.homeSetsWon;
      awayScore = setsResolved.awaySetsWon;
      winnerTeamId =
        setsResolved.winner === 'home' ? match.homeTeamId : match.awayTeamId;
      isDraw = false;
      setData = {
        sets: input.sets,
        homeSetsWon: setsResolved.homeSetsWon,
        awaySetsWon: setsResolved.awaySetsWon,
      };
    }

    if (isKnockoutMatch && bestOf > 1 && !input.winnersOnly && !input.isForfeit && !useSets) {
      const check = validateSeriesResult({
        homeScore: homeScore,
        awayScore: awayScore,
        bestOf,
      });
      if (!check.valid) {
        throw new BadRequestException(check.message);
      }
    }

    let resolved = resolveWinnerTeamId({
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeScore: input.winnersOnly ? (winnerTeamId === match.homeTeamId ? 1 : 0) : homeScore,
      awayScore: input.winnersOnly ? (winnerTeamId === match.awayTeamId ? 1 : 0) : awayScore,
      isDraw: input.winnersOnly ? false : isDraw,
      winnerTeamId: winnerTeamId,
    });

    const gameRule = gameRuleForGameName(match.tournament.game?.name ?? '');
    if (
      !input.winnersOnly &&
      !resolved.winnerTeamId &&
      resolved.isDraw &&
      gameRule?.matchEntry === 'coc-war' &&
      homeScore === awayScore &&
      input.homePercent != null &&
      input.awayPercent != null &&
      input.homePercent !== input.awayPercent
    ) {
      resolved = {
        winnerTeamId:
          input.homePercent > input.awayPercent
            ? match.homeTeamId
            : match.awayTeamId,
        isDraw: false,
      };
      winnerTeamId = resolved.winnerTeamId;
      isDraw = false;
    }

    if (input.winnersOnly && !resolved.winnerTeamId) {
      throw new BadRequestException('Pick a winner for quick advance');
    }

    const isSingleLegKnockout =
      isKnockoutMatch && !match.legNumber && !input.isForfeit && !input.winnersOnly;

    if (
      isSingleLegKnockout &&
      (resolved.isDraw || !resolved.winnerTeamId) &&
      homeScore === awayScore
    ) {
      const tie = resolveSingleLegKnockoutTie({
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeScore,
        awayScore,
        etHomeScore: input.etHomeScore,
        etAwayScore: input.etAwayScore,
        penHomeScore: input.penHomeScore,
        penAwayScore: input.penAwayScore,
        allowExtraTime: settings.knockoutExtraTime,
        allowPenalties: settings.knockoutPenalties,
      });
      if (tie.winnerTeamId) {
        resolved = {
          ...resolved,
          winnerTeamId: tie.winnerTeamId,
          isDraw: false,
        };
        winnerTeamId = tie.winnerTeamId;
        isDraw = false;
      }
    }

    if (isElimination && (resolved.isDraw || !resolved.winnerTeamId) && !input.isNoResult) {
      throw new BadRequestException(
        'Elimination matches need a winner — enter extra time or penalty scores if regulation ended in a draw',
      );
    }

    if (
      !isElimination &&
      !resolved.isDraw &&
      !resolved.winnerTeamId &&
      homeScore === awayScore
    ) {
      throw new BadRequestException('Provide a winner or mark as draw');
    }

    const acceptingProposal =
      !!input.acceptProposal &&
      (isManager || (!!userId && userId !== match.reportedByUserId));
    if (
      userId &&
      !isManager &&
      settings.confirmSelfReportedScores !== false &&
      !acceptingProposal &&
      !input.live &&
      !input.isForfeit
    ) {
      const proposed = await this.prisma.match.update({
        where: { id: matchId },
        data: {
          homeScore,
          awayScore,
          winnerTeamId: resolved.winnerTeamId,
          isDraw: resolved.isDraw,
          isForfeit: false,
          status: MatchStatus.PROVISIONAL,
          reviewStatus: 'PENDING',
          reviewNote: null,
          reportedByUserId: userId,
          reportedAt: new Date(),
        },
        include: { homeTeam: true, awayTeam: true, winnerTeam: true, tournament: { select: { slug: true, name: true, createdById: true } } },
      });
      const opponentId =
        proposed.homeTeam?.registeredByUserId === userId
          ? proposed.awayTeam?.registeredByUserId
          : proposed.homeTeam?.registeredByUserId;
      const href = `/t/${proposed.tournament.slug}/m/${proposed.id}`;
      if (opponentId) {
        await this.inbox.notify(opponentId, {
          type: 'score_proposed',
          title: `Confirm the score in ${proposed.tournament.name}`,
          body: `${proposed.homeTeam?.name ?? 'Home'} ${homeScore}–${awayScore} ${proposed.awayTeam?.name ?? 'Away'} is waiting for you.`,
          href,
        });
      }
      this.realtime.emitMatchUpdated(match.tournamentId, proposed);
      this.realtime.emitBracketUpdated(match.tournamentId);
      return proposed;
    }

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        homeScore,
        awayScore,
        homePercent: input.homePercent ?? null,
        awayPercent: input.awayPercent ?? null,
        winnerTeamId: resolved.winnerTeamId,
        isDraw: resolved.isDraw,
        isNoResult: input.isNoResult ?? false,
        isForfeit,
        etHomeScore: input.etHomeScore ?? null,
        etAwayScore: input.etAwayScore ?? null,
        penHomeScore: input.penHomeScore ?? null,
        penAwayScore: input.penAwayScore ?? null,
        matchMeta: input.matchMeta ?? undefined,
        sets: setData
          ? setData.sets
          : input.sets?.length
            ? input.sets
            : Prisma.DbNull,
        homeSetsWon: setData?.homeSetsWon ?? null,
        awaySetsWon: setData?.awaySetsWon ?? null,
        status: MatchStatus.COMPLETED,
        reviewStatus: null,
        reviewNote: null,
        reportedByUserId: userId,
        reportedAt: new Date(),
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
      },
    });

    try {
      await this.rankings.onMatchCompleted(matchId);
    } catch (e) {
      this.rankingsLogger.warn(`Ranking update failed for match ${matchId}: ${(e as Error).message}`);
    }

    let advanceWinnerId = resolved.winnerTeamId;

    if (match.legNumber === 1) {
      advanceWinnerId = null;
    } else if (match.legNumber === 2 && match.tieId) {
      const leg1 = await this.prisma.match.findFirst({
        where: {
          tournamentId: match.tournamentId,
          tieId: match.tieId,
          legNumber: 1,
        },
      });
      if (leg1?.status === MatchStatus.COMPLETED && leg1.homeTeamId && leg1.awayTeamId) {
        const tie = resolveTwoLeggedTie({
          leg1HomeScore: leg1.homeScore ?? 0,
          leg1AwayScore: leg1.awayScore ?? 0,
          leg2HomeScore: homeScore,
          leg2AwayScore: awayScore,
          leg1HomeTeamId: leg1.homeTeamId,
          leg1AwayTeamId: leg1.awayTeamId,
          etHomeScore: input.etHomeScore,
          etAwayScore: input.etAwayScore,
          penHomeScore: input.penHomeScore,
          penAwayScore: input.penAwayScore,
          awayGoalsRule: settings.twoLeggedAwayGoals,
          allowExtraTime: settings.knockoutExtraTime,
          allowPenalties: settings.knockoutPenalties,
        });
        advanceWinnerId = tie.winnerTeamId;
        await this.prisma.match.update({
          where: { id: matchId },
          data: { winnerTeamId: tie.winnerTeamId, isDraw: false },
        });
      } else {
        advanceWinnerId = null;
      }
    } else if (
      isElimination &&
      settings.knockoutPenalties &&
      resolved.isDraw &&
      input.penHomeScore != null &&
      input.penAwayScore != null &&
      input.penHomeScore !== input.penAwayScore
    ) {
      advanceWinnerId =
        input.penHomeScore > input.penAwayScore
          ? match.homeTeamId
          : match.awayTeamId;
      await this.prisma.match.update({
        where: { id: matchId },
        data: { winnerTeamId: advanceWinnerId, isDraw: false },
      });
    }

    if (!resolved.isDraw && advanceWinnerId) {
      const loserId =
        advanceWinnerId === match.homeTeamId
          ? match.awayTeamId
          : match.homeTeamId;

      if (match.nextMatchId && match.nextMatchSlot) {
        await this.prisma.match.update({
          where: { id: match.nextMatchId },
          data: {
            ...(match.nextMatchSlot === 'home'
              ? { homeTeamId: advanceWinnerId }
              : { awayTeamId: advanceWinnerId }),
          },
        });
        await this.maybeReady(match.nextMatchId);
      }

      if (match.loserNextMatchId && match.loserNextMatchSlot && loserId) {
        await this.prisma.match.update({
          where: { id: match.loserNextMatchId },
          data: {
            ...(match.loserNextMatchSlot === 'home'
              ? { homeTeamId: loserId }
              : { awayTeamId: loserId }),
          },
        });
        await this.maybeReady(match.loserNextMatchId);
      }

      await this.maybeActivateGrandFinalReset(match, advanceWinnerId);
    }

    await this.jobs.recomputeStandings(match.tournamentId);
    await this.mvp.syncMatchMvp(matchId, {
      winnerTeamId: resolved.winnerTeamId,
      isDraw: resolved.isDraw,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      playerStats: input.playerStats ?? [],
      mvpPlayerId: input.mvpPlayerId,
      tournamentSettings: match.tournament.settings,
    });

    if (settings.useFairPlayTiebreaker && (input.playerStats?.length ?? 0) > 0) {
      const byTeam = new Map<string, typeof input.playerStats>();
      for (const stat of input.playerStats ?? []) {
        if (!byTeam.has(stat.teamId)) byTeam.set(stat.teamId, []);
        byTeam.get(stat.teamId)!.push(stat);
      }
      for (const [teamId, stats] of byTeam) {
        const matchFairPlay = rollupTeamFairPlayFromStats(stats);
        if (matchFairPlay > 0) {
          await this.prisma.team.update({
            where: { id: teamId },
            data: { fairPlayPoints: { increment: matchFairPlay } },
          });
        }
      }
    }

    const withMvp = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
        mvpPlayer: { include: { team: true } },
        playerStats: { include: { player: true, team: true } },
      },
    });

    await this.jobs.enqueueWebhook({
      type: 'match.completed',
      tournamentId: match.tournamentId,
      matchId: match.id,
    });

    await this.bracketRepair.repairBracketAdvancement(match.tournamentId);

    this.realtime.emitMatchUpdated(match.tournamentId, withMvp ?? updated);
    this.realtime.emitBracketUpdated(match.tournamentId);

    return withMvp ?? updated;
  }

  async clearResult(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    await this.tournaments.requireManage(match.tournamentId, userId);
    if (match.status === MatchStatus.PROVISIONAL) {
      const cleared = await this.prisma.match.update({
        where: { id: matchId },
        data: {
          homeScore: null,
          awayScore: null,
          winnerTeamId: null,
          isDraw: false,
          isForfeit: false,
          reviewStatus: null,
          reviewNote: null,
          reportedByUserId: null,
          reportedAt: null,
          status: match.homeTeamId && match.awayTeamId ? MatchStatus.READY : MatchStatus.PENDING,
        },
        include: { homeTeam: true, awayTeam: true, winnerTeam: true },
      });
      this.realtime.emitMatchUpdated(match.tournamentId, cleared);
      this.realtime.emitBracketUpdated(match.tournamentId);
      return cleared;
    }
    if (match.status !== MatchStatus.COMPLETED) {
      throw new BadRequestException('Match is not completed');
    }
    await this.assertCanOverwrite(match);

    // Clear advanced slots
    if (match.nextMatchId && match.nextMatchSlot) {
      await this.prisma.match.update({
        where: { id: match.nextMatchId },
        data: {
          ...(match.nextMatchSlot === 'home'
            ? { homeTeamId: null }
            : { awayTeamId: null }),
          status: MatchStatus.PENDING,
        },
      });
    }
    if (match.loserNextMatchId && match.loserNextMatchSlot) {
      await this.prisma.match.update({
        where: { id: match.loserNextMatchId },
        data: {
          ...(match.loserNextMatchSlot === 'home'
            ? { homeTeamId: null }
            : { awayTeamId: null }),
          status: MatchStatus.PENDING,
        },
      });
    }

    await this.mvp.clearMatchMvp(matchId);

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        homeScore: null,
        awayScore: null,
        homePercent: null,
        awayPercent: null,
        winnerTeamId: null,
        isDraw: false,
        isForfeit: false,
        sets: Prisma.DbNull,
        homeSetsWon: null,
        awaySetsWon: null,
        status:
          match.homeTeamId && match.awayTeamId
            ? MatchStatus.READY
            : MatchStatus.PENDING,
      },
      include: { homeTeam: true, awayTeam: true, winnerTeam: true },
    });

    // Reset tournament from COMPLETED if needed
    if (match.tournament.status === 'COMPLETED') {
      await this.prisma.tournament.update({
        where: { id: match.tournamentId },
        data: { status: 'ACTIVE' },
      });
    }

    await this.jobs.recomputeStandings(match.tournamentId);
    this.realtime.emitMatchUpdated(match.tournamentId, updated);
    this.realtime.emitBracketUpdated(match.tournamentId);
    return updated;
  }

  async updateSchedule(
    matchId: string,
    userId: string,
    input: MatchScheduleInput,
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    await this.tournaments.requireManage(match.tournamentId, userId);
    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        station: input.station ?? null,
      },
      include: { homeTeam: true, awayTeam: true },
    });
    this.realtime.emitMatchUpdated(match.tournamentId, updated);
    return updated;
  }

  async updateAttachment(
    matchId: string,
    userId: string,
    input: MatchAttachmentInput,
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    const settings = tournamentSettingsSchema.parse(
      match.tournament.settings ?? {},
    );
    if (!settings.allowMatchAttachments) {
      throw new BadRequestException('Match attachments are disabled');
    }
    try {
      await this.tournaments.requireManage(match.tournamentId, userId);
    } catch {
      const teamIds = [match.homeTeamId, match.awayTeamId].filter(
        (id): id is string => !!id,
      );
      const onTeam = await this.prisma.team.findFirst({
        where: {
          tournamentId: match.tournamentId,
          registeredByUserId: userId,
          id: { in: teamIds },
        },
      });
      if (!onTeam) throw new ForbiddenException();
    }
    return this.prisma.match.update({
      where: { id: matchId },
      data: {
        attachmentUrl: input.attachmentUrl ?? null,
        attachmentName: input.attachmentName ?? null,
      },
    });
  }

  async setArrival(matchId: string, userId: string, input: MatchArrivalInput) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    const manager = await this.manages(match.tournamentId, userId);
    const team = input.side === 'home' ? match.homeTeam : match.awayTeam;
    if (!manager && team?.registeredByUserId !== userId) {
      throw new ForbiddenException('You can only check in your own team');
    }
    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: input.side === 'home'
        ? { homeArrivedAt: input.present ? new Date() : null }
        : { awayArrivedAt: input.present ? new Date() : null },
      include: { homeTeam: true, awayTeam: true },
    });
    this.realtime.emitMatchUpdated(match.tournamentId, updated);
    return updated;
  }

  async noShow(matchId: string, userId: string, input: MatchNoShowInput) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, tournamentId: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    await this.tournaments.requireManage(match.tournamentId, userId);
    return this.setResult(matchId, userId, {
      isForfeit: true,
      forfeitSide: input.side,
      homeScore: 0,
      awayScore: 0,
      isDraw: false,
      isNoResult: false,
      force: false,
      winnersOnly: false,
      playerStats: [],
    });
  }

  async confirmProposal(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status !== MatchStatus.PROVISIONAL) {
      throw new BadRequestException('This score is not waiting for confirmation');
    }
    const manager = await this.manages(match.tournamentId, userId);
    if (match.reviewStatus === 'DISPUTED' && !manager) {
      throw new BadRequestException('A disputed score has to be decided by the organizer');
    }
    const onTeam =
      match.homeTeam?.registeredByUserId === userId ||
      match.awayTeam?.registeredByUserId === userId;
    if (!manager && (!onTeam || userId === match.reportedByUserId)) {
      throw new ForbiddenException('The other team confirms this score');
    }
    return this.setResult(matchId, userId, {
      homeScore: match.homeScore ?? 0,
      awayScore: match.awayScore ?? 0,
      winnerTeamId: match.winnerTeamId,
      isDraw: match.isDraw,
      isNoResult: false,
      isForfeit: false,
      acceptProposal: true,
      force: true,
      winnersOnly: false,
      playerStats: [],
    });
  }

  async dispute(matchId: string, userId: string, input: MatchDisputeInput) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: { select: { slug: true, name: true, createdById: true } },
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status !== MatchStatus.PROVISIONAL) {
      throw new BadRequestException('Only a proposed score can be disputed');
    }
    const onTeam =
      match.homeTeam?.registeredByUserId === userId ||
      match.awayTeam?.registeredByUserId === userId;
    if (!onTeam || userId === match.reportedByUserId) {
      throw new ForbiddenException('The other team disputes this score');
    }
    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: { reviewStatus: 'DISPUTED', reviewNote: input.note.trim() },
      include: { homeTeam: true, awayTeam: true },
    });
    await this.inbox.notify(match.tournament.createdById, {
      type: 'score_disputed',
      title: `Score disputed in ${match.tournament.name}`,
      body: input.note.trim(),
      href: `/t/${match.tournament.slug}/m/${match.id}`,
    });
    this.realtime.emitMatchUpdated(match.tournamentId, updated);
    return updated;
  }

  private async manages(tournamentId: string, userId: string) {
    try {
      await this.tournaments.requireManage(tournamentId, userId);
      return true;
    } catch {
      return false;
    }
  }

  private async assertTeamCanReport(
    match: {
      homeTeamId: string | null;
      awayTeamId: string | null;
      tournament: { settings: unknown };
    },
    teamId: string,
  ) {
    const settings = tournamentSettingsSchema.parse(match.tournament.settings ?? {});
    if (!settings.allowParticipantsReportScores) {
      throw new ForbiddenException('Participants cannot report scores in this tournament');
    }
    if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) {
      throw new ForbiddenException('This is not your match');
    }
  }

  /** Starter allows one tournament with a result in the last 30 days. */
  private async assertActiveTournament(tournamentId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, createdById: true },
    });
    if (!t) return;
    const plan = await this.access.userPlan(t.createdById);
    const limit = PLANS[plan].limits.maxActiveTournaments;
    if (limit == null) return;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const active = await this.prisma.tournament.findMany({
      where: {
        createdById: t.createdById,
        id: { not: t.id },
        matches: {
          some: {
            status: MatchStatus.COMPLETED,
            OR: [
              { reportedAt: { gte: since } },
              { updatedAt: { gte: since } },
            ],
          },
        },
      },
      select: { id: true },
    });
    if (active.length >= limit) {
      throw new ForbiddenException(
        `Starter includes ${limit} active tournament. A tournament stays active for 30 days after a result. Upgrade to Premier for unlimited active tournaments.`,
      );
    }
  }

  private async assertCanReportResult(
    match: {
      tournamentId: string;
      homeTeamId: string | null;
      awayTeamId: string | null;
      tournament: { settings: unknown };
    },
    userId: string,
  ) {
    try {
      await this.tournaments.requireManage(match.tournamentId, userId);
      return;
    } catch {
      const settings = tournamentSettingsSchema.parse(
        match.tournament.settings ?? {},
      );
      if (!settings.allowParticipantsReportScores) {
        throw new ForbiddenException();
      }
      const teamIds = [match.homeTeamId, match.awayTeamId].filter(
        (id): id is string => !!id,
      );
      const onTeam = await this.prisma.team.findFirst({
        where: {
          tournamentId: match.tournamentId,
          registeredByUserId: userId,
          id: { in: teamIds },
        },
      });
      if (!onTeam) throw new ForbiddenException();
    }
  }

  private async assertCanOverwrite(match: {
    nextMatchId: string | null;
    loserNextMatchId: string | null;
  }) {
    for (const id of [match.nextMatchId, match.loserNextMatchId]) {
      if (!id) continue;
      const next = await this.prisma.match.findUnique({ where: { id } });
      if (next?.status === MatchStatus.COMPLETED) {
        throw new BadRequestException(
          'Cannot change result — a later match is already completed. Clear later results first.',
        );
      }
    }
  }

  private async maybeReady(matchId: string) {
    const m = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true, homeTeam: true, awayTeam: true },
    });
    if (m && m.homeTeamId && m.awayTeamId && m.status === MatchStatus.PENDING) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.READY },
      });
      const settings = tournamentSettingsSchema.parse(m.tournament.settings ?? {});
      if (settings.notifyMatchAvailable) {
        await this.jobs.enqueueWebhook({
          type: 'match_available',
          tournamentId: m.tournamentId,
          matchId: m.id,
          homeTeam: m.homeTeam?.name ?? null,
          awayTeam: m.awayTeam?.name ?? null,
          round: m.round,
        });
      }
      this.realtime.emitBracketUpdated(m.tournamentId);
    }
  }

  async getMatchVotes(matchId: string, userId?: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    const settings = tournamentSettingsSchema.parse(
      match.tournament.settings ?? {},
    );
    if (!settings.enableMatchVoting) {
      return { enabled: false, home: 0, away: 0, total: 0, myVote: null };
    }
    const votes = await this.prisma.matchVote.findMany({
      where: { matchId },
    });
    const home = votes.filter((v) => v.teamId === match.homeTeamId).length;
    const away = votes.filter((v) => v.teamId === match.awayTeamId).length;
    const myVote = userId
      ? (votes.find((v) => v.userId === userId)?.teamId ?? null)
      : null;
    return { enabled: true, home, away, total: votes.length, myVote };
  }

  async voteMatch(matchId: string, userId: string, teamId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    const settings = tournamentSettingsSchema.parse(
      match.tournament.settings ?? {},
    );
    if (!settings.enableMatchVoting) {
      throw new BadRequestException('Match voting is disabled');
    }
    if (match.status === MatchStatus.COMPLETED) {
      throw new BadRequestException('Voting closed — match completed');
    }
    if (teamId !== match.homeTeamId && teamId !== match.awayTeamId) {
      throw new BadRequestException('Invalid team for this match');
    }
    await this.prisma.matchVote.upsert({
      where: { matchId_userId: { matchId, userId } },
      create: { matchId, userId, teamId },
      update: { teamId },
    });
    return this.getMatchVotes(matchId, userId);
  }

  /** Double-elimination bracket reset (international standard). */
  private async maybeActivateGrandFinalReset(
    match: {
      id: string;
      key: string;
      tournamentId: string;
      homeTeamId: string | null;
      awayTeamId: string | null;
    },
    winnerTeamId: string | null,
  ) {
    if (match.key !== 'de-gf' || !winnerTeamId) return;

    const settings = tournamentSettingsSchema.parse(
      (
        await this.prisma.tournament.findUnique({
          where: { id: match.tournamentId },
        })
      )?.settings ?? {},
    );
    if (settings.doubleElimBracketReset === false) return;

    const lbChampionId = match.awayTeamId;
    if (winnerTeamId !== lbChampionId) return;

    const reset = await this.prisma.match.findFirst({
      where: { tournamentId: match.tournamentId, key: 'de-gf-reset' },
    });
    if (!reset) return;

    await this.prisma.match.update({
      where: { id: reset.id },
      data: {
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        status: MatchStatus.READY,
      },
    });
  }
}
