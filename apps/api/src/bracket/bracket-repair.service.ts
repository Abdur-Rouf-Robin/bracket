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

      if (!winnerId) continue;

      if (m.nextMatchId && m.nextMatchSlot) {
        const next = byId.get(m.nextMatchId);
        if (next) {
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

      // Loser routing (placement ladders, consolation, losers bracket).
      const loserId = winnerId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
      if (loserId && m.loserNextMatchId && m.loserNextMatchSlot) {
        const next = byId.get(m.loserNextMatchId);
        if (next) {
          const slot = m.loserNextMatchSlot === 'home' ? 'homeTeamId' : 'awayTeamId';
          if (next[slot] !== loserId && next.status !== MatchStatus.COMPLETED) {
            await this.prisma.match.update({
              where: { id: next.id },
              data: { [slot]: loserId },
            });
            byId.set(next.id, { ...next, [slot]: loserId });
            await this.maybeReady(next.id);
          }
        }
      }
    }

    await this.autoResolveWalkovers(tournamentId);
  }

  /**
   * Complete matches that can never receive a second team: a slot is "dead"
   * when the match feeding it has finished without producing a team for that
   * slot (a bye has no loser, a walkover has no loser, a void match has no
   * winner). The remaining team advances by walkover; if both slots are dead
   * the match is voided. Also completes stranded bye matches (e.g. Swiss byes
   * that have no next match).
   */
  async autoResolveWalkovers(tournamentId: string): Promise<number> {
    let resolvedTotal = 0;
    for (let pass = 0; pass < 12; pass++) {
      const matches = await this.prisma.match.findMany({ where: { tournamentId } });
      const byId = new Map(matches.map((m) => [m.id, m]));
      const winnerFeeder = new Map<string, (typeof matches)[number]>();
      const loserFeeder = new Map<string, (typeof matches)[number]>();
      for (const m of matches) {
        if (m.nextMatchId && m.nextMatchSlot) {
          winnerFeeder.set(`${m.nextMatchId}:${m.nextMatchSlot}`, m);
        }
        if (m.loserNextMatchId && m.loserNextMatchSlot) {
          loserFeeder.set(`${m.loserNextMatchId}:${m.loserNextMatchSlot}`, m);
        }
      }

      const slotIsDead = (matchId: string, slot: 'home' | 'away'): boolean => {
        const wf = winnerFeeder.get(`${matchId}:${slot}`);
        const lf = loserFeeder.get(`${matchId}:${slot}`);
        if (!wf && !lf) return false;
        if (wf) {
          if (wf.status !== MatchStatus.COMPLETED) return false;
          if (wf.winnerTeamId) return false; // winner exists but not routed yet
        }
        if (lf) {
          if (lf.status !== MatchStatus.COMPLETED) return false;
          const hasLoser =
            !!lf.winnerTeamId && !!lf.homeTeamId && !!lf.awayTeamId && !lf.isBye;
          if (hasLoser) return false;
        }
        return true;
      };

      let changed = 0;
      for (const m of matches) {
        if (m.status === MatchStatus.COMPLETED) continue;
        if (m.bracketSide === 'GROUP') continue;
        if (m.legNumber) continue;
        if (m.key.includes('gf-reset')) continue;
        const hasHome = !!m.homeTeamId;
        const hasAway = !!m.awayTeamId;
        if (hasHome && hasAway) continue;

        // Stranded bye (Swiss / round-robin byes with no next match).
        if (m.isBye && (hasHome || hasAway)) {
          await this.completeWalkover(m.id, m.homeTeamId ?? m.awayTeamId!, hasHome);
          changed++;
          continue;
        }
        if (m.bracketSide === 'SWISS') continue;

        const homeDead = !hasHome && slotIsDead(m.id, 'home');
        const awayDead = !hasAway && slotIsDead(m.id, 'away');
        if ((hasHome && awayDead) || (hasAway && homeDead)) {
          const winnerId = (hasHome ? m.homeTeamId : m.awayTeamId)!;
          await this.completeWalkover(m.id, winnerId, hasHome);
          const next = m.nextMatchId ? byId.get(m.nextMatchId) : null;
          if (next && m.nextMatchSlot && next.status !== MatchStatus.COMPLETED) {
            const slot = m.nextMatchSlot === 'home' ? 'homeTeamId' : 'awayTeamId';
            await this.prisma.match.update({
              where: { id: next.id },
              data: { [slot]: winnerId },
            });
            await this.maybeReady(next.id);
          }
          changed++;
        } else if (!hasHome && !hasAway && homeDead && awayDead) {
          await this.prisma.match.update({
            where: { id: m.id },
            data: { status: MatchStatus.COMPLETED, winnerTeamId: null, isDraw: false },
          });
          changed++;
        }
      }
      resolvedTotal += changed;
      if (!changed) break;
    }
    if (resolvedTotal) this.realtime.emitBracketUpdated(tournamentId);
    return resolvedTotal;
  }

  private async completeWalkover(matchId: string, winnerId: string, winnerIsHome: boolean) {
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.COMPLETED,
        winnerTeamId: winnerId,
        isDraw: false,
        homeScore: winnerIsHome ? 1 : 0,
        awayScore: winnerIsHome ? 0 : 1,
      },
    });
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
