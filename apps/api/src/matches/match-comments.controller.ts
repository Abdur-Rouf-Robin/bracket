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
import { matchCommentSchema } from '@bracket/shared';
import type { MatchCommentInput } from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MatchCommentsService } from './match-comments.service';

@ApiTags('matches')
@Controller('matches/:id/comments')
export class MatchCommentsController {
  constructor(private readonly comments: MatchCommentsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(@Param('id') id: string, @CurrentUser() user: { id: string } | null) {
    return this.comments.list(id, user?.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(matchCommentSchema)) body: MatchCommentInput,
  ) {
    return this.comments.create(id, user.id, body.body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':commentId')
  remove(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.comments.remove(id, commentId, user.id);
  }
}
