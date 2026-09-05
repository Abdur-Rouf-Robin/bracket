import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import {
  PLANS,
  PLAN_LIST,
  type AdminGrantPlanInput,
  type BillingMeResponse,
  type CheckoutInput,
  type CheckoutResponse,
  type PlanDefinition,
  type PlanId,
  type PlanLimits,
} from '@bracket/shared';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe | null | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly config: ConfigService,
  ) {}

  private getStripe(): Stripe | null {
    if (this.stripe !== undefined) return this.stripe;
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
    return this.stripe;
  }

  private appUrl(): string {
    return (this.config.get<string>('APP_URL') ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
  }

  isConfigured(): boolean {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    const monthly = this.config.get<string>('STRIPE_PRICE_PREMIER_MONTHLY');
    const yearly = this.config.get<string>('STRIPE_PRICE_PREMIER_YEARLY');
    return !!(secret && monthly && yearly);
  }

  private envMaxParticipants(_plan: PlanId): number {
    const raw =
      this.config.get<string | number>('MAX_PARTICIPANTS') ??
      this.config.get<string | number>('PREMIER_MAX_PARTICIPANTS') ??
      this.config.get<string | number>('FREE_MAX_PARTICIPANTS');
    const n = raw == null || raw === '' ? 4096 : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 4096;
  }

  limitsForPlan(plan: PlanId): PlanLimits {
    return {
      ...PLANS[plan].limits,
      maxParticipants: this.envMaxParticipants(plan),
    };
  }

  /** Effective limits for the user's current plan (env overrides applied). */
  async limitsFor(userId: string): Promise<PlanLimits> {
    const plan = await this.access.userPlan(userId);
    return this.limitsForPlan(plan);
  }

  private withEnvLimits(def: PlanDefinition): PlanDefinition {
    const limits = this.limitsForPlan(def.id);
    return {
      ...def,
      limits,
      features: def.features.map((f) =>
        f.includes('participants per tournament')
          ? `Up to ${limits.maxParticipants} participants per tournament`
          : f,
      ),
    };
  }

  listPlans(): { plans: PlanDefinition[] } {
    return { plans: PLAN_LIST.map((p) => this.withEnvLimits(p)) };
  }

  async me(userId: string): Promise<BillingMeResponse> {
    const [plan, user] = await Promise.all([
      this.access.userPlan(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          planExpiresAt: true,
          subscription: true,
        },
      }),
    ]);
    if (!user) throw new NotFoundException('User not found');

    const sub = user.subscription;
    return {
      plan,
      planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
      subscription: sub
        ? {
            plan: sub.plan,
            status: sub.status,
            interval: sub.interval,
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          }
        : null,
      limits: this.limitsForPlan(plan),
      configured: this.isConfigured(),
    };
  }

  async checkout(
    _userId: string,
    _input: CheckoutInput,
  ): Promise<CheckoutResponse> {
    throw new BadRequestException(
      'Platform subscriptions are not offered. Stripe is only for your own entry fees and tickets.',
    );
  }

  async portal(_userId: string): Promise<CheckoutResponse> {
    throw new BadRequestException(
      'There is no platform billing portal. The site is free forever.',
    );
  }

  async grantPlan(input: AdminGrantPlanInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    await this.prisma.user.update({
      where: { id: input.userId },
      data: {
        plan: input.plan,
        planExpiresAt: input.plan === 'FREE' ? null : expiresAt,
      },
    });

    if (input.plan === 'FREE') {
      await this.prisma.subscription.updateMany({
        where: {
          userId: input.userId,
          status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
        },
        data: { cancelAtPeriodEnd: true },
      });
    }

    return this.me(input.userId);
  }

  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!rawBody) {
      throw new BadRequestException('Missing raw webhook body');
    }
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      throw new BadRequestException('Stripe webhook is not configured');
    }

    const stripe = this.getStripe() ?? new Stripe('sk_webhook_verify');
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      this.logger.warn(`Webhook signature failed: ${(err as Error).message}`);
      throw new BadRequestException('Invalid Stripe signature');
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.onSubscriptionChanged(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_failed':
          await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        default:
          break;
      }
    } catch (err) {
      this.logger.error(
        `Webhook ${event.type} failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      // Payment side-effects must not 500 Stripe (retries / poison events).
      if (this.isIgnorableWebhookError(err)) return { received: true };
      throw err;
    }

    return { received: true };
  }

  private isIgnorableWebhookError(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2025' || err.code === 'P2002')
    );
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const type = session.metadata?.type ?? 'subscription';
    if (type === 'event_order') {
      await this.markEventOrderPaid(session.metadata?.orderId);
      return;
    }
    if (type === 'registration') {
      await this.markRegistrationPaid(session.metadata?.registrationId);
      return;
    }
    await this.onSubscriptionCheckout(session);
  }

  private async markEventOrderPaid(orderId: string | undefined) {
    if (!orderId) return;
    const row = await this.prisma.eventOrder.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!row || row.status === 'PAID') return;
    await this.prisma.eventOrder.update({
      where: { id: orderId },
      data: { status: 'PAID' },
    });
  }

  private async markRegistrationPaid(registrationId: string | undefined) {
    if (!registrationId) return;
    const row = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      select: { id: true, paymentStatus: true },
    });
    if (!row || row.paymentStatus === 'PAID') return;
    await this.prisma.registration.update({
      where: { id: registrationId },
      data: { paymentStatus: 'PAID' },
    });
  }

  private async onSubscriptionCheckout(session: Stripe.Checkout.Session) {
    const userId =
      session.metadata?.userId ||
      (await this.userIdFromCustomer(this.idOf(session.customer)));
    if (!userId) {
      this.logger.warn(`checkout.session.completed: no user for ${session.id}`);
      return;
    }

    const customerId = this.idOf(session.customer);
    const subscriptionId = this.idOf(session.subscription);
    const stripe = this.getStripe();

    if (subscriptionId && stripe) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      await this.syncSubscription(sub, userId);
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'PREMIER',
        ...(customerId ? { stripeCustomerId: customerId } : {}),
      },
    });
    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: 'PREMIER',
        status: 'ACTIVE',
        interval: 'month',
        stripeSubscriptionId: subscriptionId,
      },
      update: {
        plan: 'PREMIER',
        status: 'ACTIVE',
        stripeSubscriptionId: subscriptionId,
      },
    });
  }

  private async onSubscriptionChanged(sub: Stripe.Subscription) {
    const userId = await this.resolveSubscriptionUserId(sub);
    if (!userId) {
      this.logger.warn(`subscription ${sub.id}: could not resolve user`);
      return;
    }
    await this.syncSubscription(sub, userId);
  }

  private async onSubscriptionDeleted(sub: Stripe.Subscription) {
    const userId = await this.resolveSubscriptionUserId(sub);
    if (!userId) return;
    const periodEnd = this.periodEnd(sub);
    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: 'PREMIER',
        status: 'CANCELLED',
        interval: this.intervalOf(sub),
        stripeSubscriptionId: sub.id,
        stripePriceId: this.priceIdOf(sub),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: true,
      },
      update: {
        status: 'CANCELLED',
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: true,
        stripeSubscriptionId: sub.id,
        stripePriceId: this.priceIdOf(sub),
        interval: this.intervalOf(sub),
      },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { plan: 'FREE', planExpiresAt: periodEnd },
    });
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const subRef = invoice.parent?.subscription_details?.subscription;
    const subscriptionId = this.idOf(subRef);
    if (subscriptionId) {
      await this.prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: { status: 'PAST_DUE' },
      });
      return;
    }
    const customerId = this.idOf(invoice.customer);
    if (!customerId) return;
    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (!user) return;
    await this.prisma.subscription.updateMany({
      where: { userId: user.id },
      data: { status: 'PAST_DUE' },
    });
  }

  private async syncSubscription(sub: Stripe.Subscription, userId: string) {
    const status = this.mapStatus(sub.status);
    const premier = sub.status === 'active' || sub.status === 'trialing';
    const periodEnd = this.periodEnd(sub);
    const customerId = this.idOf(sub.customer);

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: 'PREMIER',
        status,
        interval: this.intervalOf(sub),
        stripeSubscriptionId: sub.id,
        stripePriceId: this.priceIdOf(sub),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
      update: {
        plan: 'PREMIER',
        status,
        interval: this.intervalOf(sub),
        stripeSubscriptionId: sub.id,
        stripePriceId: this.priceIdOf(sub),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: premier ? 'PREMIER' : 'FREE',
        planExpiresAt: periodEnd,
        ...(customerId ? { stripeCustomerId: customerId } : {}),
      },
    });
  }

  private async resolveSubscriptionUserId(
    sub: Stripe.Subscription,
  ): Promise<string | null> {
    if (sub.metadata?.userId) return sub.metadata.userId;
    const byStripe = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: sub.id },
      select: { userId: true },
    });
    if (byStripe) return byStripe.userId;
    return this.userIdFromCustomer(this.idOf(sub.customer));
  }

  private async userIdFromCustomer(
    customerId: string | null,
  ): Promise<string | null> {
    if (!customerId) return null;
    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  private mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case 'trialing':
        return 'TRIALING';
      case 'active':
        return 'ACTIVE';
      case 'past_due':
      case 'unpaid':
      case 'incomplete':
      case 'paused':
        return 'PAST_DUE';
      case 'canceled':
      case 'incomplete_expired':
      default:
        return 'CANCELLED';
    }
  }

  private periodEnd(sub: Stripe.Subscription): Date | null {
    const ts = sub.items?.data?.[0]?.current_period_end;
    return typeof ts === 'number' ? new Date(ts * 1000) : null;
  }

  private intervalOf(sub: Stripe.Subscription): string {
    return sub.items?.data?.[0]?.price?.recurring?.interval === 'year'
      ? 'year'
      : 'month';
  }

  private priceIdOf(sub: Stripe.Subscription): string | null {
    return sub.items?.data?.[0]?.price?.id ?? null;
  }

  private idOf(
    value: string | { id: string } | null | undefined,
  ): string | null {
    if (!value) return null;
    return typeof value === 'string' ? value : value.id;
  }
}
