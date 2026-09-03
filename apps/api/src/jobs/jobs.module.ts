import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsService, STANDINGS_QUEUE, WEBHOOK_QUEUE } from './jobs.service';
import { StandingsProcessor } from './standings.processor';
import { WebhookProcessor } from './webhook.processor';
import { RealtimeModule } from '../realtime/realtime.module';
import { StandingsModule } from '../standings/standings.module';
import { NotificationsModule } from '../notifications/notifications.module';
const redisEnabled = process.env.REDIS_ENABLED === 'true';

@Module({
  imports: [
    ...(redisEnabled
      ? [
          BullModule.registerQueue(
            { name: STANDINGS_QUEUE },
            { name: WEBHOOK_QUEUE },
          ),
        ]
      : []),
    forwardRef(() => RealtimeModule),
    forwardRef(() => StandingsModule),
    NotificationsModule,
  ],  providers: [
    JobsService,
    ...(redisEnabled ? [StandingsProcessor, WebhookProcessor] : []),
  ],
  exports: [JobsService],
})
export class JobsModule {}
