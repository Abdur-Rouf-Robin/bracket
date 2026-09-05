import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import {
  formatMoney,
  generateOrderCode,
  maskEmail,
  normalizeOrderCode,
  type CreateEventOrderInput,
  type CreateEventTicketInput,
  type ListEventOrdersQuery,
  type UpdateEventOrderInput,
  type UpdateEventTicketInput,
} from '@bracket/shared';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';

const ORDER_INCLUDE = {
  ticket: { select: { id: true, name: true, priceCents: true, currency: true } },
} as const;

export type CheckedInTeam = {
  tournamentId: string;
  tournamentSlug: string;
  tournamentName: string;
  teamId: string;
  teamName: string;
};

@Injectable()
export class EventTicketsService {
  private readonly logger = new Logger(EventTicketsService.name);
  private stripe: Stripe | null | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // Infra helpers
  // -------------------------------------------------------------------------

  private getStripe(): Stripe | null {
    if (this.stripe !== undefined) return this.stripe;
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
    return this.stripe;
  }

  private appUrl(): string {
    return (this.config.get<string>('APP_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  private toDate(v: string | null | undefined): Date | null | undefined {
    if (v === undefined) return undefined;
    if (v === null) return null;
    return new Date(v);
  }

  private async uniqueOrderCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const code = generateOrderCode();
      const existing = await this.prisma.eventOrder.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    throw new BadRequestException('Could not allocate an order code');
  }

  private async sendEmail(to: string, subject: string, html: string) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from =
      this.config.get<string>('EMAIL_FROM') ?? 'Bracket <onboarding@resend.dev>';
    if (apiKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from, to, subject, html }),
        });
        if (!res.ok) {
          this.logger.warn(`Resend email failed (${res.status}) for ${to}`);
        }
        return;
      } catch (err) {
        this.logger.warn(`Resend error: ${(err as Error).message}`);
      }
    }
    this.logger.log(`Email (dry-run) to ${to}: ${subject}`);
  }

  private async soldByTicket(eventId: string, ticketIds?: string[]) {
    const rows = await this.prisma.eventOrder.groupBy({
      by: ['ticketId'],
      where: {
        eventId,
        status: 'PAID',
        ...(ticketIds ? { ticketId: { in: ticketIds } } : {}),
      },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.ticketId, r._sum.quantity ?? 0]));
  }

  /** PENDING orders reserve stock for a short window so we don't oversell during checkout. */
  private async reservedByTicket(eventId: string, ticketId: string) {
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const agg = await this.prisma.eventOrder.aggregate({
      where: {
        eventId,
        ticketId,
        status: 'PENDING',
        stripeSessionId: { not: null },
        createdAt: { gte: since },
      },
      _sum: { quantity: true },
    });
    return agg._sum.quantity ?? 0;
  }

  // -------------------------------------------------------------------------
  // Tickets (manager)
  // -------------------------------------------------------------------------

  async listTickets(eventId: string, userId: string) {
    await this.access.requireEventManager(eventId, userId);
    const tickets = await this.prisma.eventTicket.findMany({
      where: { eventId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    const sold = await this.soldByTicket(eventId);
    return tickets.map((t) => {
      const s = sold.get(t.id) ?? 0;
      return {
        ...t,
        sold: s,
        remaining: t.quantity == null ? null : Math.max(0, t.quantity - s),
      };
    });
  }

  async createTicket(eventId: string, userId: string, input: CreateEventTicketInput) {
    await this.access.requireEventManager(eventId, userId);
    if (input.priceCents > 0 && !this.getStripe()) {
      this.logger.warn(
        `Paid ticket created for event ${eventId} without STRIPE_SECRET_KEY — orders will be pay-at-door`,
      );
    }
    const maxOrder = await this.prisma.eventTicket.aggregate({
      where: { eventId },
      _max: { order: true },
    });
    const ticket = await this.prisma.eventTicket.create({
      data: {
        eventId,
        name: input.name,
        description: input.description ?? null,
        priceCents: input.priceCents,
        currency: input.currency,
        quantity: input.quantity ?? null,
        salesStartAt: this.toDate(input.salesStartAt) ?? null,
        salesEndAt: this.toDate(input.salesEndAt) ?? null,
        isActive: input.isActive,
        order: input.order ?? (maxOrder._max.order ?? -1) + 1,
      },
    });
    return { ...ticket, sold: 0, remaining: ticket.quantity };
  }

  async updateTicket(
    eventId: string,
    userId: string,
    ticketId: string,
    input: UpdateEventTicketInput,
  ) {
    await this.access.requireEventManager(eventId, userId);
    const existing = await this.prisma.eventTicket.findFirst({
      where: { id: ticketId, eventId },
    });
    if (!existing) throw new NotFoundException('Ticket not found');
    const data: Prisma.EventTicketUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.priceCents !== undefined) data.priceCents = input.priceCents;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.salesStartAt !== undefined) data.salesStartAt = this.toDate(input.salesStartAt);
    if (input.salesEndAt !== undefined) data.salesEndAt = this.toDate(input.salesEndAt);
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.order !== undefined) data.order = input.order;
    const ticket = await this.prisma.eventTicket.update({
      where: { id: ticketId },
      data,
    });
    const sold = (await this.soldByTicket(eventId, [ticketId])).get(ticketId) ?? 0;
    return {
      ...ticket,
      sold,
      remaining: ticket.quantity == null ? null : Math.max(0, ticket.quantity - sold),
    };
  }

  async deleteTicket(eventId: string, userId: string, ticketId: string) {
    await this.access.requireEventManager(eventId, userId);
    const existing = await this.prisma.eventTicket.findFirst({
      where: { id: ticketId, eventId },
      include: { _count: { select: { orders: true } } },
    });
    if (!existing) throw new NotFoundException('Ticket not found');
    if (existing._count.orders > 0) {
      // Orders reference the ticket; keep the history and hide the ticket instead.
      await this.prisma.eventTicket.update({
        where: { id: ticketId },
        data: { isActive: false },
      });
      return { ok: true, deactivated: true };
    }
    await this.prisma.eventTicket.delete({ where: { id: ticketId } });
    return { ok: true, deactivated: false };
  }

  // -------------------------------------------------------------------------
  // Orders (public purchase + lookup)
  // -------------------------------------------------------------------------

  async createOrder(
    slug: string,
    userId: string | null | undefined,
    input: CreateEventOrderInput,
  ) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Event not found');
    if (!event.isPublished) {
      const canManage = await this.access.canManageEvent(event.id, userId);
      if (!canManage) throw new NotFoundException('Event not found');
    }
    const ticket = await this.prisma.eventTicket.findFirst({
      where: { id: input.ticketId, eventId: event.id },
    });
    if (!ticket || !ticket.isActive) {
      throw new BadRequestException('This ticket is not available');
    }
    const now = new Date();
    if (ticket.salesStartAt && ticket.salesStartAt > now) {
      throw new BadRequestException('Ticket sales have not started yet');
    }
    if (ticket.salesEndAt && ticket.salesEndAt < now) {
      throw new BadRequestException('Ticket sales have ended');
    }
    if (ticket.quantity != null) {
      const sold = (await this.soldByTicket(event.id, [ticket.id])).get(ticket.id) ?? 0;
      const reserved = await this.reservedByTicket(event.id, ticket.id);
      const remaining = ticket.quantity - sold - reserved;
      if (remaining < input.quantity) {
        throw new BadRequestException(
          remaining <= 0
            ? 'This ticket is sold out'
            : `Only ${remaining} ticket${remaining === 1 ? '' : 's'} left`,
        );
      }
    }

    const amountCents = ticket.priceCents * input.quantity;
    const code = await this.uniqueOrderCode();
    const stripe = amountCents > 0 ? this.getStripe() : null;
    const isFree = amountCents === 0;

    const order = await this.prisma.eventOrder.create({
      data: {
        code,
        eventId: event.id,
        ticketId: ticket.id,
        userId: userId ?? null,
        buyerName: input.buyerName.trim(),
        buyerEmail: input.buyerEmail.trim().toLowerCase(),
        quantity: input.quantity,
        amountCents,
        currency: ticket.currency,
        status: isFree ? 'PAID' : 'PENDING',
      },
      include: ORDER_INCLUDE,
    });

    const ticketUrl = `${this.appUrl()}/e/${event.slug}/ticket/${order.code}`;
    let checkoutUrl: string | null = null;
    let paymentInstructions: string | null = null;

    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          customer_email: order.buyerEmail,
          line_items: [
            {
              quantity: input.quantity,
              price_data: {
                currency: ticket.currency.toLowerCase(),
                unit_amount: ticket.priceCents,
                product_data: {
                  name: `${event.name} — ${ticket.name}`,
                  ...(ticket.description
                    ? { description: ticket.description.slice(0, 500) }
                    : {}),
                },
              },
            },
          ],
          success_url: `${ticketUrl}?paid=1`,
          cancel_url: `${this.appUrl()}/e/${event.slug}?cancelled=1`,
          metadata: { type: 'event_order', orderId: order.id },
        });
        checkoutUrl = session.url ?? null;
        await this.prisma.eventOrder.update({
          where: { id: order.id },
          data: { stripeSessionId: session.id },
        });
      } catch (err) {
        this.logger.error(`Stripe checkout failed: ${(err as Error).message}`);
        await this.prisma.eventOrder.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', notes: 'Stripe checkout creation failed' },
        });
        throw new BadRequestException('Could not start checkout. Please try again.');
      }
    } else if (!isFree) {
      paymentInstructions =
        ticket.description?.trim() ||
        `Pay at the door — ${formatMoney(amountCents, ticket.currency)} due at check-in.`;
    }

    void this.sendConfirmationEmail({
      to: order.buyerEmail,
      buyerName: order.buyerName,
      eventName: event.name,
      ticketName: ticket.name,
      quantity: order.quantity,
      code: order.code,
      status: order.status,
      amountLabel: formatMoney(amountCents, ticket.currency),
      ticketUrl,
      paymentInstructions,
    });

    return {
      order: {
        ...order,
        stripeSessionId: undefined,
      },
      checkoutUrl,
      paymentInstructions,
      ticketUrl,
      message: isFree
        ? 'You are in! Your free ticket is confirmed.'
        : checkoutUrl
          ? 'Redirecting to secure checkout…'
          : 'Order received. Pay at the door and show your code at check-in.',
    };
  }

  private async sendConfirmationEmail(args: {
    to: string;
    buyerName: string;
    eventName: string;
    ticketName: string;
    quantity: number;
    code: string;
    status: string;
    amountLabel: string;
    ticketUrl: string;
    paymentInstructions: string | null;
  }) {
    const subject = `Your ticket for ${args.eventName}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px">
        <h2 style="margin:0 0 8px">${escapeHtml(args.eventName)}</h2>
        <p>Hi ${escapeHtml(args.buyerName)}, here is your ticket.</p>
        <table style="border-collapse:collapse;margin:12px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Ticket</td><td>${escapeHtml(args.ticketName)} × ${args.quantity}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Amount</td><td>${escapeHtml(args.amountLabel)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Status</td><td>${escapeHtml(args.status)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Code</td><td style="font-size:20px;letter-spacing:3px;font-weight:700">${args.code}</td></tr>
        </table>
        ${args.paymentInstructions ? `<p style="padding:10px;background:#fff7e6;border:1px solid #ffd591">${escapeHtml(args.paymentInstructions)}</p>` : ''}
        <p><a href="${args.ticketUrl}" style="display:inline-block;padding:10px 16px;background:#26bbff;color:#041018;border-radius:6px;text-decoration:none;font-weight:600">View your ticket</a></p>
        <p style="color:#666;font-size:12px">Show the QR code or your code at check-in.</p>
      </div>`;
    await this.sendEmail(args.to, subject, html);
  }

  /** Public lookup by code. Lazily verifies Stripe payment for PENDING orders. */
  async lookupOrder(slug: string, rawCode: string) {
    const code = normalizeOrderCode(rawCode);
    const order = await this.prisma.eventOrder.findFirst({
      where: { code, event: { slug } },
      include: {
        ...ORDER_INCLUDE,
        event: {
          select: {
            id: true,
            slug: true,
            name: true,
            logoUrl: true,
            bannerUrl: true,
            startAt: true,
            endAt: true,
            timezone: true,
            venueType: true,
            venueName: true,
            venueAddress: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Ticket not found');

    let current = order;
    if (order.status === 'PENDING' && order.stripeSessionId) {
      const verified = await this.verifyWithStripe(order.id, order.stripeSessionId);
      if (verified) {
        current = { ...order, status: 'PAID' };
      }
    }

    return this.publicOrderView(current);
  }

  private publicOrderView<
    T extends {
      id: string;
      code: string;
      buyerName: string;
      buyerEmail: string;
      quantity: number;
      amountCents: number;
      currency: string;
      status: string;
      checkedInAt: Date | null;
      createdAt: Date;
      ticket: { id: string; name: string };
      event: unknown;
    },
  >(order: T) {
    return {
      id: order.id,
      code: order.code,
      buyerName: order.buyerName,
      buyerEmail: maskEmail(order.buyerEmail),
      quantity: order.quantity,
      amountCents: order.amountCents,
      currency: order.currency,
      status: order.status,
      checkedInAt: order.checkedInAt,
      createdAt: order.createdAt,
      ticket: { id: order.ticket.id, name: order.ticket.name },
      event: order.event,
    };
  }

  /** Returns true if the session was paid and the order got flipped to PAID. */
  private async verifyWithStripe(orderId: string, sessionId: string): Promise<boolean> {
    const stripe = this.getStripe();
    if (!stripe) return false;
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'paid') {
        await this.prisma.eventOrder.updateMany({
          where: { id: orderId, status: 'PENDING' },
          data: { status: 'PAID' },
        });
        return true;
      }
    } catch (err) {
      this.logger.warn(`Stripe verify failed for ${orderId}: ${(err as Error).message}`);
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Orders (manager)
  // -------------------------------------------------------------------------

  async listOrders(eventId: string, userId: string, query: ListEventOrdersQuery) {
    await this.access.requireEventManager(eventId, userId);
    const q = query.q?.trim();
    return this.prisma.eventOrder.findMany({
      where: {
        eventId,
        ...(query.status ? { status: query.status } : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q.toUpperCase() } },
                { buyerName: { contains: q, mode: 'insensitive' } },
                { buyerEmail: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        ...ORDER_INCLUDE,
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async updateOrder(
    eventId: string,
    userId: string,
    orderId: string,
    input: UpdateEventOrderInput,
  ) {
    await this.access.requireEventManager(eventId, userId);
    const existing = await this.prisma.eventOrder.findFirst({
      where: { id: orderId, eventId },
    });
    if (!existing) throw new NotFoundException('Order not found');
    const data: Prisma.EventOrderUpdateInput = {};
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.status !== undefined) {
      if (input.status === 'PAID' && existing.status !== 'PENDING') {
        throw new BadRequestException('Only pending orders can be marked paid');
      }
      data.status = input.status;
      if (input.status !== 'PAID') data.checkedInAt = null;
    }
    return this.prisma.eventOrder.update({
      where: { id: orderId },
      data,
      include: { ...ORDER_INCLUDE, user: { select: { id: true, name: true } } },
    });
  }

  async verifyPayment(eventId: string, userId: string, orderId: string) {
    await this.access.requireEventManager(eventId, userId);
    const order = await this.prisma.eventOrder.findFirst({
      where: { id: orderId, eventId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'PAID') return { order, verified: true, changed: false };
    if (!order.stripeSessionId) {
      throw new BadRequestException('This order has no Stripe checkout session');
    }
    if (!this.getStripe()) {
      throw new BadRequestException('Stripe is not configured on this server');
    }
    const verified = await this.verifyWithStripe(order.id, order.stripeSessionId);
    const fresh = await this.prisma.eventOrder.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
    return { order: fresh, verified, changed: verified };
  }

  // -------------------------------------------------------------------------
  // Check-in
  // -------------------------------------------------------------------------

  async checkIn(eventId: string, userId: string, rawCode: string) {
    await this.access.requireEventManager(eventId, userId);
    const code = normalizeOrderCode(rawCode);
    const order = await this.prisma.eventOrder.findFirst({
      where: { code, eventId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('No ticket with that code');

    let status = order.status;
    if (status === 'PENDING' && order.stripeSessionId) {
      if (await this.verifyWithStripe(order.id, order.stripeSessionId)) {
        status = 'PAID';
      }
    }
    if (status !== 'PAID') {
      throw new BadRequestException(
        status === 'PENDING'
          ? 'Ticket is not paid yet'
          : `Ticket is ${status.toLowerCase()}`,
      );
    }

    const alreadyCheckedIn = order.checkedInAt != null;
    const now = new Date();
    const updated = alreadyCheckedIn
      ? { ...order, status }
      : await this.prisma.eventOrder.update({
          where: { id: order.id },
          data: { checkedInAt: now, status },
          include: ORDER_INCLUDE,
        });

    const checkedInTeams = await this.checkInAttendeeTeams(
      eventId,
      order.userId,
      order.buyerEmail,
      now,
    );

    return {
      order: updated,
      alreadyCheckedIn,
      checkedInTeams,
    };
  }

  private async checkInAttendeeTeams(
    eventId: string,
    attendeeUserId: string | null,
    buyerEmail: string,
    now: Date,
  ): Promise<CheckedInTeam[]> {
    const teamWhere: Prisma.TeamWhereInput[] = [
      {
        registration: {
          email: { equals: buyerEmail, mode: 'insensitive' },
          teamId: { not: null },
        },
      },
    ];
    if (attendeeUserId) {
      teamWhere.push({ registeredByUserId: attendeeUserId });
      teamWhere.push({ registration: { userId: attendeeUserId, teamId: { not: null } } });
    }
    const teams = await this.prisma.team.findMany({
      where: {
        tournament: { eventId },
        withdrawn: false,
        OR: teamWhere,
      },
      select: {
        id: true,
        name: true,
        checkedIn: true,
        tournament: { select: { id: true, slug: true, name: true } },
      },
    });
    const toUpdate = teams.filter((t) => !t.checkedIn).map((t) => t.id);
    if (toUpdate.length) {
      await this.prisma.team.updateMany({
        where: { id: { in: toUpdate } },
        data: { checkedIn: true, checkedInAt: now },
      });
    }
    return teams.map((t) => ({
      tournamentId: t.tournament.id,
      tournamentSlug: t.tournament.slug,
      tournamentName: t.tournament.name,
      teamId: t.id,
      teamName: t.name,
    }));
  }

  async undoCheckIn(eventId: string, userId: string, orderId: string) {
    await this.access.requireEventManager(eventId, userId);
    const order = await this.prisma.eventOrder.findFirst({
      where: { id: orderId, eventId },
    });
    if (!order) throw new NotFoundException('Order not found');
    const updated = await this.prisma.eventOrder.update({
      where: { id: orderId },
      data: { checkedInAt: null },
      include: ORDER_INCLUDE,
    });

    // Only un-check teams that no other checked-in order still covers.
    const teamWhere: Prisma.TeamWhereInput[] = [
      {
        registration: {
          email: { equals: order.buyerEmail, mode: 'insensitive' },
          teamId: { not: null },
        },
      },
    ];
    if (order.userId) teamWhere.push({ registeredByUserId: order.userId });
    await this.prisma.team.updateMany({
      where: { tournament: { eventId }, checkedIn: true, OR: teamWhere },
      data: { checkedIn: false, checkedInAt: null },
    });
    return { order: updated };
  }

  async checkInStats(eventId: string, userId: string) {
    await this.access.requireEventManager(eventId, userId);
    const [paidOrders, checkedIn, recent] = await Promise.all([
      this.prisma.eventOrder.count({ where: { eventId, status: 'PAID' } }),
      this.prisma.eventOrder.count({
        where: { eventId, status: 'PAID', checkedInAt: { not: null } },
      }),
      this.prisma.eventOrder.findMany({
        where: { eventId, checkedInAt: { not: null } },
        orderBy: { checkedInAt: 'desc' },
        take: 15,
        include: ORDER_INCLUDE,
      }),
    ]);
    return {
      paidOrders,
      checkedIn,
      remaining: Math.max(0, paidOrders - checkedIn),
      recent,
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
