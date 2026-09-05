import {
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { InboxService } from './inbox.service';

@ApiTags('inbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  /** `GET /inbox?unread=1&limit=20&cursor=` → { items, unreadCount, nextCursor } */
  @Get()
  list(
    @CurrentUser() user: { id: string },
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.inbox.list(user.id, {
      unread: unread === '1' || unread === 'true',
      limit: limit ? Number(limit) : undefined,
      cursor: cursor || null,
    });
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: { id: string }) {
    return { unreadCount: await this.inbox.unreadCount(user.id) };
  }

  /** Notification preferences are not persisted yet (no column); expose a stable stub. */
  @Get('preferences')
  preferences() {
    return {
      persisted: false,
      channels: {
        inApp: true,
        email: true,
      },
    };
  }

  @Post('read-all')
  readAll(@CurrentUser() user: { id: string }) {
    return this.inbox.markAllRead(user.id);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.inbox.markRead(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.inbox.remove(user.id, id);
  }
}
