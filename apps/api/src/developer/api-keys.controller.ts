import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createApiKeySchema, type CreateApiKeyInput } from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ApiKeysService } from './api-keys.service';

@ApiTags('developer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('developer/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.apiKeys.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(createApiKeySchema)) body: CreateApiKeyInput,
  ) {
    return this.apiKeys.create(user.id, body);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.apiKeys.revoke(user.id, id);
  }
}
