import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { REALTIME_EVENTS } from '@bracket/shared';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  },
})
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('tournament:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tournamentId: string },
  ) {
    if (!body?.tournamentId) return { ok: false };
    client.join(this.room(body.tournamentId));
    return { ok: true, room: this.room(body.tournamentId) };
  }

  @SubscribeMessage('tournament:leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tournamentId: string },
  ) {
    if (!body?.tournamentId) return { ok: false };
    client.leave(this.room(body.tournamentId));
    return { ok: true };
  }

  emitMatchUpdated(tournamentId: string, match: unknown) {
    this.server
      .to(this.room(tournamentId))
      .emit(REALTIME_EVENTS.MATCH_UPDATED, { tournamentId, match });
  }

  emitStandingsUpdated(tournamentId: string, standings: unknown) {
    this.server
      .to(this.room(tournamentId))
      .emit(REALTIME_EVENTS.STANDINGS_UPDATED, { tournamentId, standings });
  }

  emitBracketUpdated(tournamentId: string) {
    this.server
      .to(this.room(tournamentId))
      .emit(REALTIME_EVENTS.BRACKET_UPDATED, { tournamentId });
  }

  emitDrawStep(tournamentId: string, step: unknown) {
    this.server
      .to(this.room(tournamentId))
      .emit(REALTIME_EVENTS.DRAW_STEP, { tournamentId, step });
  }

  emitDrawComplete(tournamentId: string) {
    this.server
      .to(this.room(tournamentId))
      .emit(REALTIME_EVENTS.DRAW_COMPLETE, { tournamentId });
  }

  emitCricketUpdated(tournamentId: string, matchId: string, scoreboard: unknown) {
    this.server
      .to(this.room(tournamentId))
      .emit(REALTIME_EVENTS.CRICKET_UPDATED, {
        tournamentId,
        matchId,
        scoreboard,
      });
  }

  private room(tournamentId: string) {
    return `tournament:${tournamentId}`;
  }
}
