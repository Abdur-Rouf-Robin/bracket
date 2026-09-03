import { Module } from '@nestjs/common';
import { ShareImagesService } from './share-images.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ShareImagesService],
  exports: [ShareImagesService],
})
export class ShareImagesModule {}
