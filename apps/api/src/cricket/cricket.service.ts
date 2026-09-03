import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  CricketExtraType,
  CricketFormat,
  CricketInningsEndReason,
  CricketInningsStatus,
  computeDlsRevisedTarget,
  computeLeaguePoints,
  formatCricketOvers,
  lastCompletedOverBowlerId,
  bowlingLegalBallsByBowler,
  canSelectBowler,
  maxLegalOversForBowler,
  resolveBowlerLimits,
  tournamentSettingsSchema,
  type CricketBallInput,
  type CricketCreateStandaloneInput,
  type CricketDeclareInput,
  type CricketDlsInput,
  type CricketAbandonInput,
  type CricketEndInningsInput,
  type CricketScoreboard,
  type CricketSetupInput,
  type CricketSetBatsmenInput,
  type CricketStandaloneStartInningsInput,
  type CricketStartInningsInput,
  type CricketStartSuperOverInput,
  type CricketManualReportInput,
  type CricketTossInput,
  type CricketStandaloneTossInput,
  parseCricketOvers,
  type PlayerMatchStatsInput,
} from '@bracket/shared';
import { MatchStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TournamentsService } from '../tournaments/tournaments.service';
import { MatchesService } from '../matches/matches.service';
import { buildScoreboard, emptyScoreboard } from './cricket-board.util';

const DEFAULT_OVERS: Record<string, number> = {
  T20: 20,
  ODI: 50,
  CUSTOM: 20,
};

