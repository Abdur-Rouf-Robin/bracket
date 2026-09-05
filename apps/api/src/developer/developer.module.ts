import { Global, Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MatchesModule } from '../matches/matches.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyGuard } from './api-key.guard';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';

/**
 * Developer platform: API keys, public REST API v1 and outgoing webhooks.
 * Global so `WebhooksService` can be injected by NotificationsService without
 * a module import cycle.
 */
@Global()
@Module({
  imports: [
    AuthModule,
    forwardRef(() => MatchesModule),
    forwardRef(() => TournamentsModule),
  ],
  controllers: [ApiKeysController, WebhooksController, PublicApiController],
  providers: [ApiKeysService, ApiKeyGuard, WebhooksService, PublicApiService],
  exports: [WebhooksService, ApiKeysService, ApiKeyGuard],
})
export class DeveloperModule {}
