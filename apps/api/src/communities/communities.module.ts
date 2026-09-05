import { Module } from '@nestjs/common';
import {
  CommunitiesController,
  CommunityPublicController,
} from './communities.controller';
import { CommunitiesService } from './communities.service';

@Module({
  imports: [],
  controllers: [CommunitiesController, CommunityPublicController],
  providers: [CommunitiesService],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
