import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { applyEloResult, kFactorFor, type EloScore } from '@bracket/bracket-engine';
import type { CreateRankingInput, UpdateRankingInput } from '@bracket/shared';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';

const publicUserSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  countryCode: true,
} satisfies Prisma.UserSelect;

const rankingInclude = {
  game: { select: { id: true, name: true } },
  _count: { select: { entries: true, tournaments: true } },
} satisfies Prisma.RankingInclude;

type RankingRow = Prisma.RankingGetPayload<{ include: typeof rankingInclude }>;

type MatchForRating = Prisma.MatchGetPayload<{
  include: {
    homeTeam: true;
    awayTeam: true;
    tournament: { select: { id: true; name: true; rankingId: true; communityId: true } };
  };
}>;

type EntryRow = Prisma.RankingEntryGetPayload<Record<string, never>>;

@Injectable()
export class RankingsService {
  private readonly logger = new Logger(RankingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  private async requireRanking(id: string): Promise<RankingRow> {
    const r = await this.prisma.ranking.findUnique({ where: { id }, include: rankingInclude });
    if (!r) throw new NotFoundException('Ranking not found');
    return r;
  }

  async create(communityId: string, actorId: string, input: CreateRankingInput) {
    await this.access.requireCommunityRole(communityId, actorId, 'ADMIN');
    this.validateWindow(input.startAt, input.endAt);
    return this.prisma.ranking.create({
      data: {
        communityId,
        name: input.name,
        description: input.description ?? null,
        gameId: input.gameId || null,
        startAt: input.startAt ? new Date(input.startAt) : null,
        endAt: input.endAt ? new Date(input.endAt) : null,
        startingRating: input.startingRating,
        kFactorNew: input.kFactorNew,
        kFactorNormal: input.kFactorNormal,
        kFactorPro: input.kFactorPro,
        newPlayerMatches: input.newPlayerMatches,
        proThreshold: input.proThreshold,
        isActive: input.isActive ?? true,
      },
      include: rankingInclude,
    });
  }

  private validateWindow(startAt?: string | null, endAt?: string | null) {
    if (startAt && endAt && new Date(startAt) > new Date(endAt)) {
      throw new BadRequestException('Ranking end must be after start');
    }
  }

  async listForCommunity(communityId: string, viewerId: string | null) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    const role = await this.access.communityRole(communityId, viewerId);
    if (!community.isPublic && !role) throw new ForbiddenException('Private community');
    const isAdmin = role === 'ADMIN' || role === 'OWNER';
    return this.prisma.ranking.findMany({
      where: { communityId, ...(isAdmin ? {} : { isActive: true }) },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: rankingInclude,
    });
  }

