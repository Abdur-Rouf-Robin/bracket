import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { eventResultsSchema } from '@bracket/shared';
import type { EventResultsInput } from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tournaments/:id/events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post('results')
  submit(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(eventResultsSchema)) body: EventResultsInput,
  ) {
    return this.events.submitResults(id, user.id, body);
  }
}
