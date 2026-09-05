import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  cricketBallSchema,
  cricketChangeBowlerSchema,
  cricketSetBatsmenSchema,
  cricketCreateStandaloneSchema,
  cricketDeclareSchema,
  cricketDlsSchema,
  cricketEndInningsSchema,
  cricketSetupSchema,
  cricketStandaloneStartInningsSchema,
  cricketStandaloneTossSchema,
  cricketStartSuperOverSchema,
  cricketFollowOnSchema,
  cricketAbandonSchema,
  type CricketBallInput,
  type CricketChangeBowlerInput,
  type CricketSetBatsmenInput,
  type CricketCreateStandaloneInput,
  type CricketDeclareInput,
  type CricketDlsInput,
  type CricketEndInningsInput,
  type CricketSetupInput,
  type CricketStandaloneStartInningsInput,
  type CricketStandaloneTossInput,
  type CricketStartSuperOverInput,
  type CricketFollowOnInput,
  type CricketAbandonInput,
} from '@bracket/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CricketService } from './cricket.service';

const EDIT_HEADER = 'x-cricket-edit-token';

@ApiTags('cricket-standalone')
@Controller('cricket/standalone')
export class StandaloneCricketController {
  constructor(private readonly cricket: CricketService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(cricketCreateStandaloneSchema))
    body: CricketCreateStandaloneInput,
  ) {
    return this.cricket.createStandalone(body);
  }

  @Get(':slug')
  getScoreboard(@Param('slug') slug: string) {
    return this.cricket.getStandaloneScoreboard(slug);
  }

  @Post(':slug/toss')
  recordToss(
    @Param('slug') slug: string,
    @Headers(EDIT_HEADER) token: string,
    @Body(new ZodValidationPipe(cricketStandaloneTossSchema))
    body: CricketStandaloneTossInput,
  ) {
    return this.cricket.recordStandaloneToss(slug, token, body);
  }

  @Post(':slug/setup')
  setup(
    @Param('slug') slug: string,
    @Headers(EDIT_HEADER) token: string,
    @Body(new ZodValidationPipe(cricketSetupSchema)) body: CricketSetupInput,
  ) {
    return this.cricket.setupStandalone(slug, token, body);
  }

  @Post(':slug/innings/start')
  startInnings(
    @Param('slug') slug: string,
    @Headers(EDIT_HEADER) token: string,
    @Body(new ZodValidationPipe(cricketStandaloneStartInningsSchema))
    body: CricketStandaloneStartInningsInput,
  ) {
    return this.cricket.startStandaloneInnings(slug, token, body);
  }

  @Post(':slug/ball')
  recordBall(
    @Param('slug') slug: string,
    @Headers(EDIT_HEADER) token: string,
    @Body(new ZodValidationPipe(cricketBallSchema)) body: CricketBallInput,
  ) {
    return this.cricket.recordStandaloneBall(slug, token, body);
  }

  @Post(':slug/undo')
  undo(@Param('slug') slug: string, @Headers(EDIT_HEADER) token: string) {
    return this.cricket.undoStandaloneBall(slug, token);
  }

  @Post(':slug/bowler')
  changeBowler(
    @Param('slug') slug: string,
    @Headers(EDIT_HEADER) token: string,
    @Body(new ZodValidationPipe(cricketChangeBowlerSchema))
    body: CricketChangeBowlerInput,
  ) {
    return this.cricket.changeStandaloneBowler(slug, token, body.bowlerId);
  }

  @Post(':slug/batsmen')
  setBatsmen(
    @Param('slug') slug: string,
    @Headers(EDIT_HEADER) token: string,
    @Body(new ZodValidationPipe(cricketSetBatsmenSchema))
    body: CricketSetBatsmenInput,
  ) {
    return this.cricket.setStandaloneBatsmen(slug, token, body);
  }

  @Post(':slug/swap-strike')
  swapStrike(@Param('slug') slug: string, @Headers(EDIT_HEADER) token: string) {
    return this.cricket.swapStandaloneStrike(slug, token);
  }

  @Post(':slug/innings/end')
  endInnings(
    @Param('slug') slug: string,
    @Headers(EDIT_HEADER) token: string,
    @Body(new ZodValidationPipe(cricketEndInningsSchema))
    body: CricketEndInningsInput,
  ) {
    return this.cricket.endStandaloneInnings(slug, token, body);
  }

  @Post(':slug/innings/declare')
  declareInnings(
    @Param('slug') slug: string,
    @Headers(EDIT_HEADER) token: string,
    @Body(new ZodValidationPipe(cricketDeclareSchema))
    body: CricketDeclareInput,
  ) {
    return this.cricket.declareStandaloneInnings(slug, token, body);
  }

  @Post(':slug/dls')
  applyDls(
    @Param('slug') slug: string,
    @Headers(EDIT_HEADER) token: string,
    @Body(new ZodValidationPipe(cricketDlsSchema)) body: CricketDlsInput,
  ) {
    return this.cricket.applyStandaloneDls(slug, token, body);
  }

  @Post(':slug/follow-on')
  enforceFollowOn(
    @Param('slug') slug: string,
    @Headers(EDIT_HEADER) token: string,
    @Body(new ZodValidationPipe(cricketFollowOnSchema))
    body: CricketFollowOnInput,
  ) {
    return this.cricket.enforceStandaloneFollowOn(slug, token, body);
  }

  @Post(':slug/super-over/start')
  startSuperOver(
    @Param('slug') slug: string,
    @Headers(EDIT_HEADER) token: string,
    @Body(new ZodValidationPipe(cricketStartSuperOverSchema))
    body: CricketStartSuperOverInput,
  ) {
    return this.cricket.startStandaloneSuperOver(slug, token, body);
  }

  @Post(':slug/abandon')
  abandon(
    @Param('slug') slug: string,
    @Headers(EDIT_HEADER) token: string,
    @Body(new ZodValidationPipe(cricketAbandonSchema))
    body: CricketAbandonInput,
  ) {
    return this.cricket.abandonStandalone(slug, token, body);
  }
}
