import { Module, forwardRef } from '@nestjs/common';
import { CricketController } from './cricket.controller';
import { StandaloneCricketController } from './standalone-cricket.controller';
import { CricketService } from './cricket.service';
import { MatchesModule } from '../matches/matches.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    forwardRef(() => MatchesModule),
    TournamentsModule,
    RealtimeModule,
  ],
  controllers: [CricketController, StandaloneCricketController],
  providers: [CricketService],
  exports: [CricketService],
})
export class CricketModule {}
