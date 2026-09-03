import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { WEBHOOK_QUEUE } from './jobs.service';
import { NotificationsService } from '../notifications/notifications.service';

@Processor(WEBHOOK_QUEUE)
@Injectable()
export class WebhookProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<Record<string, unknown>>) {
    await this.notifications.dispatch(job.data);
  }
}
