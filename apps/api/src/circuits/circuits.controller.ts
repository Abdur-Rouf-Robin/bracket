import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  attachCircuitTournamentSchema,
  classifyCircuitTournamentSchema,
  createCircuitSchema,
  type AttachCircuitTournamentInput,
  type ClassifyCircuitTournamentInput,
  type CreateCircuitInput,
} from '@bracket/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CircuitsService } from './circuits.service';

@ApiTags('circuits')
@Controller('circuits')
export class CircuitsController {
  constructor(private readonly circuits: CircuitsService) {}

  @Get()
  list() {
    return this.circuits.list();
  }

  @Get(':slug')
  getBySlug(
    @Param('slug') slug: string,
    @Query('season') season?: string,
    @Query('region') region?: string,
    @Query('tier') tier?: string,
  ) {
    return this.circuits.getBySlug(slug, { season, region, tier });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(createCircuitSchema)) body: CreateCircuitInput,
  ) {
    return this.circuits.create(user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/tournaments')
  attach(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(attachCircuitTournamentSchema)) body: AttachCircuitTournamentInput,
  ) {
    return this.circuits.attach(id, body, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/tournaments/:tournamentId')
  classify(
    @Param('id') id: string,
    @Param('tournamentId') tournamentId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(classifyCircuitTournamentSchema)) body: ClassifyCircuitTournamentInput,
  ) {
    return this.circuits.classify(id, tournamentId, body, user.id);
  }
}
