import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { pointsFromPosition } from '@bracket/bracket-engine';
import type { EventResultsInput } from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TournamentsService } from '../tournaments/tournaments.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly realtime: RealtimeGateway,
    private readonly tournaments: TournamentsService,
  ) {}

  async submitResults(
    tournamentId: string,
    userId: string,
    input: EventResultsInput,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { teams: true, eventResults: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    await this.tournaments.requireManage(tournamentId, userId);

    const format = tournament.format;
    if (
      !format ||
      ![
        'TIME_TRIAL',
        'SINGLE_RACE',
        'GRAND_PRIX',
        'LEADERBOARD',
        'FREE_FOR_ALL',
      ].includes(format)
    ) {
      throw new BadRequestException('Tournament is not an event-based format');
    }

    const rows = tournament.eventResults.filter(
      (r) => r.eventKey === input.eventKey,
    );
    if (!rows.length) {
      throw new BadRequestException('Unknown event key');
    }

    // Sort / assign positions
    let ranked = [...input.results];
    if (format === 'TIME_TRIAL') {
      ranked = [...ranked].sort((a, b) => a.value - b.value);
    } else if (format === 'LEADERBOARD' || format === 'FREE_FOR_ALL') {
      ranked = [...ranked].sort((a, b) => b.value - a.value);
    } else {
      // SINGLE_RACE / GRAND_PRIX: prefer explicit position, else sort by value ascending (finish time) or use position
      ranked = [...ranked].sort((a, b) => {
        const pa = a.position ?? a.value;
        const pb = b.position ?? b.value;
        return pa - pb;
      });
    }

    for (let i = 0; i < ranked.length; i++) {
      const r = ranked[i];
      const position = r.position ?? i + 1;
      let points = 0;
      if (format === 'LEADERBOARD' || format === 'FREE_FOR_ALL') {
        points = Math.round(r.value);
      } else if (format === 'TIME_TRIAL') {
        points = Math.max(0, ranked.length - position + 1);
      } else {
        points = pointsFromPosition(position);
      }

      await this.prisma.eventResult.updateMany({
        where: {
          tournamentId,
          eventKey: input.eventKey,
          teamId: r.teamId,
        },
        data: {
          value: r.value,
          position,
          points,
          status: MatchStatus.COMPLETED,
        },
      });
    }

    await this.jobs.recomputeStandings(tournamentId);
    this.realtime.emitBracketUpdated(tournamentId);

    return this.prisma.eventResult.findMany({
      where: { tournamentId, eventKey: input.eventKey },
      include: { team: true },
      orderBy: { position: 'asc' },
    });
  }
}
