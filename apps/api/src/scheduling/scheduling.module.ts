import { Module, forwardRef } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { MatchesModule } from '../matches/matches.module';
import { SchedulingService } from './scheduling.service';
import { StationsController } from './stations.controller';
import { RefereePortalController, RefereesController } from './referees.controller';
import { PublicScheduleController, ScheduleController } from './schedule.controller';

/**
 * Stations, referees, match times, automated scheduling, station queue,
 * public schedule + .ics feed, referee console.
 */
@Module({
  imports: [forwardRef(() => RealtimeModule), forwardRef(() => MatchesModule)],
  controllers: [
    StationsController,
    RefereesController,
    RefereePortalController,
    ScheduleController,
    PublicScheduleController,
  ],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
