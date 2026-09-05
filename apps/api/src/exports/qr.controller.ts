import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import QRCode from 'qrcode';
import { PublicAccessService } from './public-access.service';
import { PdfService } from './pdf.service';
import { safeFilename } from './export-format.util';

@ApiTags('exports')
@Controller('t/:slug')
export class QrController {
  constructor(
    private readonly pub: PublicAccessService,
    private readonly pdf: PdfService,
  ) {}

  private async target(slug: string, auth?: string, viewToken?: string | null) {
    const resolved = await this.pub.resolveBySlug(slug, {
      userId: this.pub.userIdFromAuthHeader(auth),
      viewToken,
    });
    return { resolved, url: `${this.pub.appUrl()}/t/${resolved.tournament.slug}` };
  }

  @Get('qr.png')
  async png(
    @Param('slug') slug: string,
    @Query('size') sizeRaw: string | undefined,
    @Headers('authorization') auth: string | undefined,
    @Headers('x-view-token') viewToken: string | undefined,
    @Res() res: Response,
  ) {
    const { url } = await this.target(slug, auth, viewToken);
    const size = Math.min(2048, Math.max(96, Number(sizeRaw) || 512));
    const buf = await QRCode.toBuffer(url, { type: 'png', width: size, margin: 1 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  }

  @Get('qr.svg')
  async svg(
    @Param('slug') slug: string,
    @Query('size') sizeRaw: string | undefined,
    @Headers('authorization') auth: string | undefined,
    @Headers('x-view-token') viewToken: string | undefined,
    @Res() res: Response,
  ) {
    const { url } = await this.target(slug, auth, viewToken);
    const size = Math.min(2048, Math.max(96, Number(sizeRaw) || 512));
    const svg = await QRCode.toString(url, { type: 'svg', width: size, margin: 1 });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  }

  @Get('qr-poster.pdf')
  async poster(
    @Param('slug') slug: string,
    @Headers('authorization') auth: string | undefined,
    @Headers('x-view-token') viewToken: string | undefined,
    @Res() res: Response,
  ) {
    const { resolved } = await this.target(slug, auth, viewToken);
    this.pdf.stream(res, `${safeFilename(resolved.tournament.slug)}-qr-poster.pdf`, (doc) =>
      this.pdf.qrPoster(resolved, this.pub.appUrl(), doc),
    );
  }
}
