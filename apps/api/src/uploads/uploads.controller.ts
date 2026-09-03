import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_BYTES },
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${randomUUID()}${ALLOWED.has(ext) ? ext : '.png'}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED.has(ext)) {
          cb(new BadRequestException('Only JPG, PNG, WebP, GIF allowed') as Error, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const port = process.env.API_PORT ?? '3001';
    const host = process.env.API_PUBLIC_URL ?? `http://localhost:${port}`;
    return {
      url: `${host.replace(/\/$/, '')}/uploads/${file.filename}`,
      filename: file.filename,
    };
  }
}
