import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  scheduleReorderSchema,
  stationSchema,
  stationUpdateSchema,
  type ScheduleReorderInput,
  type StationInput,
  type StationUpdateInput,
} from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SchedulingService } from './scheduling.service';

@ApiTags('scheduling')
@Controller()
export class StationsController {
  constructor(private readonly scheduling: SchedulingService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('tournaments/:id/stations')
  list(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.scheduling.listStations(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tournaments/:id/stations')
  create(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(stationSchema)) body: StationInput,
  ) {
    return this.scheduling.createStation(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('tournaments/:id/stations/reorder')
  reorder(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(scheduleReorderSchema)) body: ScheduleReorderInput,
  ) {
    return this.scheduling.reorderStations(id, user.id, body.ids);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('tournaments/:id/stations/:stationId')
  update(
    @Param('id') id: string,
    @Param('stationId') stationId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(stationUpdateSchema)) body: StationUpdateInput,
  ) {
    return this.scheduling.updateStation(id, stationId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('tournaments/:id/stations/:stationId')
  remove(
    @Param('id') id: string,
    @Param('stationId') stationId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.scheduling.deleteStation(id, stationId, user.id);
  }

  /** Public list (privateDetails only when the viewer manages the tournament). */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('t/:slug/stations')
  publicList(
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string } | null,
  ) {
    return this.scheduling.listPublicStations(slug, user?.id);
  }
}
