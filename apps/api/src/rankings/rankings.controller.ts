import {
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
import {
  createRankingSchema,
  rankingEntriesQuerySchema,
  updateRankingSchema,
  type CreateRankingInput,
  type UpdateRankingInput,
} from '@bracket/shared';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RankingsService } from './rankings.service';

type MaybeUser = { id: string } | null | undefined;

@ApiTags('rankings')
@Controller('communities/:communityId/rankings')
export class CommunityRankingsController {
  constructor(private readonly rankings: RankingsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(@Param('communityId') communityId: string, @CurrentUser() user: MaybeUser) {
    return this.rankings.listForCommunity(communityId, user?.id ?? null);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Param('communityId') communityId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(createRankingSchema)) body: CreateRankingInput,
  ) {
    return this.rankings.create(communityId, user.id, body);
  }
}

@ApiTags('rankings')
@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankings: RankingsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  get(
    @Param('id') id: string,
    @CurrentUser() user: MaybeUser,
    @Query(new ZodValidationPipe(rankingEntriesQuerySchema))
    query: z.infer<typeof rankingEntriesQuerySchema>,
  ) {
    return this.rankings.get(id, user?.id ?? null, query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(updateRankingSchema)) body: UpdateRankingInput,
  ) {
    return this.rankings.update(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.rankings.remove(id, user.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/entries/:entryId')
  entry(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: MaybeUser,
  ) {
    return this.rankings.getEntry(id, entryId, user?.id ?? null);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/tournaments/:tournamentId')
  assign(
    @Param('id') id: string,
    @Param('tournamentId') tournamentId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.rankings.assignTournament(id, tournamentId, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/tournaments/:tournamentId')
  unassign(
    @Param('id') id: string,
    @Param('tournamentId') tournamentId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.rankings.unassignTournament(id, tournamentId, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/recompute')
  recompute(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.rankings.recompute(id, user.id);
  }
}
