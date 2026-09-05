import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  registrationManualSchema,
  registrationReviewSchema,
  registrationSubmitSchema,
  waitlistReorderSchema,
} from '@bracket/shared';
import type {
  RegistrationManualInput,
  RegistrationReviewInput,
  RegistrationSubmitInput,
  WaitlistReorderInput,
} from '@bracket/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RegistrationsService } from './registrations.service';

type ReqUser = { id: string; email: string; name: string; role: string };

/** Public sign-up page endpoints (slug-based). */
@ApiTags('registrations')
@Controller('t/:slug')
export class PublicRegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('registration')
  formConfig(@Param('slug') slug: string, @CurrentUser() user: ReqUser | null) {
    return this.registrations.formConfig(slug, user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('registrations')
  submit(
    @Param('slug') slug: string,
    @CurrentUser() user: ReqUser | null,
    @Body(new ZodValidationPipe(registrationSubmitSchema)) body: RegistrationSubmitInput,
  ) {
    return this.registrations.submit(slug, user, body);
  }

  @Get('registrations/:id/status')
  status(@Param('slug') slug: string, @Param('id') id: string) {
    return this.registrations.statusById(slug, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('registrations/:id/checkout')
  checkout(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: ReqUser,
  ) {
    return this.registrations.checkoutUrl(slug, id, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('registrations/mine')
  withdrawMine(@Param('slug') slug: string, @CurrentUser() user: ReqUser) {
    return this.registrations.withdrawMine(slug, user.id);
  }

  @Get('check-in/status')
  checkInStatus(@Param('slug') slug: string) {
    return this.registrations.checkInStatus(slug);
  }
}

/** Manager endpoints (tournament id based). */
@ApiTags('registrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tournaments/:id')
export class ManageRegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get('registrations')
  list(
    @Param('id') id: string,
    @CurrentUser() user: ReqUser,
    @Query('status') status?: string,
  ) {
    return this.registrations.list(id, user.id, status);
  }

  @Post('registrations/manual')
  manual(
    @Param('id') id: string,
    @CurrentUser() user: ReqUser,
    @Body(new ZodValidationPipe(registrationManualSchema)) body: RegistrationManualInput,
  ) {
    return this.registrations.manual(id, user.id, body);
  }

  @Post('registrations/promote-next')
  promoteNext(@Param('id') id: string, @CurrentUser() user: ReqUser) {
    return this.registrations.promoteNext(id, user.id);
  }

  @Post('registrations/approve-all-pending')
  approveAllPending(@Param('id') id: string, @CurrentUser() user: ReqUser) {
    return this.registrations.approveAllPending(id, user.id);
  }

  @Post('registrations/waitlist/reorder')
  reorderWaitlist(
    @Param('id') id: string,
    @CurrentUser() user: ReqUser,
    @Body(new ZodValidationPipe(waitlistReorderSchema)) body: WaitlistReorderInput,
  ) {
    return this.registrations.reorderWaitlist(id, user.id, body.orderedIds);
  }

  @Patch('registrations/:regId')
  review(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @CurrentUser() user: ReqUser,
    @Body(new ZodValidationPipe(registrationReviewSchema)) body: RegistrationReviewInput,
  ) {
    return this.registrations.review(id, regId, user.id, body);
  }

  @Post('registrations/:regId/verify-payment')
  verifyPayment(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @CurrentUser() user: ReqUser,
  ) {
    return this.registrations.verifyPayment(id, regId, user.id);
  }

  @Delete('registrations/:regId')
  remove(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @CurrentUser() user: ReqUser,
  ) {
    return this.registrations.remove(id, regId, user.id);
  }

  @Post('teams/:teamId/withdraw')
  withdraw(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: ReqUser,
  ) {
    return this.registrations.withdrawTeam(id, teamId, user.id);
  }

  @Post('teams/:teamId/reinstate')
  reinstate(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: ReqUser,
  ) {
    return this.registrations.reinstateTeam(id, teamId, user.id);
  }

  @Post('check-in/process-early')
  processCheckInEarly(@Param('id') id: string, @CurrentUser() user: ReqUser) {
    return this.registrations.processCheckInEarly(id, user.id);
  }
}
