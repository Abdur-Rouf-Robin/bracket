import { Module, forwardRef } from '@nestjs/common';
import { BracketRepairService } from './bracket-repair.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [forwardRef(() => RealtimeModule)],
  providers: [BracketRepairService],
  exports: [BracketRepairService],
})
export class BracketModule {}
