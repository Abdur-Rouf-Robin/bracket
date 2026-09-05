import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  publicApiMatchResultSchema,
  publicApiParticipantSchema,
  type PublicApiMatchResultInput,
  type PublicApiParticipantInput,
} from '@bracket/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ApiKeyGuard, RequireScope } from './api-key.guard';
import { PublicApiErrorFilter } from './public-api-error.filter';
import { PublicApiService } from './public-api.service';

/**
 * Public REST API v1 — authenticated with API keys (X-Api-Key header or
 * `Authorization: Bearer brk_live_…`). Errors use `{ error: { code, message } }`.
 */
@ApiTags('public-api-v1')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@UseFilters(PublicApiErrorFilter)
@Controller('v1')
export class PublicApiController {
  constructor(private readonly api: PublicApiService) {}

  @Get('me')
  me(@CurrentUser() user: { id: string; scopes?: string[] }) {
    return { userId: user.id, scopes: user.scopes ?? [] };
  }

  @Get('tournaments')
  list(@CurrentUser() user: { id: string }) {
    return this.api.listMine(user.id);
  }

  @Get('tournaments/:idOrSlug')
  get(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user: { id: string },
    @Query('include') include?: string,
  ) {
    const parts = (include ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.api.get(idOrSlug, user.id, parts);
  }

  @Get('tournaments/:idOrSlug/participants')
  participants(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user: { id: string }) {
    return this.api.participants(idOrSlug, user.id);
  }

  @RequireScope('write')
  @Post('tournaments/:idOrSlug/participants')
  addParticipant(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(publicApiParticipantSchema)) body: PublicApiParticipantInput,
  ) {
    return this.api.addParticipant(idOrSlug, user.id, body);
  }

  @Get('tournaments/:idOrSlug/matches')
  matches(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user: { id: string },
    @Query('state') state?: string,
  ) {
    return this.api.matchesFor(idOrSlug, user.id, state ?? 'all');
  }

  @RequireScope('write')
  @Put('matches/:id')
  setResult(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(publicApiMatchResultSchema)) body: PublicApiMatchResultInput,
  ) {
    return this.api.setMatchResult(id, user.id, body);
  }

  @RequireScope('write')
  @Post('tournaments/:idOrSlug/start')
  start(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user: { id: string }) {
    return this.api.start(idOrSlug, user.id);
  }

  @RequireScope('write')
  @Post('tournaments/:idOrSlug/finalize')
  finalize(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user: { id: string }) {
    return this.api.finalize(idOrSlug, user.id);
  }
}
