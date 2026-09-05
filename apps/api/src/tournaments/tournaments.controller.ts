import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import {
  bulkTeamsSchema,
  bracketPredictionSchema,
  cloneTournamentSchema,
  copyParticipantsSchema,
  createTournamentSchema,
  generateBracketSchema,
  profileForGameName,
  suggestFormatPlans,
  tournamentSignupSchema,
  updateTournamentSchema,
} from '@bracket/shared';
import type {
  BulkTeamsInput,
  CloneTournamentInput,
  CopyParticipantsInput,
  CreateTournamentInput,
  GenerateBracketInput,
  TournamentSignupInput,
  UpdateTournamentInput,
} from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TournamentsService } from './tournaments.service';
import { MvpService } from '../mvp/mvp.service';

@ApiTags('tournaments')
@Controller()
export class TournamentsController {
  constructor(
    private readonly tournaments: TournamentsService,
    private readonly jwt: JwtService,
    private readonly mvp: MvpService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tournaments')
  create(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(createTournamentSchema))
    body: CreateTournamentInput,
  ) {
    return this.tournaments.create(user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('tournaments/mine')
  mine(@CurrentUser() user: { id: string }) {
    return this.tournaments.listMine(user.id);
  }

  @Get('tournaments/browse')
  browse() {
    return this.tournaments.listBrowsable();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('tournaments/:id')
  getById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.tournaments.getOwned(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('tournaments/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(updateTournamentSchema))
    body: UpdateTournamentInput,
  ) {
    return this.tournaments.update(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('tournaments/:id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.tournaments.remove(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tournaments/:id/reset')
  reset(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.tournaments.resetBracket(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tournaments/:id/teams')
  setTeams(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(bulkTeamsSchema)) body: BulkTeamsInput,
  ) {
    return this.tournaments.setTeams(id, user.id, body);
  }

  @Get('format-plans')
  formatPlans(
    @Query('teamCount') teamCountRaw: string,
    @Query('gameName') gameName?: string,
  ) {
    const teamCount = Math.max(0, Math.floor(Number(teamCountRaw) || 0));
    const profile = gameName ? profileForGameName(gameName) : undefined;
    return suggestFormatPlans(teamCount, profile);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('tournaments/:id/format-suggestions')
  suggestions(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.tournaments.formatSuggestions(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tournaments/:id/generate')
  generate(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(generateBracketSchema))
    body: GenerateBracketInput,
  ) {
    return this.tournaments.generate(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('t/:slug/register')
  registerForTournament(
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(tournamentSignupSchema))
    body: TournamentSignupInput,
  ) {
    return this.tournaments.registerForTournament(slug, user.id, body);
  }

  @Get('t/:slug')
  async getPublic(
    @Param('slug') slug: string,
    @Headers('authorization') auth?: string,
    @Headers('x-view-token') viewToken?: string,
  ) {
    let userId: string | undefined;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = this.jwt.verify<{ sub: string }>(auth.slice(7));
        userId = payload.sub;
      } catch {
        /* public guest */
      }
    }
    return this.tournaments.getBySlugForUser(slug, userId, viewToken ?? null);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('t/:slug/check-in')
  checkInSelf(
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.tournaments.checkInSelf(slug, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('tournaments/:id/teams/:teamId/check-in')
  checkInTeam(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: { id: string },
    @Body() body: { checkedIn: boolean },
  ) {
    return this.tournaments.checkInTeam(id, teamId, user.id, body.checkedIn ?? true);
  }

  @Get('t/:slug/draw-audit')
  getDrawAudit(@Param('slug') slug: string) {
    return this.tournaments.getDrawAuditBySlug(slug);
  }

  @Get('t/:slug/mvp')
  getMvpLeaderboard(@Param('slug') slug: string) {
    return this.mvp.getLeaderboardBySlug(slug);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('tournaments/:id/predictions')
  getPredictions(
    @Param('id') id: string,
    @Query('guestKey') guestKey?: string,
    @CurrentUser() user?: { id: string } | null,
  ) {
    return this.tournaments.getBracketPrediction(id, user?.id ?? null, guestKey);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('tournaments/:id/predictions')
  savePredictions(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(bracketPredictionSchema))
    body: {
      picks: Record<string, string>;
      customFields?: Record<string, string | number>;
      guestKey?: string;
      guestName?: string;
    },
    @CurrentUser() user?: { id: string } | null,
  ) {
    return this.tournaments.saveBracketPrediction(id, user?.id ?? null, body);
  }

  // --- Lifecycle tools (sharing workstream) ---------------------------------

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tournaments/:id/clone')
  clone(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cloneTournamentSchema)) body: CloneTournamentInput,
  ) {
    return this.tournaments.clone(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tournaments/:id/teams/copy-from/:sourceId')
  copyParticipants(
    @Param('id') id: string,
    @Param('sourceId') sourceId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(copyParticipantsSchema)) body: CopyParticipantsInput,
  ) {
    return this.tournaments.copyParticipants(id, sourceId, user.id, body.mode);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tournaments/:id/reopen')
  reopen(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.tournaments.reopen(id, user.id);
  }
}
