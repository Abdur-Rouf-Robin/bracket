import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  attachCircuitTournamentSchema,
  createCircuitSchema,
  type AttachCircuitTournamentInput,
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
  getBySlug(@Param('slug') slug: string) {
    return this.circuits.getBySlug(slug);
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
    return this.circuits.attach(id, body.tournamentId, user.id);
  }
}
