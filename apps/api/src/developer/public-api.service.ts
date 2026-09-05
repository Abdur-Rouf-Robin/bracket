import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { MatchStatus, TournamentStatus } from '@prisma/client';
import { tournamentSettingsSchema, type PublicApiMatchResultInput, type PublicApiParticipantInput } from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { MatchesService } from '../matches/matches.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { WebhooksService } from './webhooks.service';

const TOURNAMENT_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  status: true,
  format: true,
  isPublic: true,
  startAt: true,
  timezone: true,
  venueType: true,
  venueName: true,
  logoUrl: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
  game: { select: { id: true, name: true, category: true } },
  _count: { select: { teams: true, matches: true } },
} as const;

const TEAM_SELECT = {
  id: true,
  name: true,
  seed: true,
  groupId: true,
  logoUrl: true,
  checkedIn: true,
  withdrawn: true,
  players: { select: { id: true, name: true, isCaptain: true, isSub: true }, orderBy: { order: 'asc' as const } },
} as const;

const MATCH_SELECT = {
  id: true,
  key: true,
  round: true,
  position: true,
  bracketSide: true,
  groupId: true,
  status: true,
  homeTeamId: true,
  awayTeamId: true,
  homeScore: true,
  awayScore: true,
  winnerTeamId: true,
  isDraw: true,
  isBye: true,
  isForfeit: true,
  sets: true,
  scheduledAt: true,
  station: true,
  nextMatchId: true,
  updatedAt: true,
  homeTeam: { select: { id: true, name: true, seed: true } },
  awayTeam: { select: { id: true, name: true, seed: true } },
} as const;

