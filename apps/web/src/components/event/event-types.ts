/**
 * Response shapes for the event-hub API. Core shapes (PlatformEvent,
 * EventTicket, EventOrder) live in `@/lib/types-platform`; these extend them
 * with the extra fields returned by the event-hub endpoints.
 */
import type { EventOrder, EventTicket, PlatformEvent } from '@/lib/types-platform';

export type EventTournamentSummary = {
  id: string;
  slug: string;
  name: string;
  format: string | null;
  status: string;
  startAt: string | null;
  isPublic: boolean;
  game: { id: string; name: string; category: string } | null;
  _count: { teams: number };
};

export type EventTicketWithSales = EventTicket & {
  eventId?: string;
  order?: number;
  sold: number;
  remaining: number | null;
  createdAt?: string;
};

/** GET /e/:slug */
export type EventDetail = Omit<PlatformEvent, 'tournaments' | 'tickets'> & {
  owner?: { id: string; name: string } | null;
  tournaments: EventTournamentSummary[];
  tickets: EventTicketWithSales[];
  canManage: boolean;
  streamEmbedUrl: string | null;
  updatedAt?: string;
};

/** GET /events (items) and GET /events/mine */
export type EventListItem = PlatformEvent & {
  _count: { tournaments: number; orders?: number; tickets?: number };
};

export type EventListResponse = {
  items: EventListItem[];
  total: number;
  page: number;
  pageSize: number;
};

/** GET /events/:id/orders rows */
export type EventOrderRow = EventOrder & {
  eventId: string;
  ticketId: string;
  userId?: string | null;
  user?: { id: string; name: string } | null;
  notes?: string | null;
  stripeSessionId?: string | null;
  updatedAt?: string;
};

/** GET /e/:slug/orders/:code */
export type PublicOrderView = Omit<EventOrder, 'ticket'> & {
  ticket: { id: string; name: string };
  event: {
    id: string;
    slug: string;
    name: string;
    logoUrl?: string | null;
    bannerUrl?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    timezone: string;
    venueType?: string | null;
    venueName?: string | null;
    venueAddress?: string | null;
  };
};

/** POST /e/:slug/orders */
export type CreateOrderResponse = {
  order: EventOrder;
  checkoutUrl: string | null;
  paymentInstructions: string | null;
  ticketUrl: string;
  message: string;
};

/** POST /events/:id/check-in */
export type CheckInResult = {
  order: EventOrderRow;
  alreadyCheckedIn: boolean;
  checkedInTeams: {
    tournamentId: string;
    tournamentSlug: string;
    tournamentName: string;
    teamId: string;
    teamName: string;
  }[];
};

/** GET /events/:id/check-in/stats */
export type CheckInStats = {
  paidOrders: number;
  checkedIn: number;
  remaining: number;
  recent: EventOrderRow[];
};

/** GET /events/:id/dashboard */
export type EventDashboard = {
  event: {
    id: string;
    slug: string;
    name: string;
    isPublished: boolean;
    isPublic: boolean;
    startAt: string | null;
    endAt: string | null;
    timezone: string;
  };
  tournaments: {
    total: number;
    upcoming: number;
    in_progress: number;
    completed: number;
  };
  tickets: { types: number; sold: number };
  orders: { total: number; byStatus: Record<string, number> };
  revenueByCurrency: Record<string, number>;
  checkIn: { paidOrders: number; checkedIn: number; remaining: number };
  upcomingMatches: {
    id: string;
    round: number;
    scheduledAt: string | null;
    status: string;
    homeTeam: { id: string; name: string } | null;
    awayTeam: { id: string; name: string } | null;
    tournament: { id: string; slug: string; name: string };
  }[];
};

/** GET /events/:id/admins */
export type EventAdminsResponse = {
  owner: { id: string; email: string; name: string } | null;
  admins: {
    id: string;
    role: string;
    createdAt: string;
    user: { id: string; email: string; name: string };
  }[];
};
