import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { MatchesModule } from './matches/matches.module';
import { CricketModule } from './cricket/cricket.module';
import { RealtimeModule } from './realtime/realtime.module';
import { StandingsModule } from './standings/standings.module';
import { JobsModule } from './jobs/jobs.module';
import { EventsModule } from './events/events.module';
import { GamesModule } from './games/games.module';
import { UploadsModule } from './uploads/uploads.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';
import { CommonModule } from './common/common.module';
import { CommunitiesModule } from './communities/communities.module';
import { RankingsModule } from './rankings/rankings.module';
import { TemplatesModule } from './templates/templates.module';
import { EventHubModule } from './event-hub/event-hub.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { ExportsModule } from './exports/exports.module';
import { BillingModule } from './billing/billing.module';
import { DeveloperModule } from './developer/developer.module';
import { InboxModule } from './inbox/inbox.module';
import { AccountModule } from './account/account.module';

const redisEnabled = process.env.REDIS_ENABLED === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...(redisEnabled
      ? [
          BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              connection: {
                url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
                maxRetriesPerRequest: null,
                retryStrategy: (times: number) =>
                  times > 10 ? null : Math.min(times * 300, 3000),
              },
            }),
          }),
        ]
      : []),
    PrismaModule,
    CommonModule,
    AuthModule,
    AccountModule,
    CommunitiesModule,
    RankingsModule,
    TemplatesModule,
    EventHubModule,
    SchedulingModule,
    RegistrationsModule,
    ExportsModule,
    BillingModule,
    DeveloperModule,
    InboxModule,
    TournamentsModule,
    MatchesModule,
    CricketModule,
    EventsModule,
    GamesModule,
    AdminModule,
    UploadsModule,
    RealtimeModule,
    StandingsModule,
    JobsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
