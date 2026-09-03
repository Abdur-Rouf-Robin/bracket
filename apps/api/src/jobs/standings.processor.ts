import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { StandingsService } from '../standings/standings.service';
import { STANDINGS_QUEUE } from './jobs.service';

@Processor(STANDINGS_QUEUE)
@Injectable()
export class StandingsProcessor extends WorkerHost {
  private readonly logger = new Logger(StandingsProcessor.name);

  constructor(private readonly standings: StandingsService) {
    super();
  }

  async process(job: Job<{ tournamentId: string }>) {
    this.logger.log(`Queue recompute standings for ${job.data.tournamentId}`);
    await this.standings.recompute(job.data.tournamentId);
  }
}
