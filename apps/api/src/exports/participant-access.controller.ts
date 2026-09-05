import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TokenOrQueryAuthGuard } from './token-or-query-auth.guard';
import { ParticipantAccessService } from './participant-access.service';
import { PublicAccessService } from './public-access.service';
import { PdfService } from './pdf.service';
import { safeFilename } from './export-format.util';

@ApiTags('participant-access')
@Controller()
export class ParticipantAccessController {
  constructor(
    private readonly participants: ParticipantAccessService,
    private readonly pub: PublicAccessService,
    private readonly pdf: PdfService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tournaments/:id/teams/:teamId/access-link')
  issueOne(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.participants.issueForTeam(id, teamId, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tournaments/:id/teams/access-links')
  issueAll(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Query('onlyMissing') onlyMissing?: string,
  ) {
    return this.participants.issueForAll(id, user.id, onlyMissing === '1' || onlyMissing === 'true');
  }

  /** One card per team with QR of their personal access page. Re-issues all links. */
  @ApiBearerAuth()
  @UseGuards(TokenOrQueryAuthGuard)
  @Get('tournaments/:id/export/participant-qr.pdf')
  async qrSheet(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    const resolved = await this.pub.resolveManaged(id, user.id);
    const links = await this.participants.issueForAll(id, user.id, false);
    this.pdf.stream(res, `${safeFilename(resolved.tournament.slug)}-participant-qr.pdf`, (doc) =>
      this.pdf.participantQrSheet(
        resolved,
        this.pub.appUrl(),
        links
          .filter((l): l is typeof l & { url: string } => !!l.url)
          .map((l) => ({ teamId: l.teamId, teamName: l.teamName, url: l.url, players: l.players })),
        doc,
      ),
    );
  }

  @Get('p/:token')
  resolve(@Param('token') token: string) {
    return this.participants.resolve(token);
  }

  @Get('p/:token/schedule.ics')
  async ics(@Param('token') token: string, @Res() res: Response) {
    const body = await this.participants.ics(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="my-matches.ics"');
    res.send(body);
  }
}
