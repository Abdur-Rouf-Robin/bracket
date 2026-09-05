import { Module } from '@nestjs/common';
import { InboxModule } from '../inbox/inbox.module';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, InboxModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
