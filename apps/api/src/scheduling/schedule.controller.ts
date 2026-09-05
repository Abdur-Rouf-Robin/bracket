import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  autoScheduleSchema,
  bulkShiftSchema,
  matchSlotSchema,
  scheduleConfigSchema,
  type AutoScheduleInput,
  type BulkShiftInput,
  type MatchSlotInput,
  type ScheduleConfigInput,
} from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SchedulingService } from './scheduling.service';

/** Manager-only schedule editing (config, auto-schedule, manual slots). */
@ApiTags('scheduling')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tournaments/:id')
export class ScheduleController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get('schedule-config')
  getConfig(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.scheduling.getScheduleConfig(id, user.id);
  }

  @Put('schedule-config')
  saveConfig(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(scheduleConfigSchema)) body: ScheduleConfigInput,
  ) {
    return this.scheduling.saveScheduleConfig(id, user.id, body);
  }

  @Post('schedule/generate')
  generate(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(autoScheduleSchema)) body: AutoScheduleInput,
  ) {
    return this.scheduling.generate(id, user.id, body);
  }

  @Post('schedule/clear')
  clear(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.scheduling.clearSchedule(id, user.id);
  }

  @Post('schedule/shift')
  shift(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(bulkShiftSchema)) body: BulkShiftInput,
  ) {
    return this.scheduling.shiftSchedule(id, user.id, body);
  }

  @Get('schedule/conflicts')
  conflicts(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.scheduling.getConflicts(id, user.id);
  }

  @Patch('matches/:matchId/slot')
  updateSlot(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(matchSlotSchema)) body: MatchSlotInput,
  ) {
    return this.scheduling.updateMatchSlot(id, matchId, user.id, body);
  }
}

/** Public schedule views (referee names / private station notes only for managers). */
@ApiTags('scheduling')
@Controller('t/:slug')
export class PublicScheduleController {
  constructor(private readonly scheduling: SchedulingService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('schedule')
  schedule(
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string } | null,
  ) {
    return this.scheduling.publicSchedule(slug, user?.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('station-queue')
  stationQueue(
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string } | null,
  ) {
    return this.scheduling.stationQueue(slug, user?.id);
  }

  @Get('schedule.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="schedule.ics"')
  @Header('Cache-Control', 'no-cache')
  ics(@Param('slug') slug: string) {
    return this.scheduling.icsFeed(slug);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('teams/:teamId/schedule')
  teamSchedule(
    @Param('slug') slug: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: { id: string } | null,
  ) {
    return this.scheduling.teamSchedule(slug, teamId, user?.id);
  }
}
