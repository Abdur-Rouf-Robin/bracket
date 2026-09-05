import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createWebhookSchema,
  updateWebhookSchema,
  type CreateWebhookInput,
  type UpdateWebhookInput,
} from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WebhooksService } from './webhooks.service';

@ApiTags('developer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('developer/webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  list(
    @CurrentUser() user: { id: string },
    @Query('tournamentId') tournamentId?: string,
    @Query('communityId') communityId?: string,
  ) {
    return this.webhooks.list(user.id, {
      tournamentId: tournamentId || undefined,
      communityId: communityId || undefined,
    });
  }

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(createWebhookSchema)) body: CreateWebhookInput,
  ) {
    return this.webhooks.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWebhookSchema)) body: UpdateWebhookInput,
  ) {
    return this.webhooks.update(user.id, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.webhooks.remove(user.id, id);
  }

  @Post(':id/test')
  test(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.webhooks.test(user.id, id);
  }
}
