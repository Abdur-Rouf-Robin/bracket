import {
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { BillingService } from './billing.service';

@ApiExcludeController()
@Controller('billing')
export class StripeWebhookController {
  constructor(private readonly billing: BillingService) {}

  /** Public — verified with STRIPE_WEBHOOK_SECRET against req.rawBody. */
  @Post('stripe/webhook')
  @HttpCode(200)
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string | string[],
  ) {
    const sig = Array.isArray(signature) ? signature[0] : signature;
    return this.billing.handleWebhook(req.rawBody, sig);
  }
}
