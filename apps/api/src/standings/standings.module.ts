import { Module, forwardRef } from '@nestjs/common';
import { StandingsService } from './standings.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { JobsModule } from '../jobs/jobs.module';
import { BracketModule } from '../bracket/bracket.module';

@Module({
  imports: [
    forwardRef(() => RealtimeModule),
    forwardRef(() => JobsModule),
    BracketModule,
  ],
  providers: [StandingsService],
  exports: [StandingsService],
})
export class StandingsModule {}