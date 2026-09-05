import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createEventOrderSchema,
  type CreateEventOrderInput,
} from '@bracket/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EventHubService } from './event-hub.service';
import { EventTicketsService } from './event-tickets.service';

/** Public, slug-addressed event routes (`/e/:slug`). */
@ApiTags('events')
@Controller('e')
export class PublicEventsController {
  constructor(
    private readonly events: EventHubService,
    private readonly tickets: EventTicketsService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug')
  getBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string } | null,
  ) {
    return this.events.getBySlug(slug, user?.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post(':slug/orders')
  createOrder(
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string } | null,
    @Body(new ZodValidationPipe(createEventOrderSchema)) body: CreateEventOrderInput,
  ) {
    return this.tickets.createOrder(slug, user?.id, body);
  }

  @Get(':slug/orders/:code')
  lookupOrder(@Param('slug') slug: string, @Param('code') code: string) {
    return this.tickets.lookupOrder(slug, code);
  }
}
