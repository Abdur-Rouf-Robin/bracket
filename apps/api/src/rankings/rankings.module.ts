import { Module } from '@nestjs/common';
import {
  CommunityRankingsController,
  RankingsController,
} from './rankings.controller';
import { RankingsService } from './rankings.service';

@Module({
  imports: [],
  controllers: [CommunityRankingsController, RankingsController],
  providers: [RankingsService],
  exports: [RankingsService],
})
export class RankingsModule {}
