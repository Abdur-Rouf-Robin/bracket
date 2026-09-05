import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service';

/** Global module: AccessService is injectable everywhere without imports. */
@Global()
@Module({
  providers: [AccessService],
  exports: [AccessService],
})
export class CommonModule {}
