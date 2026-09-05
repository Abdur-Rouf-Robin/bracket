import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { tournamentSearchQuerySchema, type TournamentSearchQuery } from '@bracket/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DiscoveryService } from './discovery.service';

/**
 * Public discovery endpoints. Registered under both `/tournaments/...` (spec)
 * and `/discover/...` (collision-proof alias — `/tournaments/:id` in the
 * tournaments controller is JWT-guarded and route order depends on module
 * registration order).
 */
@ApiTags('discovery')
@Controller()
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get(['tournaments/search', 'discover/search'])
  search(@Query(new ZodValidationPipe(tournamentSearchQuerySchema)) q: TournamentSearchQuery) {
    return this.discovery.search(q);
  }

  @Get(['tournaments/featured', 'discover/featured'])
  featured(@Query('limit') limit?: string) {
    const n = Math.min(24, Math.max(1, Number(limit) || 8));
    return this.discovery.featured(n);
  }

  @Get('discover/landing')
  landing() {
    return this.discovery.landing();
  }
}
