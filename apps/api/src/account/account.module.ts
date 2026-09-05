import { Global, Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { UsersController } from './users.controller';

/**
 * Account, email verification, password reset and public profiles.
 * Global so AuthService can trigger verification / reset emails without
 * a module import cycle.
 */
@Global()
@Module({
  imports: [NotificationsModule],
  controllers: [AccountController, UsersController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