@Injectable()
export class CricketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournaments: TournamentsService,
    @Inject(forwardRef(() => MatchesService))
    private readonly matches: MatchesService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async getScoreboard(matchId: string): Promise<CricketScoreboard> {
    const match = await this.loadMatch(matchId);
    const cricket = await this.loadCricketWithInnings({ matchId });
    const teamMap = new Map(
      [match.homeTeam, match.awayTeam]
        .filter(Boolean)
        .map((t) => [t!.id, t!.name]),
    );
    const toss = this.parseMatchToss(match, teamMap);

    if (!cricket) {
      return { ...emptyScoreboard({
        id: matchId,
        mode: 'TOURNAMENT',
        matchId,
        maxOvers: 20,
      }), toss };
    }

    const players = await this.loadPlayersForMatch(match);
    const playerMap = new Map(players.map((p) => [p.id, p.name]));
    const rosterSizes = new Map<string, number>();
    if (match.homeTeamId) {
      rosterSizes.set(
        match.homeTeamId,
        players.filter((p) => p.teamId === match.homeTeamId).length ||
          cricket.maxWickets + 1,
      );
    }
    if (match.awayTeamId) {
      rosterSizes.set(
        match.awayTeamId,
        players.filter((p) => p.teamId === match.awayTeamId).length ||
          cricket.maxWickets + 1,
      );
    }

    return { ...buildScoreboard(
      cricket as Parameters<typeof buildScoreboard>[0],
      teamMap,
      playerMap,
      match.homeTeamId,
      match.awayTeamId,
      rosterSizes,
    ), toss };
  }

  async recordToss(matchId: string, userId: string, input: CricketTossInput) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);

    const homeId = match.homeTeamId;
    const awayId = match.awayTeamId;
    if (!homeId || !awayId) {
      throw new BadRequestException('Both teams must be assigned before the toss');
    }
    if (![homeId, awayId].includes(input.winnerTeamId)) {
      throw new BadRequestException('Toss winner must be one of the match teams');
    }

    const cricket = await this.loadCricketWithInnings({ matchId });
    if (
      cricket?.innings.some(
        (i) =>
          i.status === CricketInningsStatus.IN_PROGRESS ||
          i.status === CricketInningsStatus.COMPLETED,
      )
    ) {
      throw new BadRequestException(
        'Toss cannot be changed after an innings has started',
      );
    }

    const existingMeta =
      match.matchMeta && typeof match.matchMeta === 'object'
        ? (match.matchMeta as Record<string, unknown>)
        : {};

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        matchMeta: {
          ...existingMeta,
          cricketToss: {
            winnerTeamId: input.winnerTeamId,
            decision: input.decision,
          },
        },
      },
    });

    await this.emitUpdate(match.tournamentId, matchId);
    return this.getScoreboard(matchId);
  }

  private parseMatchToss(
    match: Awaited<ReturnType<CricketService['loadMatch']>>,
    teamMap: Map<string, string>,
  ): CricketScoreboard['toss'] {
    const meta = match.matchMeta as { cricketToss?: CricketTossInput } | null;
    const toss = meta?.cricketToss;
    if (!toss?.winnerTeamId || !toss.decision) return null;
    return {
      winnerTeamId: toss.winnerTeamId,
      winnerTeamName: teamMap.get(toss.winnerTeamId) ?? 'Team',
      decision: toss.decision,
    };
  }

  async setup(matchId: string, userId: string, input: CricketSetupInput) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);

    const maxOvers =
      input.maxOvers ??
      DEFAULT_OVERS[input.format ?? 'T20'] ??
      DEFAULT_OVERS.T20;
    const bowlerLimits = resolveBowlerLimits(maxOvers, input.format ?? 'T20', input);

    const cricket = await this.prisma.cricketMatch.upsert({
      where: { matchId },
      create: {
        matchId,
        format: (input.format ?? 'T20') as CricketFormat,
        maxOvers,
        maxWickets: input.maxWickets ?? 10,
        ballsPerOver: input.ballsPerOver ?? 6,
        maxOversPerBowler: bowlerLimits.maxOversPerBowler,
        maxBowlersAtLimit: bowlerLimits.maxBowlersAtLimit,
        inningsCount: input.inningsCount ?? 2,
        strikeRotationMode: input.strikeRotationMode ?? 'AUTO',
      },
      update: {
        format: (input.format ?? 'T20') as CricketFormat,
        maxOvers,
        maxWickets: input.maxWickets ?? 10,
        ballsPerOver: input.ballsPerOver ?? 6,
        maxOversPerBowler: bowlerLimits.maxOversPerBowler,
        maxBowlersAtLimit: bowlerLimits.maxBowlersAtLimit,
        inningsCount: input.inningsCount ?? 2,
        strikeRotationMode: input.strikeRotationMode ?? 'AUTO',
      },
    });

    await this.emitUpdate(match.tournamentId, matchId);
    return cricket;
  }

  async startInnings(
    matchId: string,
    userId: string,
    input: CricketStartInningsInput,
  ) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);

    const cricket = await this.prisma.cricketMatch.findUnique({
      where: { matchId },
      include: { innings: true },
    });
    if (!cricket) {
      throw new BadRequestException('Configure cricket match first');
    }

    const teamIds = [match.homeTeamId, match.awayTeamId].filter(
      (id): id is string => !!id,
    );
    if (
      !teamIds.includes(input.battingTeamId) ||
      !teamIds.includes(input.bowlingTeamId)
    ) {
      throw new BadRequestException('Invalid batting or bowling team');
    }
    if (input.battingTeamId === input.bowlingTeamId) {
      throw new BadRequestException('Batting and bowling teams must differ');
    }
    if (input.strikerId === input.nonStrikerId) {
      throw new BadRequestException('Striker and non-striker must differ');
    }

    const fullCricket = await this.loadCricketWithInnings({ matchId });
    if (fullCricket) {
      this.assertBowlerAllowed(fullCricket, { balls: [] }, input.bowlerId);
    }

    const existing = cricket.innings.find(
      (i) => i.inningsNumber === input.inningsNumber,
    );
    if (existing?.status === CricketInningsStatus.COMPLETED) {
      throw new BadRequestException('Innings already completed');
    }

    const active = cricket.innings.find(
      (i) => i.status === CricketInningsStatus.IN_PROGRESS,
    );
    if (active && active.inningsNumber !== input.inningsNumber) {
      throw new BadRequestException('Another innings is in progress');
    }

    if (input.inningsNumber === 2) {
      const first = cricket.innings.find((i) => i.inningsNumber === 1);
      if (!first || first.status !== CricketInningsStatus.COMPLETED) {
        throw new BadRequestException('First innings must be completed');
      }
    }

    const targetRuns =
      input.inningsNumber === 2
        ? (cricket.innings.find((i) => i.inningsNumber === 1)?.runs ?? 0) + 1
        : null;

    const innings = await this.prisma.cricketInnings.upsert({
      where: {
        cricketMatchId_inningsNumber: {
          cricketMatchId: cricket.id,
          inningsNumber: input.inningsNumber,
        },
      },
      create: {
        cricketMatchId: cricket.id,
        inningsNumber: input.inningsNumber,
        battingTeamId: input.battingTeamId,
        bowlingTeamId: input.bowlingTeamId,
        strikerId: input.strikerId,
        nonStrikerId: input.nonStrikerId,
        currentBowlerId: input.bowlerId,
        targetRuns,
        status: CricketInningsStatus.IN_PROGRESS,
      },
      update: {
        battingTeamId: input.battingTeamId,
        bowlingTeamId: input.bowlingTeamId,
        strikerId: input.strikerId,
        nonStrikerId: input.nonStrikerId,
        currentBowlerId: input.bowlerId,
        targetRuns,
        status: CricketInningsStatus.IN_PROGRESS,
      },
    });

    if (match.status === MatchStatus.PENDING) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.READY },
      });
    }

    await this.emitUpdate(match.tournamentId, matchId);
    return innings;
  }

  async recordBall(matchId: string, userId: string, input: CricketBallInput) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);

    const cricket = await this.loadCricketWithInnings({ matchId });
    if (!cricket) {
      throw new BadRequestException('Configure cricket match first');
    }

    const rosterSizes = await this.rosterSizesForMatch(match);
    const status = await this.recordBallCore(cricket, input, rosterSizes);

    if (status === CricketInningsStatus.COMPLETED) {
      await this.onInningsComplete(match, cricket, userId);
    }

    await this.emitUpdate(match.tournamentId, matchId);
    return this.getScoreboard(matchId);
  }

  async undoLastBall(matchId: string, userId: string) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);

    const cricket = await this.prisma.cricketMatch.findUnique({
      where: { matchId },
      include: {
        innings: {
          orderBy: { inningsNumber: 'desc' },
          include: { balls: { orderBy: { sequence: 'desc' }, take: 1 } },
        },
      },
    });
    if (!cricket) throw new NotFoundException('Cricket match not configured');

    const innings = cricket.innings.find((i) => i.balls.length > 0);
    if (!innings?.balls[0]) {
      throw new BadRequestException('No balls to undo');
    }

    const ball = innings.balls[0];
    const allBalls = await this.prisma.cricketBall.findMany({
      where: { inningsId: innings.id },
      orderBy: { sequence: 'asc' },
    });
    const remaining = allBalls.filter((b) => b.id !== ball.id);

    let runs = 0;
    let wickets = 0;
    let legalBalls = 0;
    let extras = 0;
    let strikerId = innings.strikerId;
    let nonStrikerId = innings.nonStrikerId;

    for (const b of remaining) {
      runs += b.totalRuns;
      if (b.isWicket) wickets += 1;
      if (b.isLegalDelivery) legalBalls += 1;
      if (b.extraType !== 'NONE') extras += b.extraRuns;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cricketBall.delete({ where: { id: ball.id } });
      await tx.cricketInnings.update({
        where: { id: innings.id },
        data: {
          runs,
          wickets,
          legalBalls,
          extras,
          status: CricketInningsStatus.IN_PROGRESS,
          strikerId,
          nonStrikerId,
        },
      });
    });

    await this.emitUpdate(match.tournamentId, matchId);
    return this.getScoreboard(matchId);
  }

  async setBatsmen(
    matchId: string,
    userId: string,
    input: CricketSetBatsmenInput,
  ) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);

    const cricket = await this.loadCricketWithInnings({ matchId });
    if (!cricket) {
      throw new BadRequestException('Configure cricket match first');
    }

    const rosterSizes = await this.rosterSizesForMatch(match);
    await this.setBatsmenCore(cricket, input, rosterSizes);
    await this.emitUpdate(match.tournamentId, matchId);
    return this.getScoreboard(matchId);
  }

  async swapStrike(matchId: string, userId: string) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);

    const cricket = await this.loadCricketWithInnings({ matchId });
    if (!cricket) {
      throw new BadRequestException('Configure cricket match first');
    }

    await this.swapStrikeCore(cricket);
    await this.emitUpdate(match.tournamentId, matchId);
    return this.getScoreboard(matchId);
  }

  async changeBowler(matchId: string, userId: string, bowlerId: string) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);

    const cricket = await this.loadCricketWithInnings({ matchId });
    if (!cricket) {
      throw new BadRequestException('Configure cricket match first');
    }
    const innings = cricket.innings.find(
      (i) => i.status === CricketInningsStatus.IN_PROGRESS,
    );
    if (!innings) {
      throw new BadRequestException('No innings in progress');
    }

    if (!innings.currentBowlerId) {
      this.assertNotConsecutiveOverBowler(innings, cricket.ballsPerOver, bowlerId);
    }
    this.assertBowlerAllowed(cricket, innings, bowlerId);

    await this.prisma.cricketInnings.update({
      where: { id: innings.id },
      data: { currentBowlerId: bowlerId },
    });

    await this.emitUpdate(match.tournamentId, matchId);
    return this.getScoreboard(matchId);
  }

  async ensureSquads(matchId: string, userId: string, squadSize = 11) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);
    const size = Math.min(30, Math.max(2, Math.floor(squadSize)));

    for (const team of [match.homeTeam, match.awayTeam].filter(Boolean)) {
      const count = await this.prisma.teamPlayer.count({
        where: { teamId: team!.id },
      });
      if (count > 0) continue;
      await this.prisma.teamPlayer.createMany({
        data: Array.from({ length: size }, (_, i) => ({
          teamId: team!.id,
          name: `${team!.name} ${i + 1}`,
          order: i,
        })),
      });
    }

    await this.emitUpdate(match.tournamentId, matchId);
    return this.getScoreboard(matchId);
  }

  async endInnings(
    matchId: string,
    userId: string,
    input: CricketEndInningsInput = { reason: 'MANUAL' },
  ) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);

    const cricket = await this.prisma.cricketMatch.findUnique({
      where: { matchId },
      include: { innings: true },
    });
    if (!cricket) throw new NotFoundException();

    const innings = cricket.innings.find(
      (i) => i.status === CricketInningsStatus.IN_PROGRESS,
    );
    if (!innings) {
      throw new BadRequestException('No innings in progress');
    }

    await this.prisma.cricketInnings.update({
      where: { id: innings.id },
      data: {
        status: CricketInningsStatus.COMPLETED,
        endReason: input.reason as CricketInningsEndReason,
        isAllOut: input.reason === 'ALL_OUT',
        declared: input.reason === 'DECLARED',
      },
    });

    await this.onInningsComplete(match, cricket, userId);
    await this.emitUpdate(match.tournamentId, matchId);
    return this.getScoreboard(matchId);
  }

  async declareInnings(matchId: string, userId: string, input: CricketDeclareInput) {
    return this.endInnings(matchId, userId, { reason: 'DECLARED' });
  }

  async applyDls(matchId: string, userId: string, input: CricketDlsInput) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);
    const cricket = await this.prisma.cricketMatch.findUnique({
      where: { matchId },
      include: { innings: { orderBy: { inningsNumber: 'asc' } } },
    });
    if (!cricket) throw new NotFoundException();

    const first = cricket.innings.find((i) => i.inningsNumber === 1);
    const second = cricket.innings.find((i) => i.inningsNumber === 2);
    if (!first) throw new BadRequestException('First innings required for DLS');

    const dls = computeDlsRevisedTarget({
      firstInningsRuns: first.runs,
      firstInningsLegalBalls: first.legalBalls,
      firstInningsWickets: first.wickets,
      originalMaxOvers: cricket.maxOvers,
      revisedMaxOvers: input.revisedMaxOvers,
      ballsPerOver: cricket.ballsPerOver,
      chaseRuns: second?.runs,
      chaseLegalBalls: second?.legalBalls,
      chaseWickets: second?.wickets,
    });

    await this.prisma.cricketMatch.update({
      where: { id: cricket.id },
      data: { maxOvers: input.revisedMaxOvers },
    });

    if (second) {
      await this.prisma.cricketInnings.update({
        where: { id: second.id },
        data: {
          revisedMaxOvers: input.revisedMaxOvers,
          dlsParScore: dls.revisedTarget,
          targetRuns: dls.revisedTarget,
        },
      });
    } else if (first.status === CricketInningsStatus.COMPLETED) {
      await this.prisma.cricketInnings.create({
        data: {
          cricketMatchId: cricket.id,
          inningsNumber: 2,
          battingTeamId: first.bowlingTeamId,
          bowlingTeamId: first.battingTeamId,
          targetRuns: dls.revisedTarget,
          dlsParScore: dls.revisedTarget,
          revisedMaxOvers: input.revisedMaxOvers,
          status: CricketInningsStatus.NOT_STARTED,
        },
      });
    }

    await this.emitUpdate(match.tournamentId, matchId);
    return this.getScoreboard(matchId);
  }

  private async onInningsComplete(
    match: Awaited<ReturnType<CricketService['loadMatch']>>,
    cricket: { inningsCount: number; id: string },
    userId: string,
  ) {
    const full = await this.prisma.cricketMatch.findUnique({
      where: { id: cricket.id },
      include: { innings: { orderBy: { inningsNumber: 'asc' } } },
    });
    if (!full) return;

    const completed = full.innings.filter(
      (i) => i.status === CricketInningsStatus.COMPLETED,
    );
    const regularCompleted = completed.filter((i) => !i.isSuperOver);
    const superCompleted = completed.filter((i) => i.isSuperOver);

    if (superCompleted.length >= 2) {
      await this.finalizeMatchFromCricket(match, userId);
      return;
    }

    if (superCompleted.length === 1 && regularCompleted.length >= full.inningsCount) {
      await this.prisma.cricketMatch.update({
        where: { id: full.id },
        data: { superOverPending: true },
      });
      return;
    }

    if (regularCompleted.length < full.inningsCount) return;

    const homeId = match.homeTeamId!;
    const awayId = match.awayTeamId!;
    const homeInn = regularCompleted.find((i) => i.battingTeamId === homeId);
    const awayInn = regularCompleted.find((i) => i.battingTeamId === awayId);
    const homeRuns = homeInn?.runs ?? 0;
    const awayRuns = awayInn?.runs ?? 0;

    if (homeRuns === awayRuns && this.isKnockoutMatch(match)) {
      await this.prisma.cricketMatch.update({
        where: { id: full.id },
        data: { superOverPending: true },
      });
      return;
    }

    await this.finalizeMatchFromCricket(match, userId);
  }

  private isKnockoutMatch(
    match: Awaited<ReturnType<CricketService['loadMatch']>>,
  ) {
    const fmt = match.tournament.format;
    return (
      fmt === 'SINGLE_ELIMINATION' ||
      fmt === 'DOUBLE_ELIMINATION' ||
      (fmt === 'GROUPS_KNOCKOUT' && match.bracketSide !== 'GROUP')
    );
  }

  private buildPlayerStats(
    scoreboard: CricketScoreboard,
    homeTeamId: string,
    awayTeamId: string,
  ): PlayerMatchStatsInput[] {
    const byPlayer = new Map<string, PlayerMatchStatsInput>();

    for (const inn of scoreboard.innings.filter(
      (i) => !i.isSuperOver && i.status === CricketInningsStatus.COMPLETED,
    )) {
      for (const bat of inn.batting) {
        const teamId =
          inn.battingTeamId === homeTeamId || inn.battingTeamId === 'home'
            ? homeTeamId
            : awayTeamId;
        const cur =
          byPlayer.get(bat.playerId) ??
          ({
            playerId: bat.playerId,
            teamId,
            goals: 0,
            assists: 0,
            points: 0,
          } as PlayerMatchStatsInput);
        cur.goals = (cur.goals ?? 0) + bat.runs;
        cur.points = (cur.points ?? 0) + bat.points;
        cur.rating = bat.strikeRate;
        byPlayer.set(bat.playerId, cur);
      }
      for (const bowl of inn.bowling) {
        const teamId =
          inn.bowlingTeamId === homeTeamId || inn.bowlingTeamId === 'home'
            ? homeTeamId
            : awayTeamId;
        const cur =
          byPlayer.get(bowl.playerId) ??
          ({
            playerId: bowl.playerId,
            teamId,
            goals: 0,
            assists: 0,
            points: 0,
          } as PlayerMatchStatsInput);
        cur.assists = (cur.assists ?? 0) + bowl.wickets;
        cur.points = (cur.points ?? 0) + bowl.points;
        if (cur.rating == null) cur.rating = bowl.economy;
        byPlayer.set(bowl.playerId, cur);
      }
    }

    return [...byPlayer.values()];
  }

  private async finalizeMatchFromCricket(
    match: Awaited<ReturnType<CricketService['loadMatch']>>,
    userId: string,
    opts?: { matchMeta?: Record<string, unknown> | null },
  ) {
    const scoreboard = await this.getScoreboard(match.id);
    const homeId = match.homeTeamId!;
    const awayId = match.awayTeamId!;

    const regular = scoreboard.innings.filter(
      (i) => !i.isSuperOver && i.status === CricketInningsStatus.COMPLETED,
    );
    const superInns = scoreboard.innings.filter(
      (i) => i.isSuperOver && i.status === CricketInningsStatus.COMPLETED,
    );

    let homeRuns = regular.find((i) => i.battingTeamId === homeId)?.runs ?? 0;
    let awayRuns = regular.find((i) => i.battingTeamId === awayId)?.runs ?? 0;
    let winnerTeamId: string | null = null;
    let isDraw = false;

    if (superInns.length >= 2) {
      const homeSo = superInns.find((i) => i.battingTeamId === homeId);
      const awaySo = superInns.find((i) => i.battingTeamId === awayId);
      const hSo = homeSo?.runs ?? 0;
      const aSo = awaySo?.runs ?? 0;
      homeRuns = hSo;
      awayRuns = aSo;
      if (hSo === aSo) {
        isDraw = true;
      } else {
        winnerTeamId = hSo > aSo ? homeId : awayId;
      }
    } else {
      isDraw = homeRuns === awayRuns;
      winnerTeamId = isDraw ? null : homeRuns > awayRuns ? homeId : awayId;
    }

    await this.prisma.cricketMatch.update({
      where: { matchId: match.id },
      data: {
        superOverPending: false,
        homePoints: scoreboard.matchSummary.homePoints,
        awayPoints: scoreboard.matchSummary.awayPoints,
      },
    });

    const playerStats = this.buildPlayerStats(scoreboard, homeId, awayId);

    await this.matches.setResult(match.id, userId, {
      homeScore: homeRuns,
      awayScore: awayRuns,
      isDraw,
      isNoResult: false,
      winnerTeamId,
      force: match.status === MatchStatus.COMPLETED,
      winnersOnly: false,
      isForfeit: false,
      playerStats,
      matchMeta: opts?.matchMeta ?? undefined,
    });
  }

  async submitManualReport(
    matchId: string,
    userId: string,
    input: CricketManualReportInput,
  ) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);

    const homeId = match.homeTeamId;
    const awayId = match.awayTeamId;
    if (!homeId || !awayId) {
      throw new BadRequestException('Both teams must be assigned');
    }
    if (![homeId, awayId].includes(input.firstBattingTeamId)) {
      throw new BadRequestException('Invalid first batting team');
    }

    let cricket = await this.prisma.cricketMatch.findUnique({
      where: { matchId },
      include: { innings: { include: { balls: true } } },
    });
    if (!cricket) {
      await this.setup(matchId, userId, {
        format: 'T20',
        ballsPerOver: 6,
        inningsCount: 2,
        strikeRotationMode: 'AUTO',
      });
      cricket = await this.prisma.cricketMatch.findUnique({
        where: { matchId },
        include: { innings: { include: { balls: true } } },
      });
    }
    if (!cricket) {
      throw new BadRequestException('Could not configure cricket match');
    }

    const ballsPerOver = cricket.ballsPerOver;
    const maxWickets = cricket.maxWickets;
    const secondBattingTeamId =
      input.firstBattingTeamId === homeId ? awayId : homeId;

    let legalBalls1: number;
    let legalBalls2: number;
    try {
      legalBalls1 = parseCricketOvers(input.firstInnings.overs, ballsPerOver);
      legalBalls2 = parseCricketOvers(input.secondInnings.overs, ballsPerOver);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid overs',
      );
    }

    for (const inn of [input.firstInnings, input.secondInnings]) {
      if (inn.wickets > maxWickets) {
        throw new BadRequestException(
          `Wickets cannot exceed ${maxWickets} per innings`,
        );
      }
    }

    for (const inn of cricket.innings.filter((i) => i.inningsNumber <= 2)) {
      await this.prisma.cricketBall.deleteMany({ where: { inningsId: inn.id } });
    }

    const inningsRows = [
      {
        inningsNumber: 1,
        battingTeamId: input.firstBattingTeamId,
        bowlingTeamId: secondBattingTeamId,
        report: input.firstInnings,
        legalBalls: legalBalls1,
      },
      {
        inningsNumber: 2,
        battingTeamId: secondBattingTeamId,
        bowlingTeamId: input.firstBattingTeamId,
        report: input.secondInnings,
        legalBalls: legalBalls2,
      },
    ] as const;

    for (const row of inningsRows) {
      const isAllOut =
        row.report.allOut === true || row.report.wickets >= maxWickets;
      await this.prisma.cricketInnings.upsert({
        where: {
          cricketMatchId_inningsNumber: {
            cricketMatchId: cricket.id,
            inningsNumber: row.inningsNumber,
          },
        },
        create: {
          cricketMatchId: cricket.id,
          inningsNumber: row.inningsNumber,
          battingTeamId: row.battingTeamId,
          bowlingTeamId: row.bowlingTeamId,
          runs: row.report.runs,
          wickets: row.report.wickets,
          legalBalls: row.legalBalls,
          extras: row.report.extras ?? 0,
          isAllOut,
          status: CricketInningsStatus.COMPLETED,
          endReason: CricketInningsEndReason.MANUAL,
        },
        update: {
          battingTeamId: row.battingTeamId,
          bowlingTeamId: row.bowlingTeamId,
          runs: row.report.runs,
          wickets: row.report.wickets,
          legalBalls: row.legalBalls,
          extras: row.report.extras ?? 0,
          isAllOut,
          status: CricketInningsStatus.COMPLETED,
          endReason: CricketInningsEndReason.MANUAL,
          strikerId: null,
          nonStrikerId: null,
          currentBowlerId: null,
        },
      });
    }

    const cricketReport = {
      firstBattingTeamId: input.firstBattingTeamId,
      innings: inningsRows.map((row) => ({
        inningsNumber: row.inningsNumber,
        battingTeamId: row.battingTeamId,
        runs: row.report.runs,
        wickets: row.report.wickets,
        overs: row.report.overs.trim(),
        extras: row.report.extras ?? 0,
      })),
    };

    await this.finalizeMatchFromCricket(match, userId, {
      matchMeta: { cricketReport },
    });
    await this.emitUpdate(match.tournamentId, matchId);
    return this.getScoreboard(matchId);
  }

  async abandonMatch(
    matchId: string,
    userId: string,
    input: CricketAbandonInput,
  ) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);

    const cricket = await this.prisma.cricketMatch.findUnique({
      where: { matchId },
    });

    if (cricket) {
      const active = await this.prisma.cricketInnings.findFirst({
        where: {
          cricketMatchId: cricket.id,
          status: CricketInningsStatus.IN_PROGRESS,
        },
      });
      if (active) {
        await this.prisma.cricketInnings.update({
          where: { id: active.id },
          data: {
            status: CricketInningsStatus.COMPLETED,
            endReason: input.reason as CricketInningsEndReason,
          },
        });
      }
      await this.prisma.cricketMatch.update({
        where: { id: cricket.id },
        data: { superOverPending: false },
      });
    }

    await this.matches.setResult(matchId, userId, {
      homeScore: 0,
      awayScore: 0,
      isDraw: true,
      isNoResult: true,
      winnerTeamId: null,
      force: match.status === MatchStatus.COMPLETED,
      winnersOnly: false,
      isForfeit: false,
      playerStats: [],
    });

    await this.emitUpdate(match.tournamentId, matchId);
    return this.getScoreboard(matchId);
  }

  async startSuperOver(
    matchId: string,
    userId: string,
    input: CricketStartSuperOverInput,
  ) {
    const match = await this.loadMatch(matchId);
    await this.assertCanScore(match, userId);

    const cricket = await this.loadCricketWithInnings({ matchId });
    if (!cricket) {
      throw new BadRequestException('Configure cricket match first');
    }

    const superActive = cricket.innings.find(
      (i) => i.isSuperOver && i.status === CricketInningsStatus.IN_PROGRESS,
    );
    if (superActive) {
      throw new BadRequestException('Super Over innings already in progress');
    }

    const superDone = cricket.innings.filter(
      (i) => i.isSuperOver && i.status === CricketInningsStatus.COMPLETED,
    );
    if (superDone.length >= 2) {
      throw new BadRequestException('Super Over already complete');
    }

    if (!cricket.superOverPending && superDone.length !== 1) {
      throw new BadRequestException('Super Over not required for this match');
    }

    let battingTeamId: string;
    let bowlingTeamId: string;
    let targetRuns: number | null = null;

    if (superDone.length === 0) {
      const second = cricket.innings.find(
        (i) => i.inningsNumber === 2 && !i.isSuperOver,
      );
      if (!second || second.status !== CricketInningsStatus.COMPLETED) {
        throw new BadRequestException('Regular innings must be complete');
      }
      battingTeamId = second.battingTeamId;
      bowlingTeamId = second.bowlingTeamId;
    } else {
      const firstSo = superDone[0]!;
      battingTeamId = firstSo.bowlingTeamId;
      bowlingTeamId = firstSo.battingTeamId;
      targetRuns = firstSo.runs + 1;
    }

    const nextNumber =
      Math.max(0, ...cricket.innings.map((i) => i.inningsNumber)) + 1;

    await this.prisma.cricketMatch.update({
      where: { id: cricket.id },
      data: { superOverPending: false },
    });

    await this.prisma.cricketInnings.create({
      data: {
        cricketMatchId: cricket.id,
        inningsNumber: nextNumber,
        battingTeamId,
        bowlingTeamId,
        strikerId: input.strikerId,
        nonStrikerId: input.nonStrikerId,
        currentBowlerId: input.bowlerId,
        targetRuns,
        revisedMaxOvers: 1,
        isSuperOver: true,
        status: CricketInningsStatus.IN_PROGRESS,
      },
    });

    await this.emitUpdate(match.tournamentId, matchId);
    return this.getScoreboard(matchId);
  }

  private async loadMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: true,
        homeTeam: true,
        awayTeam: true,
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  private async loadPlayersForMatch(
    match: Awaited<ReturnType<CricketService['loadMatch']>>,
  ) {
    const teamIds = [match.homeTeamId, match.awayTeamId].filter(
      (id): id is string => !!id,
    );
    return this.prisma.teamPlayer.findMany({
      where: { teamId: { in: teamIds } },
      orderBy: [{ teamId: 'asc' }, { order: 'asc' }],
    });
  }

  private async assertCanScore(
    match: Awaited<ReturnType<CricketService['loadMatch']>>,
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

  private async emitUpdate(tournamentId: string, matchId: string) {
    const board = await this.getScoreboard(matchId);
    this.realtime.emitCricketUpdated(tournamentId, matchId, board);
  }

  private async emitStandaloneUpdate(slug: string) {
    const board = await this.getStandaloneScoreboard(slug);
    this.realtime.emitCricketUpdated(`standalone:${slug}`, slug, board);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private makeSlug() {
    return randomBytes(6).toString('base64url').toLowerCase();
  }

  private makeEditToken() {
    return randomBytes(18).toString('base64url');
  }

  private async loadCricketWithInnings(where: { matchId?: string; slug?: string }) {
    return this.prisma.cricketMatch.findFirst({
      where,
      include: {
        innings: {
          orderBy: { inningsNumber: 'asc' },
          include: { balls: { orderBy: { sequence: 'asc' } } },
        },
      },
    });
  }

  private async assertStandaloneEdit(slug: string, token?: string) {
    const cricket = await this.prisma.cricketMatch.findFirst({
      where: { slug, mode: 'STANDALONE' },
    });
    if (!cricket) throw new NotFoundException('Scoreboard not found');
    if (!token || cricket.editTokenHash !== this.hashToken(token)) {
      throw new ForbiddenException('Invalid edit token');
    }
    return cricket;
  }

  private rosterMaps(cricket: {
    homeRoster: unknown;
    awayRoster: unknown;
    homeTeamName: string | null;
    awayTeamName: string | null;
  }) {
    const homeRoster = (cricket.homeRoster ?? []) as Array<{ id: string; name: string }>;
    const awayRoster = (cricket.awayRoster ?? []) as Array<{ id: string; name: string }>;
    const teamMap = new Map<string, string>([
      ['home', cricket.homeTeamName ?? 'Home'],
      ['away', cricket.awayTeamName ?? 'Away'],
    ]);
    const playerMap = new Map<string, string>();
    for (const p of homeRoster) playerMap.set(p.id, p.name);
    for (const p of awayRoster) playerMap.set(p.id, p.name);
    return { teamMap, playerMap, homeRoster, awayRoster };
  }

  async createStandalone(input: CricketCreateStandaloneInput) {
    const maxOvers =
      input.maxOvers ?? DEFAULT_OVERS[input.format ?? 'T20'] ?? DEFAULT_OVERS.T20;
    const slug = this.makeSlug();
    const editToken = this.makeEditToken();

    const maxWickets =
      input.maxWickets ??
      Math.max(
        Math.max(1, input.homePlayers.length - 1),
        Math.max(1, input.awayPlayers.length - 1),
      );
    const bowlerLimits = resolveBowlerLimits(
      maxOvers,
      input.format ?? 'T20',
      input,
    );

    const cricket = await this.prisma.cricketMatch.create({
      data: {
        mode: 'STANDALONE',
        slug,
        title: input.title ?? `${input.homeTeamName} vs ${input.awayTeamName}`,
        editTokenHash: this.hashToken(editToken),
        homeTeamName: input.homeTeamName,
        awayTeamName: input.awayTeamName,
        homeRoster: input.homePlayers,
        awayRoster: input.awayPlayers,
        format: (input.format ?? 'T20') as CricketFormat,
        maxOvers,
        maxWickets,
        ballsPerOver: input.ballsPerOver ?? 6,
        maxOversPerBowler: bowlerLimits.maxOversPerBowler,
        maxBowlersAtLimit: bowlerLimits.maxBowlersAtLimit,
        inningsCount: input.inningsCount ?? 2,
        strikeRotationMode: input.strikeRotationMode ?? 'AUTO',
        tossWinnerSide: input.toss?.winnerSide ?? null,
        tossDecision: input.toss?.decision ?? null,
      },
    });

    return {
      id: cricket.id,
      slug,
      editToken,
      url: `/sports/cricket/live/${slug}`,
      apiPath: `/cricket/standalone/${slug}`,
    };
  }

  async getStandaloneScoreboard(slug: string): Promise<CricketScoreboard> {
    const cricket = await this.loadCricketWithInnings({ slug });
    if (!cricket || cricket.mode !== 'STANDALONE') {
      throw new NotFoundException('Scoreboard not found');
    }
    const { teamMap, playerMap } = this.rosterMaps(cricket);
    const board = buildScoreboard(
      cricket as Parameters<typeof buildScoreboard>[0],
      teamMap,
      playerMap,
      'home',
      'away',
    );
    return {
      ...board,
      homeRoster: (cricket.homeRoster ?? []) as Array<{ id: string; name: string }>,
      awayRoster: (cricket.awayRoster ?? []) as Array<{ id: string; name: string }>,
      toss: this.parseStandaloneToss(cricket),
    };
  }

  async recordStandaloneToss(
    slug: string,
    token: string,
    input: CricketStandaloneTossInput,
  ) {
    const cricket = await this.assertStandaloneEdit(slug, token);
    const full = await this.loadCricketWithInnings({ slug });
    if (
      full?.innings.some(
        (i) =>
          i.status === CricketInningsStatus.IN_PROGRESS ||
          i.status === CricketInningsStatus.COMPLETED,
      )
    ) {
      throw new BadRequestException(
        'Toss cannot be changed after an innings has started',
      );
    }

    await this.prisma.cricketMatch.update({
      where: { id: cricket.id },
      data: {
        tossWinnerSide: input.winnerSide,
        tossDecision: input.decision,
      },
    });

    await this.emitStandaloneUpdate(slug);
    return this.getStandaloneScoreboard(slug);
  }

  private parseStandaloneToss(
    cricket: {
      tossWinnerSide?: string | null;
      tossDecision?: string | null;
      homeTeamName?: string | null;
      awayTeamName?: string | null;
    },
  ): CricketScoreboard['toss'] {
    if (!cricket.tossWinnerSide || !cricket.tossDecision) return null;
    const side = cricket.tossWinnerSide as 'home' | 'away';
    return {
      winnerTeamId: side,
      winnerTeamName:
        side === 'home'
          ? (cricket.homeTeamName ?? 'Home')
          : (cricket.awayTeamName ?? 'Away'),
      decision: cricket.tossDecision as 'BAT' | 'BOWL',
    };
  }

  async setupStandalone(slug: string, token: string, input: CricketSetupInput) {
    await this.assertStandaloneEdit(slug, token);
    const maxOvers =
      input.maxOvers ?? DEFAULT_OVERS[input.format ?? 'T20'] ?? DEFAULT_OVERS.T20;
    const bowlerLimits = resolveBowlerLimits(maxOvers, input.format ?? 'T20', input);
    await this.prisma.cricketMatch.update({
      where: { slug },
      data: {
        format: (input.format ?? 'T20') as CricketFormat,
        maxOvers,
        maxWickets: input.maxWickets ?? 10,
        ballsPerOver: input.ballsPerOver ?? 6,
        maxOversPerBowler: bowlerLimits.maxOversPerBowler,
        maxBowlersAtLimit: bowlerLimits.maxBowlersAtLimit,
        inningsCount: input.inningsCount ?? 2,
        strikeRotationMode: input.strikeRotationMode ?? 'AUTO',
      },
    });
    await this.emitStandaloneUpdate(slug);
    return this.getStandaloneScoreboard(slug);
  }

  async startStandaloneInnings(
    slug: string,
    token: string,
    input: CricketStandaloneStartInningsInput,
  ) {
    const cricket = await this.assertStandaloneEdit(slug, token);
    const battingTeamId = input.battingSide;
    const bowlingTeamId = input.battingSide === 'home' ? 'away' : 'home';

    const full = await this.loadCricketWithInnings({ slug });
    if (!full) throw new NotFoundException();

    if (input.inningsNumber === 2) {
      const first = full.innings.find((i) => i.inningsNumber === 1);
      if (!first || first.status !== CricketInningsStatus.COMPLETED) {
        throw new BadRequestException('First innings must be completed');
      }
    }

    const firstInn = full.innings.find((i) => i.inningsNumber === 1);
    const targetRuns =
      input.inningsNumber === 2 ? (firstInn?.runs ?? 0) + 1 : null;

    this.assertBowlerAllowed(full, { balls: [] }, input.bowlerId);

    await this.prisma.cricketInnings.upsert({
      where: {
        cricketMatchId_inningsNumber: {
          cricketMatchId: cricket.id,
          inningsNumber: input.inningsNumber,
        },
      },
      create: {
        cricketMatchId: cricket.id,
        inningsNumber: input.inningsNumber,
        battingTeamId,
        bowlingTeamId,
        strikerId: input.strikerId,
        nonStrikerId: input.nonStrikerId,
        currentBowlerId: input.bowlerId,
        targetRuns,
        status: CricketInningsStatus.IN_PROGRESS,
      },
      update: {
        battingTeamId,
        bowlingTeamId,
        strikerId: input.strikerId,
        nonStrikerId: input.nonStrikerId,
        currentBowlerId: input.bowlerId,
        targetRuns,
        status: CricketInningsStatus.IN_PROGRESS,
      },
    });

    await this.emitStandaloneUpdate(slug);
    return this.getStandaloneScoreboard(slug);
  }

  async recordStandaloneBall(slug: string, token: string, input: CricketBallInput) {
    await this.assertStandaloneEdit(slug, token);
    const cricket = await this.loadCricketWithInnings({ slug });
    if (!cricket) throw new NotFoundException();
    await this.recordBallCore(cricket, input);
    await this.finalizeStandaloneIfDone(cricket.id);
    await this.emitStandaloneUpdate(slug);
    return this.getStandaloneScoreboard(slug);
  }

  async undoStandaloneBall(slug: string, token: string) {
    await this.assertStandaloneEdit(slug, token);
    const cricket = await this.loadCricketWithInnings({ slug });
    if (!cricket) throw new NotFoundException();
    const innings = [...cricket.innings]
      .reverse()
      .find((i) => i.balls.length > 0);
    if (!innings?.balls.at(-1)) {
      throw new BadRequestException('No balls to undo');
    }
    const ball = innings.balls.at(-1)!;
    const remaining = innings.balls.filter((b) => b.id !== ball.id);
    let runs = 0;
    let wickets = 0;
    let legalBalls = 0;
    let extras = 0;
    for (const b of remaining) {
      runs += b.totalRuns;
      if (b.isWicket) wickets += 1;
      if (b.isLegalDelivery) legalBalls += 1;
      if (b.extraType !== 'NONE') extras += b.extraRuns;
    }
    await this.prisma.$transaction([
      this.prisma.cricketBall.delete({ where: { id: ball.id } }),
      this.prisma.cricketInnings.update({
        where: { id: innings.id },
        data: {
          runs,
          wickets,
          legalBalls,
          extras,
          status: CricketInningsStatus.IN_PROGRESS,
          endReason: null,
          isAllOut: false,
        },
      }),
    ]);
    await this.emitStandaloneUpdate(slug);
    return this.getStandaloneScoreboard(slug);
  }

  async changeStandaloneBowler(slug: string, token: string, bowlerId: string) {
    await this.assertStandaloneEdit(slug, token);
    const cricket = await this.loadCricketWithInnings({ slug });
    if (!cricket) throw new NotFoundException();
    const innings = cricket.innings.find(
      (i) => i.status === CricketInningsStatus.IN_PROGRESS,
    );
    if (!innings) throw new BadRequestException('No innings in progress');
    if (!innings.currentBowlerId) {
      this.assertNotConsecutiveOverBowler(innings, cricket.ballsPerOver, bowlerId);
    }
    this.assertBowlerAllowed(cricket, innings, bowlerId);
    await this.prisma.cricketInnings.update({
      where: { id: innings.id },
      data: { currentBowlerId: bowlerId },
    });
    await this.emitStandaloneUpdate(slug);
    return this.getStandaloneScoreboard(slug);
  }

  async setStandaloneBatsmen(
    slug: string,
    token: string,
    input: CricketSetBatsmenInput,
  ) {
    await this.assertStandaloneEdit(slug, token);
    const cricket = await this.loadCricketWithInnings({ slug });
    if (!cricket) throw new NotFoundException();
    await this.setBatsmenCore(cricket, input);
    await this.emitStandaloneUpdate(slug);
    return this.getStandaloneScoreboard(slug);
  }

  async swapStandaloneStrike(slug: string, token: string) {
    await this.assertStandaloneEdit(slug, token);
    const cricket = await this.loadCricketWithInnings({ slug });
    if (!cricket) throw new NotFoundException();
    await this.swapStrikeCore(cricket);
    await this.emitStandaloneUpdate(slug);
    return this.getStandaloneScoreboard(slug);
  }

  async endStandaloneInnings(slug: string, token: string, input: CricketEndInningsInput) {
    await this.assertStandaloneEdit(slug, token);
    const innings = await this.prisma.cricketInnings.findFirst({
      where: {
        cricketMatch: { slug },
        status: CricketInningsStatus.IN_PROGRESS,
      },
    });
    if (!innings) throw new BadRequestException('No innings in progress');
    await this.prisma.cricketInnings.update({
      where: { id: innings.id },
      data: {
        status: CricketInningsStatus.COMPLETED,
        endReason: input.reason as CricketInningsEndReason,
        isAllOut: input.reason === 'ALL_OUT',
        declared: input.reason === 'DECLARED',
      },
    });
    const cricket = await this.prisma.cricketMatch.findFirst({ where: { slug } });
    if (cricket) await this.finalizeStandaloneIfDone(cricket.id);
    await this.emitStandaloneUpdate(slug);
    return this.getStandaloneScoreboard(slug);
  }

  async declareStandaloneInnings(slug: string, token: string, input: CricketDeclareInput) {
    return this.endStandaloneInnings(slug, token, { reason: 'DECLARED' });
  }

  async applyStandaloneDls(slug: string, token: string, input: CricketDlsInput) {
    await this.assertStandaloneEdit(slug, token);
    const cricket = await this.loadCricketWithInnings({ slug });
    if (!cricket) throw new NotFoundException();
    const first = cricket.innings.find((i) => i.inningsNumber === 1);
    const second = cricket.innings.find((i) => i.inningsNumber === 2);
    if (!first) throw new BadRequestException('First innings required for DLS');
    const dls = computeDlsRevisedTarget({
      firstInningsRuns: first.runs,
      firstInningsLegalBalls: first.legalBalls,
      firstInningsWickets: first.wickets,
      originalMaxOvers: cricket.maxOvers,
      revisedMaxOvers: input.revisedMaxOvers,
      ballsPerOver: cricket.ballsPerOver,
      chaseRuns: second?.runs,
      chaseLegalBalls: second?.legalBalls,
      chaseWickets: second?.wickets,
    });
    await this.prisma.cricketMatch.update({
      where: { id: cricket.id },
      data: { maxOvers: input.revisedMaxOvers },
    });
    if (second) {
      await this.prisma.cricketInnings.update({
        where: { id: second.id },
        data: {
          revisedMaxOvers: input.revisedMaxOvers,
          dlsParScore: dls.revisedTarget,
          targetRuns: dls.revisedTarget,
        },
      });
    }
    await this.emitStandaloneUpdate(slug);
    return this.getStandaloneScoreboard(slug);
  }

  private async recordBallCore(
    cricket: NonNullable<Awaited<ReturnType<CricketService['loadCricketWithInnings']>>>,
    input: CricketBallInput,
    rosterSizes?: Map<string, number>,
  ): Promise<CricketInningsStatus> {
    const innings = cricket.innings.find(
      (i) => i.status === CricketInningsStatus.IN_PROGRESS,
    );
    if (!innings) throw new BadRequestException('No innings in progress');
    this.assertCanRecordBall(innings, cricket, rosterSizes);
    if (input.isWicket && !input.dismissedPlayerId) {
      throw new BadRequestException('dismissedPlayerId required for wicket');
    }

    const autoRotate = (cricket.strikeRotationMode ?? 'AUTO') === 'AUTO';
    const isExtraWideOrNoBall =
      input.extraType === CricketExtraType.WIDE ||
      input.extraType === CricketExtraType.NO_BALL;
    const isLegalDelivery = !isExtraWideOrNoBall;
    if (isLegalDelivery && innings.currentBowlerId) {
      const legalBalls = bowlingLegalBallsByBowler(innings.balls);
      const current = legalBalls[innings.currentBowlerId] ?? 0;
      const settings = {
        maxOversPerBowler: cricket.maxOversPerBowler,
        maxBowlersAtLimit: cricket.maxBowlersAtLimit,
        ballsPerOver: cricket.ballsPerOver,
      };
      const maxOvers = maxLegalOversForBowler(
        innings.currentBowlerId,
        legalBalls,
        settings,
      );
      if (current >= maxOvers * cricket.ballsPerOver) {
        throw new BadRequestException(
          `Bowler has reached their limit (${maxOvers} overs)`,
        );
      }
    }
    const totalRuns = input.runsOffBat + input.extraRuns;
    const lastBall = innings.balls.at(-1);
    const sequence = (lastBall?.sequence ?? 0) + 1;
    const legalBefore = innings.legalBalls;
    const legalAfter = isLegalDelivery ? legalBefore + 1 : legalBefore;
    const ballsPerOver = cricket.ballsPerOver;
    const overNumber = isLegalDelivery
      ? Math.floor((legalAfter - 1) / ballsPerOver) + 1
      : Math.floor(legalBefore / ballsPerOver) + 1;
    const ballInOver = isLegalDelivery
      ? ((legalAfter - 1) % ballsPerOver) + 1
      : (lastBall?.ballInOver ?? 0) + 1;

    let wickets = innings.wickets + (input.isWicket ? 1 : 0);
    let status = innings.status;
    let strikerId: string | null = innings.strikerId;
    let nonStrikerId: string | null = innings.nonStrikerId;
    let currentBowlerId: string | null = innings.currentBowlerId;

    const strikeRuns =
      input.runsOffBat +
      (input.extraType === CricketExtraType.BYE ||
      input.extraType === CricketExtraType.LEG_BYE
        ? input.extraRuns
        : 0);

    if (input.isWicket && input.dismissedPlayerId) {
      if (input.dismissedPlayerId === strikerId) {
        strikerId = null;
      } else if (input.dismissedPlayerId === nonStrikerId) {
        nonStrikerId = null;
      }
    } else if (
      autoRotate &&
      strikeRuns % 2 === 1 &&
      strikerId &&
      nonStrikerId
    ) {
      [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
    }

    const overComplete =
      isLegalDelivery && legalAfter > 0 && legalAfter % ballsPerOver === 0;
    if (autoRotate && overComplete && strikerId && nonStrikerId) {
      [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
    }

    const maxWickets = this.maxWicketsForInnings(
      cricket,
      innings.battingTeamId,
      rosterSizes,
      innings.isSuperOver,
    );
    const effectiveMax = innings.isSuperOver
      ? (innings.revisedMaxOvers ?? 1)
      : (innings.revisedMaxOvers ?? cricket.maxOvers);
    const maxLegalBalls = effectiveMax * ballsPerOver;
    let endReason: CricketInningsEndReason | null = null;
    let isAllOut = false;
    const inningsComplete =
      legalAfter >= maxLegalBalls || wickets >= maxWickets;
    if (inningsComplete) {
      status = CricketInningsStatus.COMPLETED;
      if (wickets >= maxWickets) {
        endReason = CricketInningsEndReason.ALL_OUT;
        isAllOut = true;
      } else {
        endReason = CricketInningsEndReason.OVERS_COMPLETE;
      }
    } else if (overComplete) {
      currentBowlerId = null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cricketBall.create({
        data: {
          inningsId: innings.id,
          sequence,
          overNumber,
          ballInOver,
          batsmanId: innings.strikerId!,
          bowlerId: innings.currentBowlerId!,
          runsOffBat: input.runsOffBat,
          extraType: input.extraType as CricketExtraType,
          extraRuns: input.extraRuns,
          totalRuns,
          isLegalDelivery,
          isWicket: input.isWicket,
          wicketType: input.wicketType ?? null,
          dismissedPlayerId: input.dismissedPlayerId ?? null,
          fielderId: input.fielderId ?? null,
          commentary: input.commentary ?? null,
        },
      });
      await tx.cricketInnings.update({
        where: { id: innings.id },
        data: {
          runs: innings.runs + totalRuns,
          wickets,
          legalBalls: legalAfter,
          extras:
            innings.extras +
            (input.extraType !== CricketExtraType.NONE ? input.extraRuns : 0),
          status,
          endReason,
          isAllOut,
          strikerId,
          nonStrikerId,
          currentBowlerId,
        },
      });
    });

    return status;
  }

  private maxWicketsForInnings(
    cricket: {
      maxWickets: number;
      mode: string;
      homeRoster?: unknown;
      awayRoster?: unknown;
    },
    battingTeamId: string,
    rosterSizes?: Map<string, number>,
    isSuperOver = false,
  ): number {
    if (isSuperOver) return 2;
    const fromMap = rosterSizes?.get(battingTeamId);
    if (fromMap != null && fromMap > 0) {
      return Math.max(1, fromMap - 1);
    }
    if (cricket.mode === 'STANDALONE') {
      const roster =
        battingTeamId === 'home'
          ? (cricket.homeRoster as unknown[] | undefined)
          : (cricket.awayRoster as unknown[] | undefined);
      if (Array.isArray(roster) && roster.length > 0) {
        return Math.max(1, roster.length - 1);
      }
    }
    return cricket.maxWickets;
  }

  private async rosterSizesForMatch(match: {
    homeTeamId: string | null;
    awayTeamId: string | null;
  }) {
    const players = await this.loadPlayersForMatch(match as Parameters<CricketService['loadPlayersForMatch']>[0]);
    const rosterSizes = new Map<string, number>();
    if (match.homeTeamId) {
      rosterSizes.set(
        match.homeTeamId,
        players.filter((p) => p.teamId === match.homeTeamId).length || 11,
      );
    }
    if (match.awayTeamId) {
      rosterSizes.set(
        match.awayTeamId,
        players.filter((p) => p.teamId === match.awayTeamId).length || 11,
      );
    }
    return rosterSizes;
  }

  private assertCanRecordBall(
    innings: {
      battingTeamId: string;
      strikerId: string | null;
      nonStrikerId: string | null;
      currentBowlerId: string | null;
      wickets: number;
      legalBalls: number;
      isSuperOver?: boolean;
    },
    cricket: {
      maxWickets: number;
      mode: string;
      homeRoster?: unknown;
      awayRoster?: unknown;
      ballsPerOver: number;
    },
    rosterSizes?: Map<string, number>,
  ) {
    if (!innings.strikerId) {
      throw new BadRequestException('Set striker first');
    }
    if (!innings.currentBowlerId) {
      throw new BadRequestException('Select bowler before next delivery');
    }
    const maxWkts = this.maxWicketsForInnings(
      cricket,
      innings.battingTeamId,
      rosterSizes,
      innings.isSuperOver,
    );
    const lastMan = innings.wickets >= maxWkts - 1;
    if (!lastMan && !innings.nonStrikerId) {
      throw new BadRequestException('Select new batsman before next delivery');
    }
  }

  private assertNotConsecutiveOverBowler(
    innings: {
      legalBalls: number;
      balls: Array<{ bowlerId: string; isLegalDelivery: boolean }>;
    },
    ballsPerOver: number,
    bowlerId: string,
  ) {
    const prev = lastCompletedOverBowlerId(
      innings.balls,
      innings.legalBalls,
      ballsPerOver,
    );
    if (prev && prev === bowlerId) {
      throw new BadRequestException(
        'Same bowler cannot bowl consecutive overs',
      );
    }
  }

  private assertBowlerAllowed(
    cricket: {
      maxOversPerBowler: number;
      maxBowlersAtLimit: number;
      ballsPerOver: number;
    },
    innings: { balls: Array<{ bowlerId: string; isLegalDelivery: boolean }> },
    bowlerId: string,
  ) {
    const legalBalls = bowlingLegalBallsByBowler(innings.balls);
    const settings = {
      maxOversPerBowler: cricket.maxOversPerBowler,
      maxBowlersAtLimit: cricket.maxBowlersAtLimit,
      ballsPerOver: cricket.ballsPerOver,
    };
    if (!canSelectBowler(bowlerId, legalBalls, settings)) {
      const maxOvers = maxLegalOversForBowler(bowlerId, legalBalls, settings);
      throw new BadRequestException(
        `Bowler cannot bowl more than ${maxOvers} overs in this innings`,
      );
    }
  }

  private async swapStrikeCore(
    cricket: NonNullable<Awaited<ReturnType<CricketService['loadCricketWithInnings']>>>,
  ) {
    if ((cricket.strikeRotationMode ?? 'AUTO') !== 'MANUAL') {
      throw new BadRequestException('Strike swap only available in manual mode');
    }
    const innings = cricket.innings.find(
      (i) => i.status === CricketInningsStatus.IN_PROGRESS,
    );
    if (!innings) {
      throw new BadRequestException('No innings in progress');
    }
    if (!innings.strikerId || !innings.nonStrikerId) {
      throw new BadRequestException('Both batsmen required to swap strike');
    }
    await this.prisma.cricketInnings.update({
      where: { id: innings.id },
      data: {
        strikerId: innings.nonStrikerId,
        nonStrikerId: innings.strikerId,
      },
    });
  }

  private async setBatsmenCore(
    cricket: NonNullable<Awaited<ReturnType<CricketService['loadCricketWithInnings']>>>,
    input: CricketSetBatsmenInput,
    rosterSizes?: Map<string, number>,
  ) {
    const innings = cricket.innings.find(
      (i) => i.status === CricketInningsStatus.IN_PROGRESS,
    );
    if (!innings) {
      throw new BadRequestException('No innings in progress');
    }

    const strikerId = input.strikerId ?? innings.strikerId;
    let nonStrikerId = input.nonStrikerId ?? innings.nonStrikerId;
    const maxWkts = this.maxWicketsForInnings(
      cricket,
      innings.battingTeamId,
      rosterSizes,
    );
    const lastMan = innings.wickets >= maxWkts - 1;

    if (!strikerId) {
      throw new BadRequestException('Striker required');
    }
    if (!lastMan && !nonStrikerId) {
      throw new BadRequestException('Non-striker required');
    }
    if (nonStrikerId && strikerId === nonStrikerId) {
      throw new BadRequestException('Striker and non-striker must differ');
    }

    const dismissed = new Set(
      innings.balls
        .map((b) => b.dismissedPlayerId)
        .filter((id): id is string => !!id),
    );
    for (const id of [strikerId, nonStrikerId].filter(Boolean) as string[]) {
      if (dismissed.has(id)) {
        throw new BadRequestException('Cannot select a dismissed batsman');
      }
    }

    await this.prisma.cricketInnings.update({
      where: { id: innings.id },
      data: {
        strikerId,
        nonStrikerId: lastMan ? null : nonStrikerId,
      },
    });
  }

  private async finalizeStandaloneIfDone(cricketMatchId: string) {
    const cricket = await this.prisma.cricketMatch.findUnique({
      where: { id: cricketMatchId },
      include: { innings: true },
    });
    if (!cricket || cricket.mode !== 'STANDALONE') return;
    const completed = cricket.innings.filter(
      (i) => i.status === CricketInningsStatus.COMPLETED,
    );
    if (completed.length < cricket.inningsCount) return;
    const homeInn = completed.find((i) => i.battingTeamId === 'home');
    const awayInn = completed.find((i) => i.battingTeamId === 'away');
    if (!homeInn || !awayInn) return;
    let homePoints = 0;
    let awayPoints = 0;
    if (homeInn.runs === awayInn.runs) {
      homePoints = computeLeaguePoints('tie');
      awayPoints = computeLeaguePoints('tie');
    } else if (homeInn.runs > awayInn.runs) {
      homePoints = computeLeaguePoints('win');
      awayPoints = computeLeaguePoints('loss');
    } else {
      homePoints = computeLeaguePoints('loss');
      awayPoints = computeLeaguePoints('win');
    }
    await this.prisma.cricketMatch.update({
      where: { id: cricket.id },
      data: { homePoints, awayPoints },
    });
  }
}
