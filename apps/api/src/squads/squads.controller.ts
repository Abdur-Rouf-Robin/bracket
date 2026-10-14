import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { savedSquadSchema, type SavedSquadInput } from '@bracket/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccessService } from '../common/access.service';
import { SquadsService } from './squads.service';

@ApiTags('squads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('squads')
export class SquadsController {
  constructor(
    private readonly squads: SquadsService,
    private readonly access: AccessService,
  ) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.squads.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(savedSquadSchema)) body: SavedSquadInput,
  ) {
    return this.squads.create(user.id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.squads.remove(user.id, id);
  }

  @Post(':id/use/:tournamentId')
  async useInTournament(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('tournamentId') tournamentId: string,
  ) {
    await this.access.requireTournamentManager(tournamentId, user.id);
    return this.squads.copyIntoTournament(user.id, id, tournamentId);
  }
}
