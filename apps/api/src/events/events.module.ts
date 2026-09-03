import { Module, forwardRef } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { JobsModule } from '../jobs/jobs.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [
    forwardRef(() => JobsModule),
    forwardRef(() => RealtimeModule),
    TournamentsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
