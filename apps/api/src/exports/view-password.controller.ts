import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  setViewPasswordSchema,
  unlockTournamentSchema,
  type SetViewPasswordInput,
  type UnlockTournamentInput,
} from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ViewPasswordService } from './view-password.service';

@ApiTags('tournaments')
@Controller()
export class ViewPasswordController {
  constructor(private readonly viewPassword: ViewPasswordService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('tournaments/:id/view-password')
  setPassword(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(setViewPasswordSchema)) body: SetViewPasswordInput,
  ) {
    return this.viewPassword.setPassword(id, user.id, body.password);
  }

  @Post('t/:slug/unlock')
  unlock(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(unlockTournamentSchema)) body: UnlockTournamentInput,
  ) {
    return this.viewPassword.unlock(slug, body.password);
  }
}
