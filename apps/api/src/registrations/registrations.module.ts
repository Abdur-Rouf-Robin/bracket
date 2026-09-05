import { Module, forwardRef } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { InboxModule } from '../inbox/inbox.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MatchesModule } from '../matches/matches.module';
import {
  ManageRegistrationsController,
  PublicRegistrationsController,
} from './registrations.controller';
import { RegistrationsService } from './registrations.service';

/** Sign-up page, approvals, waitlist, withdraw/reinstate and check-in window. */
@Module({
  imports: [
    forwardRef(() => RealtimeModule),
    InboxModule,
    NotificationsModule,
    forwardRef(() => MatchesModule),
  ],
  controllers: [PublicRegistrationsController, ManageRegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
