import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { matchResultSchema, matchScheduleSchema, matchAttachmentSchema, matchVoteSchema } from '@bracket/shared';
import type { MatchResultInput } from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MatchesService } from './matches.service';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get(':id/votes')
  getVotes(@Param('id') id: string) {
    return this.matches.getMatchVotes(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/vote')
  vote(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(matchVoteSchema)) body: { teamId: string },
  ) {
    return this.matches.voteMatch(id, user.id, body.teamId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/result')
  setResult(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(matchResultSchema)) body: MatchResultInput,
  ) {
    return this.matches.setResult(id, user.id, body);
  }

  @Delete(':id/result')
  clearResult(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.matches.clearResult(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/schedule')
  updateSchedule(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(matchScheduleSchema))
    body: import('@bracket/shared').MatchScheduleInput,
  ) {
    return this.matches.updateSchedule(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/attachment')
  updateAttachment(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(matchAttachmentSchema))
    body: import('@bracket/shared').MatchAttachmentInput,
  ) {
    return this.matches.updateAttachment(id, user.id, body);
  }
}
