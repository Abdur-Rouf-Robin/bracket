import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';

import { InjectQueue } from '@nestjs/bullmq';

import { Queue } from 'bullmq';

import { StandingsService } from '../standings/standings.service';

import { NotificationsService } from '../notifications/notifications.service';



export const STANDINGS_QUEUE = 'standings';

export const WEBHOOK_QUEUE = 'webhooks';



@Injectable()

export class JobsService {

  private readonly logger = new Logger(JobsService.name);



  constructor(

    @Optional()

    @InjectQueue(STANDINGS_QUEUE)

    private readonly standingsQueue: Queue | undefined,

    @Optional()

    @InjectQueue(WEBHOOK_QUEUE)

    private readonly webhookQueue: Queue | undefined,

    @Inject(forwardRef(() => StandingsService))

    private readonly standings: StandingsService,

    private readonly notifications: NotificationsService,

  ) {}


  /** Single sync recompute — avoids duplicate work and keeps UI snappy. */

  async recomputeStandings(tournamentId: string) {

    try {

      await this.standings.recompute(tournamentId);

    } catch (err) {

      this.logger.error('Standings recompute failed', err as Error);

    }

  }



  async enqueueStandings(tournamentId: string) {

    return this.recomputeStandings(tournamentId);

  }



  async enqueueWebhook(payload: Record<string, unknown>) {

    if (this.webhookQueue) {

      try {

        await this.webhookQueue.add('dispatch', payload, {

          removeOnComplete: 100,

          removeOnFail: 50,

        });

      } catch (err) {

        this.logger.warn(`Webhook queue skip: ${(err as Error).message}`);

      }

    } else {

      await this.notifications.dispatch(payload);

    }

  }

}


