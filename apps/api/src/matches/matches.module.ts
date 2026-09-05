import { Module, forwardRef } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { JobsModule } from '../jobs/jobs.module';
import { MvpModule } from '../mvp/mvp.module';
import { BracketModule } from '../bracket/bracket.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { RankingsModule } from '../rankings/rankings.module';
import { InboxModule } from '../inbox/inbox.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MatchCommentsController } from './match-comments.controller';
import { MatchCommentsService } from './match-comments.service';

@Module({
  imports: [
    forwardRef(() => RealtimeModule),
    forwardRef(() => JobsModule),
    MvpModule,
    BracketModule,
    forwardRef(() => TournamentsModule),
    RankingsModule,
    InboxModule,
    NotificationsModule,
  ],
  controllers: [MatchesController, MatchCommentsController],
  providers: [MatchesService, MatchCommentsService],
  exports: [MatchesService],
})
export class MatchesModule {}
