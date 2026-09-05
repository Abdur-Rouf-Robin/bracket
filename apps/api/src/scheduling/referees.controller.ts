import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  matchResultSchema,
  refereeSchema,
  refereeUpdateSchema,
  type MatchResultInput,
  type RefereeInput,
  type RefereeUpdateInput,
} from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SchedulingService } from './scheduling.service';

@ApiTags('scheduling')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tournaments/:id/referees')
export class RefereesController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get()
  list(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.scheduling.listReferees(id, user.id);
  }

  @Post()
  create(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(refereeSchema)) body: RefereeInput,
  ) {
    return this.scheduling.createReferee(id, user.id, body);
  }

  @Patch(':refereeId')
  update(
    @Param('id') id: string,
    @Param('refereeId') refereeId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(refereeUpdateSchema)) body: RefereeUpdateInput,
  ) {
    return this.scheduling.updateReferee(id, refereeId, user.id, body);
  }

  @Delete(':refereeId')
  remove(
    @Param('id') id: string,
    @Param('refereeId') refereeId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.scheduling.deleteReferee(id, refereeId, user.id);
  }

  /** Issues a new courtside link `${APP_URL}/r/${token}` (revokes the previous one). */
  @Post(':refereeId/access-link')
  accessLink(
    @Param('id') id: string,
    @Param('refereeId') refereeId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.scheduling.createRefereeAccessLink(id, refereeId, user.id);
  }
}

/** Token-authenticated referee console (no JWT). */
@ApiTags('scheduling')
@Controller('referee/:token')
export class RefereePortalController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get()
  portal(@Param('token') token: string) {
    return this.scheduling.refereePortal(token);
  }

  @Patch('matches/:matchId/result')
  report(
    @Param('token') token: string,
    @Param('matchId') matchId: string,
    @Body(new ZodValidationPipe(matchResultSchema)) body: MatchResultInput,
  ) {
    return this.scheduling.refereeReportResult(token, matchId, body);
  }
}
