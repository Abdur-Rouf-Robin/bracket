import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CSV_EXPORT_KINDS,
  IMPORT_TEMPLATE_CSV,
  PDF_EXPORT_KINDS,
  PUBLIC_CSV_EXPORT_KINDS,
  importParticipantsSchema,
  type CsvExportKind,
  type ImportParticipantsInput,
  type PdfExportKind,
} from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TokenOrQueryAuthGuard } from './token-or-query-auth.guard';
import { PublicAccessService } from './public-access.service';
import { CsvExportsService } from './csv-exports.service';
import { PdfService } from './pdf.service';
import { safeFilename } from './export-format.util';

function stripExt(value: string, ext: string): string {
  return value.endsWith(ext) ? value.slice(0, -ext.length) : value;
}

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send('\ufeff' + csv);
}

@ApiTags('exports')
@Controller()
export class ExportsController {
  constructor(
    private readonly pub: PublicAccessService,
    private readonly csv: CsvExportsService,
    private readonly pdf: PdfService,
  ) {}

  // ---------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------

  @Get('tournaments/import/template.csv')
  importTemplate(@Res() res: Response) {
    sendCsv(res, 'participants-template.csv', IMPORT_TEMPLATE_CSV);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tournaments/:id/import/participants')
  importParticipants(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(importParticipantsSchema)) body: ImportParticipantsInput,
  ) {
    return this.csv.importParticipants(id, user.id, body);
  }

  // ---------------------------------------------------------------------
  // Manager CSV exports (Bearer or ?access_token=)
  // ---------------------------------------------------------------------

  @ApiBearerAuth()
  @UseGuards(TokenOrQueryAuthGuard)
  @Get('tournaments/:id/export/:file')
  async managerCsv(
    @Param('id') id: string,
    @Param('file') file: string,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    const kind = stripExt(file, '.csv') as CsvExportKind;
    if (!file.endsWith('.csv') || !CSV_EXPORT_KINDS.includes(kind)) {
      throw new BadRequestException(`Unknown export. Use one of: ${CSV_EXPORT_KINDS.map((k) => `${k}.csv`).join(', ')}`);
    }
    const resolved = await this.pub.resolveManaged(id, user.id);
    const csv = await this.csv.build(kind, resolved);
    sendCsv(res, `${safeFilename(resolved.tournament.slug)}-${kind}.csv`, csv);
  }

  // ---------------------------------------------------------------------
  // Public CSV + PDF exports (respect isPublic + view password)
  // ---------------------------------------------------------------------

  @Get('t/:slug/export/:file')
  async publicExport(
    @Param('slug') slug: string,
    @Param('file') file: string,
    @Headers('authorization') auth: string | undefined,
    @Headers('x-view-token') viewTokenHeader: string | undefined,
    @Query('view_token') viewTokenQuery: string | undefined,
    @Res() res: Response,
  ) {
    const userId = this.pub.userIdFromAuthHeader(auth);
    const viewToken = viewTokenHeader ?? viewTokenQuery ?? null;
    const resolved = await this.pub.resolveBySlug(slug, { userId, viewToken });
    const base = safeFilename(resolved.tournament.slug);

    if (file.endsWith('.csv')) {
      const kind = stripExt(file, '.csv') as (typeof PUBLIC_CSV_EXPORT_KINDS)[number];
      if (!PUBLIC_CSV_EXPORT_KINDS.includes(kind)) {
        throw new BadRequestException(`Unknown export. Use one of: ${PUBLIC_CSV_EXPORT_KINDS.map((k) => `${k}.csv`).join(', ')}`);
      }
      const csv = await this.csv.build(kind, resolved);
      sendCsv(res, `${base}-${kind}.csv`, csv);
      return;
    }

    if (file.endsWith('.pdf')) {
      const kind = stripExt(file, '.pdf') as PdfExportKind;
      if (!PDF_EXPORT_KINDS.includes(kind)) {
        throw new BadRequestException(`Unknown export. Use one of: ${PDF_EXPORT_KINDS.map((k) => `${k}.pdf`).join(', ')}`);
      }
      this.pdf.stream(res, `${base}-${kind}.pdf`, (doc) =>
        this.pdf.render(kind, resolved, this.pub.appUrl(), doc),
      );
      return;
    }

    throw new BadRequestException('Unknown export format');
  }
}