  async get(
    id: string,
    viewerId: string | null,
    query: { q?: string; page: number; pageSize: number },
  ) {
    const ranking = await this.requireRanking(id);
    const community = await this.prisma.community.findUnique({
      where: { id: ranking.communityId },
      select: { id: true, slug: true, name: true, isPublic: true, logoUrl: true },
    });
    if (!community) throw new NotFoundException('Community not found');
    const viewerRole = await this.access.communityRole(ranking.communityId, viewerId);
    if (!community.isPublic && !viewerRole) throw new ForbiddenException('Private community');

    const where: Prisma.RankingEntryWhereInput = {
      rankingId: id,
      ...(query.q
        ? {
            OR: [
              { displayName: { contains: query.q, mode: 'insensitive' } },
              { user: { name: { contains: query.q, mode: 'insensitive' } } },
              { user: { username: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, entries] = await this.prisma.$transaction([
      this.prisma.rankingEntry.count({ where }),
      this.prisma.rankingEntry.findMany({
        where,
        orderBy: [{ rating: 'desc' }, { matchesPlayed: 'desc' }, { displayName: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { user: { select: publicUserSelect } },
      }),
    ]);

    // Rank numbers must reflect the global order, not the filtered page, so
    // when searching we resolve each entry's rank against the full table.
    let ranks: Map<string, number> | null = null;
    if (query.q) {
      const all = await this.prisma.rankingEntry.findMany({
        where: { rankingId: id },
        orderBy: [{ rating: 'desc' }, { matchesPlayed: 'desc' }, { displayName: 'asc' }],
        select: { id: true },
      });
      ranks = new Map(all.map((e, i) => [e.id, i + 1]));
    }
    const offset = (query.page - 1) * query.pageSize;

    const tournaments = await this.prisma.tournament.findMany({
      where: { rankingId: id },
      orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, name: true, slug: true, status: true, startAt: true },
    });

    return {
      ranking,
      community,
      viewerRole,
      entries: entries.map((e, i) => ({
        ...e,
        rank: ranks ? ranks.get(e.id) ?? offset + i + 1 : offset + i + 1,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      tournaments,
    };
  }

  async update(id: string, actorId: string, input: UpdateRankingInput) {
    const ranking = await this.requireRanking(id);
    await this.access.requireCommunityRole(ranking.communityId, actorId, 'ADMIN');
    this.validateWindow(
      input.startAt === undefined ? ranking.startAt?.toISOString() : input.startAt,
      input.endAt === undefined ? ranking.endAt?.toISOString() : input.endAt,
    );
    return this.prisma.ranking.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        gameId: input.gameId === undefined ? undefined : input.gameId || null,
        startAt:
          input.startAt === undefined ? undefined : input.startAt ? new Date(input.startAt) : null,
        endAt: input.endAt === undefined ? undefined : input.endAt ? new Date(input.endAt) : null,
        startingRating: input.startingRating,
        kFactorNew: input.kFactorNew,
        kFactorNormal: input.kFactorNormal,
        kFactorPro: input.kFactorPro,
        newPlayerMatches: input.newPlayerMatches,
        proThreshold: input.proThreshold,
        isActive: input.isActive,
      },
      include: rankingInclude,
    });
  }

  async remove(id: string, actorId: string) {
    const ranking = await this.requireRanking(id);
    await this.access.requireCommunityRole(ranking.communityId, actorId, 'ADMIN');
    await this.prisma.ranking.delete({ where: { id } });
    return { ok: true };
  }

  async getEntry(id: string, entryId: string, viewerId: string | null) {
    const ranking = await this.requireRanking(id);
    const community = await this.prisma.community.findUnique({
      where: { id: ranking.communityId },
      select: { isPublic: true },
    });
    if (community && !community.isPublic) {
      if (!(await this.access.communityRole(ranking.communityId, viewerId))) {
        throw new ForbiddenException('Private community');
      }
    }
    const entry = await this.prisma.rankingEntry.findFirst({
      where: { id: entryId, rankingId: id },
      include: {
        user: { select: publicUserSelect },
        history: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!entry) throw new NotFoundException('Entry not found');
    const higher = await this.prisma.rankingEntry.count({
      where: { rankingId: id, rating: { gt: entry.rating } },
    });
    const tournamentIds = [
      ...new Set(entry.history.map((h) => h.tournamentId).filter((t): t is string => !!t)),
    ];
    const tournaments = tournamentIds.length
      ? await this.prisma.tournament.findMany({
          where: { id: { in: tournamentIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const tMap = new Map(tournaments.map((t) => [t.id, t]));
    return {
      ...entry,
      rank: higher + 1,
      history: entry.history.map((h) => ({
        ...h,
        tournament: h.tournamentId ? tMap.get(h.tournamentId) ?? null : null,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // Tournament assignment
  // -------------------------------------------------------------------------

  async assignTournament(id: string, tournamentId: string, actorId: string) {
    const ranking = await this.requireRanking(id);
    const t = await this.access.requireTournamentManager(tournamentId, actorId);
    if (t.communityId !== ranking.communityId) {
      throw new BadRequestException(
        'Tournament must belong to the same community as the ranking',
      );
    }
    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { rankingId: id },
      select: { id: true, name: true, slug: true, rankingId: true },
    });
  }

  async unassignTournament(id: string, tournamentId: string, actorId: string) {
    await this.requireRanking(id);
    const t = await this.access.requireTournamentManager(tournamentId, actorId);
    if (t.rankingId !== id) throw new BadRequestException('Tournament is not in this ranking');
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { rankingId: null },
    });
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Elo processing
  // -------------------------------------------------------------------------

  private inWindow(ranking: { startAt: Date | null; endAt: Date | null }, at: Date) {
    if (ranking.startAt && at < ranking.startAt) return false;
    if (ranking.endAt && at > ranking.endAt) return false;
    return true;
  }

  private isRatable(match: MatchForRating): boolean {
    if (match.status !== 'COMPLETED') return false;
    if (match.isBye || match.isNoResult) return false;
    if (!match.homeTeam || !match.awayTeam) return false;
    if (!match.isDraw && !match.winnerTeamId) return false;
    return true;
  }

  private async resolveEntry(
    tx: Prisma.TransactionClient,
    ranking: { id: string; startingRating: number },
    team: { name: string; registeredByUserId: string | null },
  ): Promise<EntryRow> {
    if (team.registeredByUserId) {
      const user = await tx.user.findUnique({
        where: { id: team.registeredByUserId },
        select: { id: true, name: true, username: true },
      });
      if (user) {
        const existing = await tx.rankingEntry.findUnique({
          where: { rankingId_userId: { rankingId: ranking.id, userId: user.id } },
        });
        if (existing) return existing;
        // displayName is unique per ranking too; fall back if a guest entry already claims it.
        const displayName = await this.freeDisplayName(tx, ranking.id, team.name);
        return tx.rankingEntry.create({
          data: {
            rankingId: ranking.id,
            userId: user.id,
            displayName,
            rating: ranking.startingRating,
            peakRating: ranking.startingRating,
          },
        });
      }
    }
    const existing = await tx.rankingEntry.findUnique({
      where: { rankingId_displayName: { rankingId: ranking.id, displayName: team.name } },
    });
    if (existing) return existing;
    return tx.rankingEntry.create({
      data: {
        rankingId: ranking.id,
        displayName: team.name,
        rating: ranking.startingRating,
        peakRating: ranking.startingRating,
      },
    });
  }

  private async freeDisplayName(
    tx: Prisma.TransactionClient,
    rankingId: string,
    base: string,
  ): Promise<string> {
    let candidate = base;
    for (let i = 2; i < 100; i++) {
      const clash = await tx.rankingEntry.findUnique({
        where: { rankingId_displayName: { rankingId, displayName: candidate } },
        select: { id: true },
      });
      if (!clash) return candidate;
      candidate = `${base} (${i})`;
    }
    return `${base} (${Date.now().toString(36)})`;
  }

  /**
   * Apply a completed match to its tournament's ranking. Idempotent per match.
   * Safe to call from anywhere; never throws for "not applicable" cases.
   */
  async onMatchCompleted(matchId: string): Promise<{ applied: boolean; reason?: string }> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: { select: { id: true, name: true, rankingId: true, communityId: true } },
      },
    });
    if (!match) return { applied: false, reason: 'match_not_found' };
    if (!match.tournament.rankingId) return { applied: false, reason: 'no_ranking' };
    const ranking = await this.prisma.ranking.findUnique({
      where: { id: match.tournament.rankingId },
    });
    if (!ranking || !ranking.isActive) return { applied: false, reason: 'ranking_inactive' };
    return this.applyMatch(ranking, match);
  }

  private async applyMatch(
    ranking: Prisma.RankingGetPayload<Record<string, never>>,
    match: MatchForRating,
  ): Promise<{ applied: boolean; reason?: string }> {
    if (!this.isRatable(match)) return { applied: false, reason: 'not_ratable' };
    if (!this.inWindow(ranking, match.updatedAt)) return { applied: false, reason: 'outside_window' };

    return this.prisma.$transaction(async (tx) => {
      const already = await tx.ratingHistory.findFirst({
        where: { rankingId: ranking.id, matchId: match.id },
        select: { id: true },
      });
      if (already) return { applied: false, reason: 'already_applied' };

      const home = match.homeTeam!;
      const away = match.awayTeam!;
      const entryA = await this.resolveEntry(tx, ranking, home);
      const entryB = await this.resolveEntry(tx, ranking, away);
      if (entryA.id === entryB.id) return { applied: false, reason: 'same_entry' };

      const scoreA: EloScore = match.isDraw ? 0.5 : match.winnerTeamId === home.id ? 1 : 0;
      const kA = kFactorFor(entryA, ranking);
      const kB = kFactorFor(entryB, ranking);
      const result = applyEloResult({
        ratingA: entryA.rating,
        ratingB: entryB.rating,
        kA,
        kB,
        scoreA,
      });

      const resultA = scoreA === 1 ? 'W' : scoreA === 0.5 ? 'D' : 'L';
      const resultB = scoreA === 0 ? 'W' : scoreA === 0.5 ? 'D' : 'L';
      const playedAt = match.updatedAt;

      await tx.rankingEntry.update({
        where: { id: entryA.id },
        data: {
          rating: result.newA,
          peakRating: Math.max(entryA.peakRating, result.newA),
          wins: { increment: resultA === 'W' ? 1 : 0 },
          losses: { increment: resultA === 'L' ? 1 : 0 },
          draws: { increment: resultA === 'D' ? 1 : 0 },
          matchesPlayed: { increment: 1 },
          lastPlayedAt: playedAt,
        },
      });
      await tx.rankingEntry.update({
        where: { id: entryB.id },
        data: {
          rating: result.newB,
          peakRating: Math.max(entryB.peakRating, result.newB),
          wins: { increment: resultB === 'W' ? 1 : 0 },
          losses: { increment: resultB === 'L' ? 1 : 0 },
          draws: { increment: resultB === 'D' ? 1 : 0 },
          matchesPlayed: { increment: 1 },
          lastPlayedAt: playedAt,
        },
      });
      await tx.ratingHistory.createMany({
        data: [
          {
            rankingId: ranking.id,
            entryId: entryA.id,
            matchId: match.id,
            tournamentId: match.tournamentId,
            opponentName: entryB.displayName,
            result: resultA,
            delta: result.deltaA,
            ratingAfter: result.newA,
            createdAt: playedAt,
          },
          {
            rankingId: ranking.id,
            entryId: entryB.id,
            matchId: match.id,
            tournamentId: match.tournamentId,
            opponentName: entryA.displayName,
            result: resultB,
            delta: result.deltaB,
            ratingAfter: result.newB,
            createdAt: playedAt,
          },
        ],
      });
      return { applied: true };
    });
  }

  /** Wipe and replay every ratable match of the ranking's tournaments in chronological order. */
  async recompute(id: string, actorId: string) {
    const ranking = await this.requireRanking(id);
    await this.access.requireCommunityRole(ranking.communityId, actorId, 'ADMIN');

    await this.prisma.$transaction([
      this.prisma.ratingHistory.deleteMany({ where: { rankingId: id } }),
      this.prisma.rankingEntry.deleteMany({ where: { rankingId: id } }),
    ]);

    const matches = await this.prisma.match.findMany({
      where: {
        tournament: { rankingId: id },
        status: 'COMPLETED',
        isBye: false,
        isNoResult: false,
      },
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: { select: { id: true, name: true, rankingId: true, communityId: true } },
      },
    });

    let applied = 0;
    let skipped = 0;
    for (const m of matches) {
      try {
        const r = await this.applyMatch(ranking, m);
        if (r.applied) applied += 1;
        else skipped += 1;
      } catch (err) {
        skipped += 1;
        this.logger.warn(`Recompute skipped match ${m.id}: ${(err as Error).message}`);
      }
    }
    const entries = await this.prisma.rankingEntry.count({ where: { rankingId: id } });
    return { ok: true, matches: matches.length, applied, skipped, entries };
  }
}
