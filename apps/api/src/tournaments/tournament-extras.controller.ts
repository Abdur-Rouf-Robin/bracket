import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  assignTeamsToGroupsWithMode,
  colorPoolDraft,
  formatsSupportShareImage,
  shuffleIntoGroups,
  type GroupDrawMode,
  type GroupShuffleMode,
} from '@bracket/bracket-engine';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { buildShareCardPayload, createDrawSeed, hashSeed, teamRosterSchema, tournamentSettingsSchema } from '@bracket/shared';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ShareImagesService } from '../share-images/share-images.service';
import { TournamentsService } from './tournaments.service';

const shuffleGroupsSchema = z.object({
  groupCount: z.number().int().min(2).max(16),
  mode: z
    .enum(['SERPENTINE', 'BALANCED', 'RANDOM', 'POT'])
    .optional(),
});

const colorDraftSchema = z.object({
  teamCount: z.number().int().min(2).max(32),
  pools: z.array(
    z.object({
      color: z.string(),
      itemIds: z.array(z.string()),
    }),
  ),
  target: z.enum(['TEAMS_TO_GROUPS', 'PLAYERS_TO_TEAMS']).default('PLAYERS_TO_TEAMS'),
});

const announcementSchema = z.object({
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(5000),
  pinned: z.boolean().optional().default(false),
});

const shareAdminSchema = z.object({
  email: z.string().email(),
});

const setPoolColorSchema = z.object({
  teamIds: z.array(z.string()).optional(),
  playerIds: z.array(z.string()).optional(),
  poolColor: z.string().nullable(),
});

