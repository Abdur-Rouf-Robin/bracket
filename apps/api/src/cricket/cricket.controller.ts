import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  cricketBallSchema,
  cricketChangeBowlerSchema,
  cricketSetBatsmenSchema,
  cricketEndInningsSchema,
  cricketSetupSchema,
  cricketStartInningsSchema,
  cricketDeclareSchema,
  cricketDlsSchema,
  cricketStartSuperOverSchema,
  cricketFollowOnSchema,
  cricketAbandonSchema,
  cricketManualReportSchema,
  cricketTossSchema,
  type CricketBallInput,
  type CricketChangeBowlerInput,
  type CricketSetBatsmenInput,
  type CricketDeclareInput,
  type CricketDlsInput,
  type CricketEndInningsInput,
  type CricketSetupInput,
  type CricketStartInningsInput,
  type CricketStartSuperOverInput,
  type CricketFollowOnInput,
  type CricketAbandonInput,
  type CricketManualReportInput,
  type CricketTossInput,
} from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CricketService } from './cricket.service';

@ApiTags('cricket')
@Controller('matches/:matchId/cricket')
export class CricketController {
  constructor(private readonly cricket: CricketService) {}

  @Get()
  getScoreboard(@Param('matchId') matchId: string) {
    return this.cricket.getScoreboard(matchId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('setup')
  setup(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketSetupSchema)) body: CricketSetupInput,
  ) {
    return this.cricket.setup(matchId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('innings/start')
  startInnings(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketStartInningsSchema))
    body: CricketStartInningsInput,
  ) {
    return this.cricket.startInnings(matchId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('ball')
  recordBall(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketBallSchema)) body: CricketBallInput,
  ) {
    return this.cricket.recordBall(matchId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('undo')
  undo(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.cricket.undoLastBall(matchId, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('bowler')
  changeBowler(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketChangeBowlerSchema))
    body: CricketChangeBowlerInput,
  ) {
    return this.cricket.changeBowler(matchId, user.id, body.bowlerId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('batsmen')
  setBatsmen(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketSetBatsmenSchema))
    body: CricketSetBatsmenInput,
  ) {
    return this.cricket.setBatsmen(matchId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('swap-strike')
  swapStrike(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.cricket.swapStrike(matchId, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('innings/end')
  endInnings(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketEndInningsSchema))
    body: CricketEndInningsInput,
  ) {
    return this.cricket.endInnings(matchId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('innings/declare')
  declareInnings(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketDeclareSchema))
    body: CricketDeclareInput,
  ) {
    return this.cricket.declareInnings(matchId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('dls')
  applyDls(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketDlsSchema)) body: CricketDlsInput,
  ) {
    return this.cricket.applyDls(matchId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('follow-on')
  enforceFollowOn(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketFollowOnSchema))
    body: CricketFollowOnInput,
  ) {
    return this.cricket.enforceFollowOn(matchId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('super-over/start')
  startSuperOver(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketStartSuperOverSchema))
    body: CricketStartSuperOverInput,
  ) {
    return this.cricket.startSuperOver(matchId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('ensure-squads')
  ensureSquads(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.cricket.ensureSquads(matchId, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('toss')
  recordToss(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketTossSchema)) body: CricketTossInput,
  ) {
    return this.cricket.recordToss(matchId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('report')
  submitManualReport(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketManualReportSchema))
    body: CricketManualReportInput,
  ) {
    return this.cricket.submitManualReport(matchId, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('abandon')
  abandon(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(cricketAbandonSchema))
    body: CricketAbandonInput,
  ) {
    return this.cricket.abandonMatch(matchId, user.id, body);
  }
}
