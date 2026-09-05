import { Module, forwardRef } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { TournamentExtrasController } from './tournament-extras.controller';
import { TournamentsService } from './tournaments.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { JobsModule } from '../jobs/jobs.module';
import { AuthModule } from '../auth/auth.module';
import { MvpModule } from '../mvp/mvp.module';
import { ShareImagesModule } from '../share-images/share-images.module';
import { BracketModule } from '../bracket/bracket.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    forwardRef(() => RealtimeModule),
    forwardRef(() => JobsModule),
    BracketModule,
    MvpModule,
    ShareImagesModule,
  ],
  controllers: [TournamentsController, TournamentExtrasController],
  providers: [TournamentsService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
