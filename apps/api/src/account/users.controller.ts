import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AccountService } from './account.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly account: AccountService) {}

  /** Public profile by username: user, stats, hosted, participated, communities. */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':username')
  profile(
    @Param('username') username: string,
    @CurrentUser() user: { id: string } | null,
  ) {
    return this.account.publicProfile(username, user?.id);
  }
}
