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
import { HealthController } from './health.controller';

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
    AuthModule,
    TournamentsModule,
    MatchesModule,
    CricketModule,
    EventsModule,
    GamesModule,
    UploadsModule,
    RealtimeModule,
    StandingsModule,
    JobsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
