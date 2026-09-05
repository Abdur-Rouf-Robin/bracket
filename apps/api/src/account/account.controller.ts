import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  changePasswordSchema,
  deleteAccountSchema,
  updateAccountSchema,
  verifyEmailSchema,
} from '@bracket/shared';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  UpdateAccountInput,
  VerifyEmailInput,
} from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccountService } from './account.service';

type ReqUser = { id: string; email: string; name: string; role: string };

@ApiTags('account')
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  get(@CurrentUser() user: ReqUser) {
    return this.account.getAccount(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch()
  update(
    @CurrentUser() user: ReqUser,
    @Body(new ZodValidationPipe(updateAccountSchema)) body: UpdateAccountInput,
  ) {
    return this.account.updateAccount(user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('username-available')
  usernameAvailable(
    @CurrentUser() user: ReqUser,
    @Query('username') username = '',
  ) {
    return this.account.usernameAvailable(username, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  changePassword(
    @CurrentUser() user: ReqUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ) {
    return this.account.changePassword(user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete()
  remove(
    @CurrentUser() user: ReqUser,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
  ) {
    return this.account.deleteAccount(user.id, body.password);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('verification/send')
  sendVerification(@CurrentUser() user: ReqUser) {
    return this.account.requestVerification(user.id);
  }

  @Post('verification/confirm')
  confirmVerification(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
  ) {
    return this.account.confirmVerification(body.token);
  }
}
