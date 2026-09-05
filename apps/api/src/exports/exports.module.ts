import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { MatchesModule } from '../matches/matches.module';
import { ExportsController } from './exports.controller';
import { QrController } from './qr.controller';
import { ParticipantAccessController } from './participant-access.controller';
import { DiscoveryController } from './discovery.controller';
import { ViewPasswordController } from './view-password.controller';
import { PublicAccessService } from './public-access.service';
import { CsvExportsService } from './csv-exports.service';
import { PdfService } from './pdf.service';
import { ParticipantAccessService } from './participant-access.service';
import { DiscoveryService } from './discovery.service';
import { ViewPasswordService } from './view-password.service';
import { TokenOrQueryAuthGuard } from './token-or-query-auth.guard';

/**
 * Exports & sharing: CSV/PDF exports, participant CSV import, QR codes,
 * participant access pages, discovery/search, spectator password gate.
 */
@Module({
  imports: [AuthModule, RealtimeModule, MatchesModule],
  // Order matters: ParticipantAccessController's
  // `tournaments/:id/export/participant-qr.pdf` must register before the
  // generic `tournaments/:id/export/:file` route.
  controllers: [
    DiscoveryController,
    ParticipantAccessController,
    ExportsController,
    QrController,
    ViewPasswordController,
  ],
  providers: [
    PublicAccessService,
    CsvExportsService,
    PdfService,
    ParticipantAccessService,
    DiscoveryService,
    ViewPasswordService,
    TokenOrQueryAuthGuard,
  ],
  exports: [PublicAccessService, TokenOrQueryAuthGuard, DiscoveryService, ParticipantAccessService],
})
export class ExportsModule {}
