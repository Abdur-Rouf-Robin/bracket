import { Module, forwardRef } from '@nestjs/common';
import { StandingsService } from './standings.service';
import { StandingsController, SwissRoundsController } from './standings.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { JobsModule } from '../jobs/jobs.module';
import { BracketModule } from '../bracket/bracket.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => RealtimeModule),
    forwardRef(() => JobsModule),
    BracketModule,
  ],
  controllers: [StandingsController, SwissRoundsController],
  providers: [StandingsService],
  exports: [StandingsService],
})
export class StandingsModule {}
