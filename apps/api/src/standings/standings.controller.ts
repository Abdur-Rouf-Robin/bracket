import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccessService } from '../common/access.service';
import { StandingsService } from './standings.service';

export const standingAdjustmentSchema = z.object({
  teamId: z.string().min(1),
  groupId: z.string().nullable().optional(),
  points: z
    .number()
    .int()
    .min(-999)
    .max(999)
    .refine((v) => v !== 0, 'Adjustment cannot be zero'),
  reason: z.string().trim().min(1).max(300),
});

export type StandingAdjustmentInput = z.infer<typeof standingAdjustmentSchema>;

@ApiTags('standings')
@Controller('tournaments/:id/standings')
export class StandingsController {
  constructor(
    private readonly standings: StandingsService,
    private readonly access: AccessService,
  ) {}

  /** Public: modifiers are shown on the public standings table too. */
  @Get('adjustments')
  listAdjustments(@Param('id') id: string) {
    return this.standings.listAdjustments(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('adjustments')
  async addAdjustment(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(standingAdjustmentSchema))
    body: StandingAdjustmentInput,
  ) {
    await this.access.requireTournamentManager(id, user.id);
    return this.standings.addAdjustment(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('adjustments/:adjustmentId')
  async removeAdjustment(
    @Param('id') id: string,
    @Param('adjustmentId') adjustmentId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.access.requireTournamentManager(id, user.id);
    return this.standings.removeAdjustment(id, adjustmentId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('recompute')
  async recompute(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.access.requireTournamentManager(id, user.id);
    return this.standings.recompute(id);
  }
}

/** Classic Swiss: manually draw the next round once the current one is finished. */
@ApiTags('tournaments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tournaments/:id/swiss')
export class SwissRoundsController {
  constructor(
    private readonly standings: StandingsService,
    private readonly access: AccessService,
  ) {}

  @Post('next-round')
  async nextRound(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.access.requireTournamentManager(id, user.id);
    return this.standings.generateNextSwissRound(id);
  }
}
