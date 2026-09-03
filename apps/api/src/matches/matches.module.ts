import { Module, forwardRef } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { JobsModule } from '../jobs/jobs.module';
import { MvpModule } from '../mvp/mvp.module';
import { BracketModule } from '../bracket/bracket.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [
    forwardRef(() => RealtimeModule),
    forwardRef(() => JobsModule),
    MvpModule,
    BracketModule,
    forwardRef(() => TournamentsModule),
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