@Injectable()
export class PublicApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    @Inject(forwardRef(() => MatchesService))
    private readonly matches: MatchesService,
    @Inject(forwardRef(() => TournamentsService))
    private readonly tournaments: TournamentsService,
    private readonly webhooks: WebhooksService,
  ) {}

  private notFound(): never {
    throw new NotFoundException({ error: { code: 'not_found', message: 'Tournament not found' } });
  }

  private async resolve(idOrSlug: string, userId: string) {
    const t = await this.prisma.tournament.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { ...TOURNAMENT_SELECT, createdById: true, settings: true },
    });
    if (!t) this.notFound();
    const canManage = await this.access.canManageTournament(t.id, userId);
    if (!t.isPublic && !canManage) this.notFound();
    return { t, canManage };
  }

  private requireManage(canManage: boolean) {
    if (!canManage) {
      throw new ForbiddenException({
        error: { code: 'forbidden', message: 'Your API key does not manage this tournament' },
      });
    }
  }

  listMine(userId: string) {
    return this.prisma.tournament.findMany({
      where: { OR: [{ createdById: userId }, { admins: { some: { userId } } }] },
      orderBy: { createdAt: 'desc' },
      select: TOURNAMENT_SELECT,
    });
  }

  async get(idOrSlug: string, userId: string, include: string[]) {
    const { t, canManage } = await this.resolve(idOrSlug, userId);
    const out: Record<string, unknown> = { ...t, settings: undefined, createdById: undefined, canManage };
    delete out.settings;
    delete out.createdById;
    if (include.includes('participants')) {
      out.participants = await this.prisma.team.findMany({
        where: { tournamentId: t.id },
        orderBy: { seed: 'asc' },
        select: TEAM_SELECT,
      });
    }
    if (include.includes('matches')) {
      out.matches = await this.prisma.match.findMany({
        where: { tournamentId: t.id },
        orderBy: [{ bracketSide: 'asc' }, { round: 'asc' }, { position: 'asc' }],
        select: MATCH_SELECT,
      });
    }
    if (include.includes('standings')) {
      out.standings = await this.prisma.standing.findMany({
        where: { tournamentId: t.id },
        orderBy: [{ groupId: 'asc' }, { rank: 'asc' }],
        include: { team: { select: { id: true, name: true } } },
      });
    }
    return out;
  }

  async participants(idOrSlug: string, userId: string) {
    const { t } = await this.resolve(idOrSlug, userId);
    return this.prisma.team.findMany({
      where: { tournamentId: t.id },
      orderBy: { seed: 'asc' },
      select: TEAM_SELECT,
    });
  }

  async addParticipant(idOrSlug: string, userId: string, input: PublicApiParticipantInput) {
    const { t, canManage } = await this.resolve(idOrSlug, userId);
    this.requireManage(canManage);
    const matchCount = await this.prisma.match.count({ where: { tournamentId: t.id } });
    if (matchCount > 0) {
      throw new BadRequestException({
        error: { code: 'bracket_generated', message: 'Participants cannot be added after the bracket is generated' },
      });
    }
    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    const teams = await this.prisma.team.findMany({
      where: { tournamentId: t.id },
      select: { name: true, seed: true },
    });
    if (teams.length >= settings.maxParticipants) {
      throw new BadRequestException({
        error: { code: 'tournament_full', message: `Maximum ${settings.maxParticipants} participants` },
      });
    }
    if (teams.some((x) => x.name.toLowerCase() === input.name.trim().toLowerCase())) {
      throw new BadRequestException({
        error: { code: 'duplicate_name', message: 'A participant with that name already exists' },
      });
    }
    const seed = input.seed ?? Math.max(0, ...teams.map((x) => x.seed ?? 0)) + 1;
    const team = await this.prisma.team.create({
      data: {
        tournamentId: t.id,
        name: input.name.trim(),
        seed,
        players: input.players?.length
          ? { create: input.players.map((name, order) => ({ name, order, isCaptain: order === 0 })) }
          : undefined,
      },
      select: TEAM_SELECT,
    });
    void this.webhooks.dispatchEvent('participant.registered', t.id, {
      participant: { id: team.id, name: team.name, seed: team.seed },
      source: 'api',
    });
    return team;
  }

  async matchesFor(idOrSlug: string, userId: string, state: string) {
    const { t } = await this.resolve(idOrSlug, userId);
    const where =
      state === 'open'
        ? { status: MatchStatus.READY }
        : state === 'complete'
          ? { status: MatchStatus.COMPLETED }
          : state === 'pending'
            ? { status: MatchStatus.PENDING }
            : {};
    return this.prisma.match.findMany({
      where: { tournamentId: t.id, isBye: false, ...where },
      orderBy: [{ bracketSide: 'asc' }, { round: 'asc' }, { position: 'asc' }],
      select: MATCH_SELECT,
    });
  }

  async setMatchResult(matchId: string, userId: string, input: PublicApiMatchResultInput) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, tournamentId: true, homeTeamId: true, awayTeamId: true },
    });
    if (!match) {
      throw new NotFoundException({ error: { code: 'not_found', message: 'Match not found' } });
    }
    const canManage = await this.access.canManageTournament(match.tournamentId, userId);
    this.requireManage(canManage);

    let winnerTeamId = input.winnerId ?? null;
    if (winnerTeamId && winnerTeamId !== match.homeTeamId && winnerTeamId !== match.awayTeamId) {
      throw new BadRequestException({
        error: { code: 'invalid_winner', message: 'winnerId must be one of the two participants' },
      });
    }
    let homeScore = input.homeScore;
    let awayScore = input.awayScore;
    if (input.sets?.length) {
      const homeSets = input.sets.filter((s) => s.home > s.away).length;
      const awaySets = input.sets.filter((s) => s.away > s.home).length;
      homeScore = homeSets;
      awayScore = awaySets;
    }
    if (!winnerTeamId && homeScore !== awayScore) {
      winnerTeamId = homeScore > awayScore ? match.homeTeamId : match.awayTeamId;
    }
    const isDraw = !winnerTeamId && homeScore === awayScore;

    const updated = await this.matches.setResult(matchId, userId, {
      homeScore,
      awayScore,
      homePercent: null,
      awayPercent: null,
      winnerTeamId,
      isDraw,
      isNoResult: false,
      force: input.force ?? false,
      winnersOnly: false,
      isForfeit: false,
      etHomeScore: null,
      etAwayScore: null,
      penHomeScore: null,
      penAwayScore: null,
      mvpPlayerId: null,
      playerStats: [],
      matchMeta: null,
    });

    if (input.sets?.length) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          sets: input.sets,
          homeSetsWon: input.sets.filter((s) => s.home > s.away).length,
          awaySetsWon: input.sets.filter((s) => s.away > s.home).length,
        },
      });
    }

    return this.prisma.match.findUnique({ where: { id: (updated as { id: string }).id ?? matchId }, select: MATCH_SELECT });
  }

  async start(idOrSlug: string, userId: string) {
    const { t, canManage } = await this.resolve(idOrSlug, userId);
    this.requireManage(canManage);
    if (t.createdById !== userId) {
      throw new ForbiddenException({
        error: { code: 'owner_only', message: 'Only the tournament owner can start it' },
      });
    }
    const result = await this.tournaments.generate(t.id, userId, {
      useSavedSettings: true,
    } as Parameters<TournamentsService['generate']>[2]);
    void this.webhooks.dispatchEvent('tournament.started', t.id, { source: 'api' });
    const r = result as { id: string; slug: string; name: string; status: string; format: string | null };
    return { id: r.id, slug: r.slug, name: r.name, status: r.status, format: r.format };
  }

  async finalize(idOrSlug: string, userId: string) {
    const { t, canManage } = await this.resolve(idOrSlug, userId);
    this.requireManage(canManage);
    if (t.status === TournamentStatus.COMPLETED) {
      return { id: t.id, slug: t.slug, status: t.status, alreadyCompleted: true };
    }
    const updated = await this.prisma.tournament.update({
      where: { id: t.id },
      data: { status: TournamentStatus.COMPLETED, completedAt: new Date() },
      select: { id: true, slug: true, status: true, completedAt: true },
    });
    void this.webhooks.dispatchEvent('tournament.completed', t.id, { source: 'api' });
    return updated;
  }
}
