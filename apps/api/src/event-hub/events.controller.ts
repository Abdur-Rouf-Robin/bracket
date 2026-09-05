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
  createEventSchema,
  createEventTicketSchema,
  eventAdminSchema,
  eventCheckInSchema,
  eventQuickTournamentSchema,
  listEventOrdersQuerySchema,
  listEventsQuerySchema,
  updateEventOrderSchema,
  updateEventSchema,
  updateEventTicketSchema,
  type CreateEventInput,
  type CreateEventTicketInput,
  type EventAdminInput,
  type EventCheckInInput,
  type EventQuickTournamentInput,
  type ListEventOrdersQuery,
  type ListEventsQuery,
  type UpdateEventInput,
  type UpdateEventOrderInput,
  type UpdateEventTicketInput,
} from '@bracket/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EventHubService } from './event-hub.service';
import { EventTicketsService } from './event-tickets.service';

type UserRef = { id: string };

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventHubService,
    private readonly tickets: EventTicketsService,
  ) {}

  // ---------------------------------------------------------------- listing

  @Get()
  list(@Query(new ZodValidationPipe(listEventsQuerySchema)) query: ListEventsQuery) {
    return this.events.listPublic(query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  mine(@CurrentUser() user: UserRef) {
    return this.events.listMine(user.id);
  }

  // ------------------------------------------------------------------- CRUD

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: UserRef,
    @Body(new ZodValidationPipe(createEventSchema)) body: CreateEventInput,
  ) {
    return this.events.create(user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: UserRef) {
    return this.events.getById(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: UserRef,
    @Body(new ZodValidationPipe(updateEventSchema)) body: UpdateEventInput,
  ) {
    return this.events.update(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserRef) {
    return this.events.remove(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/publish')
  publish(@Param('id') id: string, @CurrentUser() user: UserRef) {
    return this.events.setPublished(id, user.id, true);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/unpublish')
  unpublish(@Param('id') id: string, @CurrentUser() user: UserRef) {
    return this.events.setPublished(id, user.id, false);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/dashboard')
  dashboard(@Param('id') id: string, @CurrentUser() user: UserRef) {
    return this.events.dashboard(id, user.id);
  }

  // ----------------------------------------------------------------- admins

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/admins')
  listAdmins(@Param('id') id: string, @CurrentUser() user: UserRef) {
    return this.events.listAdmins(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/admins')
  addAdmin(
    @Param('id') id: string,
    @CurrentUser() user: UserRef,
    @Body(new ZodValidationPipe(eventAdminSchema)) body: EventAdminInput,
  ) {
    return this.events.addAdmin(id, user.id, body.email);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/admins/:adminId')
  removeAdmin(
    @Param('id') id: string,
    @Param('adminId') adminId: string,
    @CurrentUser() user: UserRef,
  ) {
    return this.events.removeAdmin(id, user.id, adminId);
  }

  // ------------------------------------------------------------ tournaments

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/tournaments')
  listTournaments(@Param('id') id: string, @CurrentUser() user: UserRef) {
    return this.events.listTournaments(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/tournaments')
  quickCreateTournament(
    @Param('id') id: string,
    @CurrentUser() user: UserRef,
    @Body(new ZodValidationPipe(eventQuickTournamentSchema))
    body: EventQuickTournamentInput,
  ) {
    return this.events.quickCreateTournament(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/tournaments/:tournamentId')
  attachTournament(
    @Param('id') id: string,
    @Param('tournamentId') tournamentId: string,
    @CurrentUser() user: UserRef,
  ) {
    return this.events.attachTournament(id, user.id, tournamentId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/tournaments/:tournamentId')
  detachTournament(
    @Param('id') id: string,
    @Param('tournamentId') tournamentId: string,
    @CurrentUser() user: UserRef,
  ) {
    return this.events.detachTournament(id, user.id, tournamentId);
  }

  // ---------------------------------------------------------------- tickets

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/tickets')
  listTickets(@Param('id') id: string, @CurrentUser() user: UserRef) {
    return this.tickets.listTickets(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/tickets')
  createTicket(
    @Param('id') id: string,
    @CurrentUser() user: UserRef,
    @Body(new ZodValidationPipe(createEventTicketSchema)) body: CreateEventTicketInput,
  ) {
    return this.tickets.createTicket(id, user.id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/tickets/:ticketId')
  updateTicket(
    @Param('id') id: string,
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: UserRef,
    @Body(new ZodValidationPipe(updateEventTicketSchema)) body: UpdateEventTicketInput,
  ) {
    return this.tickets.updateTicket(id, user.id, ticketId, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/tickets/:ticketId')
  deleteTicket(
    @Param('id') id: string,
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: UserRef,
  ) {
    return this.tickets.deleteTicket(id, user.id, ticketId);
  }

  // ----------------------------------------------------------------- orders

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/orders')
  listOrders(
    @Param('id') id: string,
    @CurrentUser() user: UserRef,
    @Query(new ZodValidationPipe(listEventOrdersQuerySchema)) query: ListEventOrdersQuery,
  ) {
    return this.tickets.listOrders(id, user.id, query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/orders/:orderId')
  updateOrder(
    @Param('id') id: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: UserRef,
    @Body(new ZodValidationPipe(updateEventOrderSchema)) body: UpdateEventOrderInput,
  ) {
    return this.tickets.updateOrder(id, user.id, orderId, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/orders/:orderId/verify-payment')
  verifyPayment(
    @Param('id') id: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: UserRef,
  ) {
    return this.tickets.verifyPayment(id, user.id, orderId);
  }

  // --------------------------------------------------------------- check-in

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/check-in/stats')
  checkInStats(@Param('id') id: string, @CurrentUser() user: UserRef) {
    return this.tickets.checkInStats(id, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/check-in')
  checkIn(
    @Param('id') id: string,
    @CurrentUser() user: UserRef,
    @Body(new ZodValidationPipe(eventCheckInSchema)) body: EventCheckInInput,
  ) {
    return this.tickets.checkIn(id, user.id, body.code);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/check-in/:orderId/undo')
  undoCheckIn(
    @Param('id') id: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: UserRef,
  ) {
    return this.tickets.undoCheckIn(id, user.id, orderId);
  }
}
