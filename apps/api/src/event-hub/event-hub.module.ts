import { Module } from '@nestjs/common';
import { EventHubService } from './event-hub.service';
import { EventTicketsService } from './event-tickets.service';
import { EventsController } from './events.controller';
import { PublicEventsController } from './public-events.controller';

/**
 * Event hub: multi-tournament events with ticketing, check-in, stream embeds
 * and per-event admin permissions. Public routes live under `/e/:slug`,
 * management routes under `/events`.
 */
@Module({
  imports: [],
  controllers: [EventsController, PublicEventsController],
  providers: [EventHubService, EventTicketsService],
  exports: [EventHubService, EventTicketsService],
})
export class EventHubModule {}