@ApiTags('tournament-extras')
@Controller('tournaments/:id')
export class TournamentExtrasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly shareImages: ShareImagesService,
    private readonly tournaments: TournamentsService,
  ) {}

  private async requireManage(tournamentId: string, userId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { admins: true },
    });
    if (!t) throw new BadRequestException('Tournament not found');
    const isAdmin =
      t.createdById === userId ||
      t.admins.some((a) => a.userId === userId);
    if (!isAdmin) throw new BadRequestException('Not allowed');
    return t;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('draw-audit')
  async getDrawAudit(@Param('id') id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });
    if (!tournament) throw new BadRequestException('Not found');
    const settings = tournamentSettingsSchema.parse(tournament.settings ?? {});
    if (!settings.auditableDraw) {
      return { enabled: false, log: [], drawSeed: null };
    }
    return {
      enabled: true,
      log: settings.drawAuditLog ?? [],
      drawSeed: settings.drawSeed ?? null,
    };
  }

  @Post('draw/ceremony')
  async runDrawCeremony(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(shuffleGroupsSchema))
    body: z.infer<typeof shuffleGroupsSchema>,
  ) {
    await this.requireManage(id, user.id);
    const result = await this.shuffleGroups(id, user, body);
    const teams = await this.prisma.team.findMany({
      where: { tournamentId: id },
      include: { group: true },
      orderBy: { seed: 'asc' },
    });
    let index = 0;
    for (const team of teams) {
      if (!team.groupId) continue;
      const step = {
        index: index++,
        teamId: team.id,
        teamName: team.name,
        groupId: team.groupId,
        groupName: team.group?.name ?? 'Group',
      };
      this.realtime.emitDrawStep(id, step);
    }
    this.realtime.emitDrawComplete(id);
    return { ok: true, steps: index, tournament: result };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('shuffle/groups')
  async shuffleGroups(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(shuffleGroupsSchema))
    body: z.infer<typeof shuffleGroupsSchema>,
  ) {
    await this.requireManage(id, user.id);
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });
    if (!tournament) throw new BadRequestException('Tournament not found');
    const settings = tournamentSettingsSchema.parse(tournament.settings ?? {});
    const drawMode = (body.mode ??
      settings.groupDrawMode ??
      'SERPENTINE') as GroupDrawMode;

    const teams = await this.prisma.team.findMany({
      where: { tournamentId: id },
      orderBy: { seed: 'asc' },
    });
    if (teams.length < 2) throw new BadRequestException('Need teams first');

    await this.prisma.group.deleteMany({ where: { tournamentId: id } });

    const drawSeed = settings.auditableDraw
      ? createDrawSeed(id, 'shuffle-groups')
      : undefined;
    const inputOrder = teams.map((t) => t.id);
    let outputOrder: string[] = [];

    if (drawMode === 'SERPENTINE') {
      const engineTeams = teams.map((t, idx) => ({
        id: t.id,
        name: t.name,
        seed: t.seed ?? idx + 1,
        groupId: null as string | null,
      }));
      const assigned = assignTeamsToGroupsWithMode(
        engineTeams,
        body.groupCount,
        'SERPENTINE',
        drawSeed,
      );
      outputOrder = assigned.teams.map((t) => t.id);
      for (const g of assigned.groups) {
        const group = await this.prisma.group.create({
          data: {
            tournamentId: id,
            name: g.name,
            order: g.order,
          },
        });
        await this.prisma.team.updateMany({
          where: {
            id: {
              in: assigned.teams
                .filter((t) => t.groupId === g.id)
                .map((t) => t.id),
            },
          },
          data: { groupId: group.id },
        });
      }
    } else {
      const shuffleMode: GroupShuffleMode =
        drawMode === 'POT'
          ? 'POT'
          : drawMode === 'RANDOM'
            ? 'RANDOM'
            : 'BALANCED';
      const plan = shuffleIntoGroups(
        teams.map((t) => ({
          id: t.id,
          name: t.name,
          seed: t.seed,
          poolColor: t.poolColor,
        })),
        body.groupCount,
        shuffleMode,
        drawSeed,
      );
      outputOrder = plan.flatMap((g) => g.itemIds);

      for (const g of plan) {
        const group = await this.prisma.group.create({
          data: {
            tournamentId: id,
            name: `Group ${String.fromCharCode(65 + g.groupIndex)}`,
            order: g.groupIndex,
          },
        });
        await this.prisma.team.updateMany({
          where: { id: { in: g.itemIds } },
          data: { groupId: group.id },
        });
      }
    }

    const nextSettings = {
      ...settings,
      ...(body.mode && body.mode !== settings.groupDrawMode
        ? { groupDrawMode: drawMode }
        : {}),
      ...(drawSeed
        ? {
            drawSeed,
            drawAuditLog: [
              ...(settings.drawAuditLog ?? []),
              {
                at: new Date().toISOString(),
                operation: 'shuffle-groups',
                seed: drawSeed,
                seedHash: hashSeed(drawSeed),
                inputOrder,
                outputOrder,
              },
            ],
          }
        : {}),
    };

    if (
      (body.mode && body.mode !== settings.groupDrawMode) ||
      drawSeed
    ) {
      await this.prisma.tournament.update({
        where: { id },
        data: { settings: nextSettings },
      });
    }

    this.realtime.emitBracketUpdated(id);
    return this.prisma.tournament.findUnique({
      where: { id },
      include: {
        groups: true,
        teams: { include: { players: true }, orderBy: { seed: 'asc' } },
      },
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('shuffle/color-draft')
  async colorDraft(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(colorDraftSchema))
    body: z.infer<typeof colorDraftSchema>,
  ) {
    await this.requireManage(id, user.id);
    const draft = colorPoolDraft({
      pools: body.pools,
      teamCount: body.teamCount,
    });

    if (body.target === 'PLAYERS_TO_TEAMS') {
      const teams = await this.prisma.team.findMany({
        where: { tournamentId: id },
        orderBy: { seed: 'asc' },
        take: body.teamCount,
      });
      if (teams.length < body.teamCount) {
        throw new BadRequestException('Not enough teams for draft');
      }
      for (let i = 0; i < draft.length; i++) {
        const memberIds = draft[i].memberIds;
        // Clear then reassign players to this team
        for (let order = 0; order < memberIds.length; order++) {
          await this.prisma.teamPlayer.update({
            where: { id: memberIds[order] },
            data: { teamId: teams[i].id, order },
          });
        }
      }
    } else {
      // TEAMS_TO_GROUPS using color pools of teams
      await this.prisma.group.deleteMany({ where: { tournamentId: id } });
      for (let i = 0; i < draft.length; i++) {
        const group = await this.prisma.group.create({
          data: {
            tournamentId: id,
            name: `Group ${String.fromCharCode(65 + i)}`,
            order: i,
          },
        });
        await this.prisma.team.updateMany({
          where: { id: { in: draft[i].memberIds } },
          data: { groupId: group.id },
        });
      }
    }

    this.realtime.emitBracketUpdated(id);
    return { ok: true, draft };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('pool-colors')
  async setPoolColors(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(setPoolColorSchema))
    body: z.infer<typeof setPoolColorSchema>,
  ) {
    await this.requireManage(id, user.id);
    if (body.teamIds?.length) {
      await this.prisma.team.updateMany({
        where: { tournamentId: id, id: { in: body.teamIds } },
        data: { poolColor: body.poolColor },
      });
    }
    if (body.playerIds?.length) {
      await this.prisma.teamPlayer.updateMany({
        where: { id: { in: body.playerIds }, team: { tournamentId: id } },
        data: { poolColor: body.poolColor },
      });
    }
    return { ok: true };
  }

  @Get('announcements')
  listAnnouncements(@Param('id') id: string) {
    return this.prisma.announcement.findMany({
      where: { tournamentId: id },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: { author: { select: { id: true, name: true } } },
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('announcements')
  async createAnnouncement(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(announcementSchema))
    body: z.infer<typeof announcementSchema>,
  ) {
    await this.requireManage(id, user.id);
    return this.prisma.announcement.create({
      data: {
        tournamentId: id,
        authorId: user.id,
        title: body.title,
        body: body.body,
        pinned: body.pinned ?? false,
      },
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('announcements/:announcementId')
  async deleteAnnouncement(
    @Param('id') id: string,
    @Param('announcementId') announcementId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.requireManage(id, user.id);
    await this.prisma.announcement.delete({ where: { id: announcementId } });
    return { ok: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('admins')
  async listAdmins(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.requireManage(id, user.id);
    return this.prisma.tournamentAdmin.findMany({
      where: { tournamentId: id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admins')
  async shareAdmin(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(shareAdminSchema))
    body: z.infer<typeof shareAdminSchema>,
  ) {
    const t = await this.requireManage(id, user.id);
    if (t.createdById !== user.id) {
      throw new BadRequestException('Only the owner can share admin access');
    }
    const target = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (!target) throw new BadRequestException('User not found — they must register first');
    return this.prisma.tournamentAdmin.upsert({
      where: {
        tournamentId_userId: { tournamentId: id, userId: target.id },
      },
      create: { tournamentId: id, userId: target.id, role: 'ADMIN' },
      update: {},
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  @Get('matches/:matchId/share-card')
  async shareCard(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });
    if (!tournament) throw new BadRequestException('Not found');
    const settings = tournamentSettingsSchema.parse(tournament.settings ?? {});
    if (!settings.enableShareableMatchImages) {
      throw new BadRequestException('Shareable images disabled');
    }
    if (!formatsSupportShareImage(tournament.format)) {
      throw new BadRequestException(
        'Share images only for Single/Double Elim, Round Robin, and Swiss',
      );
    }
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, tournamentId: id },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
        mvpPlayer: { include: { team: true } },
        playerStats: { where: { isMvp: true } },
        tournament: { include: { game: true, matches: { select: { round: true } } } },
      },
    });
    if (!match) throw new BadRequestException('Match not found');
    if (match.status !== 'COMPLETED') {
      throw new BadRequestException('Match not completed');
    }

    const totalRounds = match.tournament.matches.length
      ? Math.max(...match.tournament.matches.map((m) => m.round))
      : match.round;

    const game = match.tournament.game;
    const mvpStat = match.playerStats[0];
    const hideSeeds = settings.hideSeedNumbers === true;

    return buildShareCardPayload({
      tournamentName: tournament.name,
      gameName: game?.name ?? null,
      format: tournament.format,
      round: match.round,
      bracketSide: match.bracketSide,
      allowPercent: tournament.allowPercent,
      totalRounds,
      home: {
        id: match.homeTeamId,
        name: match.homeTeam?.name ?? 'TBD',
        score: match.homeScore,
        percent: match.homePercent,
        poolColor: match.homeTeam?.poolColor ?? null,
        seed: hideSeeds ? null : match.homeTeam?.seed ?? null,
      },
      away: {
        id: match.awayTeamId,
        name: match.awayTeam?.name ?? 'TBD',
        score: match.awayScore,
        percent: match.awayPercent,
        poolColor: match.awayTeam?.poolColor ?? null,
        seed: hideSeeds ? null : match.awayTeam?.seed ?? null,
      },
      winnerTeamId: match.winnerTeamId,
      winnerName: match.winnerTeam?.name ?? null,
      isDraw: match.isDraw,
      mvp:
        match.mvpPlayer && mvpStat
          ? {
              playerId: match.mvpPlayer.id,
              playerName: match.mvpPlayer.name,
              teamName: match.mvpPlayer.team?.name ?? '',
              mvpScore: mvpStat.mvpScore,
              stats: {
                goals: mvpStat.goals,
                assists: mvpStat.assists,
                points: mvpStat.points,
                kills: mvpStat.kills,
                deaths: mvpStat.deaths,
                rating: mvpStat.rating,
              },
            }
          : match.mvpPlayer
            ? {
                playerId: match.mvpPlayer.id,
                playerName: match.mvpPlayer.name,
                teamName: match.mvpPlayer.team?.name ?? '',
                mvpScore: 0,
                stats: {
                  goals: 0,
                  assists: 0,
                  points: 0,
                  kills: 0,
                  deaths: 0,
                  rating: null,
                },
              }
            : null,
    });
  }

  @Get('matches/:matchId/share/prematch')
  prematchShare(@Param('id') id: string, @Param('matchId') matchId: string) {
    return this.shareImages.prematch(id, matchId);
  }

  @Get('matches/:matchId/share/result-full')
  resultShare(@Param('id') id: string, @Param('matchId') matchId: string) {
    return this.shareImages.result(id, matchId);
  }

  @Get('matches/:matchId/share/mvp')
  mvpShare(@Param('id') id: string, @Param('matchId') matchId: string) {
    return this.shareImages.mvp(id, matchId);
  }

  @Get('teams/:teamId/share/congrats')
  congratsShare(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @Query('stageLabel') stageLabel: string,
    @Query('stageType') stageType?: string,
    @Query('opponent') opponent?: string,
    @Query('score') score?: string,
  ) {
    const type = (stageType ?? 'knockout') as
      | 'group'
      | 'knockout'
      | 'final'
      | 'tournament';
    return this.shareImages.congrats(
      id,
      teamId,
      stageLabel || 'Stage winner',
      type,
      opponent,
      score,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('teams/:teamId/media')
  updateTeamMedia(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(teamRosterSchema)) body: import('@bracket/shared').TeamRosterInput,
  ) {
    return this.tournaments.updateTeamMedia(id, teamId, user.id, body);
  }
}
