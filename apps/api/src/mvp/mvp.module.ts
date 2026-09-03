import { Module } from '@nestjs/common';
import { MvpService } from './mvp.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MvpService],
  exports: [MvpService],
})
export class MvpModule {}
