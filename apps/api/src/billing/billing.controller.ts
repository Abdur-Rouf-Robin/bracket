import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  adminGrantPlanSchema,
  checkoutSchema,
  type AdminGrantPlanInput,
  type CheckoutInput,
} from '@bracket/shared';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  plans() {
    return this.billing.listPlans();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.billing.me(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  checkout(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(checkoutSchema)) body: CheckoutInput,
  ) {
    return this.billing.checkout(user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('portal')
  portal(@CurrentUser() user: { id: string }) {
    return this.billing.portal(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/grant')
  grant(@Body(new ZodValidationPipe(adminGrantPlanSchema)) body: AdminGrantPlanInput) {
    return this.billing.grantPlan(body);
  }
}
