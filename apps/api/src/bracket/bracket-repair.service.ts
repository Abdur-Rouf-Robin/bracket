import { Injectable } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class BracketRepairService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Fix completed matches missing a winner and propagate winners into next rounds. */
  async repairBracketAdvancement(tournamentId: string) {
    const matches = await this.prisma.match.findMany({
      where: { tournamentId },
    });
    const byId = new Map(matches.map((m) => [m.id, m]));

    for (const m of matches) {
      if (m.status !== MatchStatus.COMPLETED) continue;
      if (!m.homeTeamId || !m.awayTeamId) continue;
      if (m.isDraw || m.isNoResult) continue;

      let winnerId = m.winnerTeamId;
      const hs = m.homeScore ?? 0;
      const as = m.awayScore ?? 0;

      if (
        !winnerId &&
        hs !== as &&
        m.homeScore != null &&
        m.awayScore != null
      ) {
        winnerId = hs > as ? m.homeTeamId : m.awayTeamId;
        await this.prisma.match.update({
          where: { id: m.id },
          data: { winnerTeamId: winnerId, isDraw: false },
        });
      }

      if (!winnerId || !m.nextMatchId || !m.nextMatchSlot) continue;

      const next = byId.get(m.nextMatchId);
      if (!next) continue;

      const slot = m.nextMatchSlot === 'home' ? 'homeTeamId' : 'awayTeamId';
      if (next[slot] !== winnerId) {
        await this.prisma.match.update({
          where: { id: next.id },
          data: { [slot]: winnerId },
        });
        byId.set(next.id, { ...next, [slot]: winnerId });
        await this.maybeReady(next.id);
      }
    }
  }

  private async maybeReady(matchId: string) {
    const m = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (m?.homeTeamId && m.awayTeamId && m.status === MatchStatus.PENDING) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.READY },
      });
      this.realtime.emitBracketUpdated(m.tournamentId);
    }
  }
}
