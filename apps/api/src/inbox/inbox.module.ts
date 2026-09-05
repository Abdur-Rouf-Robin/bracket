import { Module } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';

/**
 * In-app notifications. Import this module and inject `InboxService` to
 * push notifications (`notify`, `notifyMany`) from other features.
 */
@Module({
  imports: [],
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
