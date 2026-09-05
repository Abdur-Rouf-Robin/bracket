import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { formatInTimeZone } from 'date-fns-tz';
import {
  tournamentSettingsSchema,
  type ParticipantAccessMatch,
  type ParticipantAccessPayload,
} from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { EXPORT_INCLUDE, PublicAccessService, type ExportMatch } from './public-access.service';
import { knockoutRoundCount, roundLabelFor, stationName } from './export-format.util';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

@Injectable()
export class ParticipantAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly pub: PublicAccessService,
  ) {}

  private url(token: string) {
    return `${this.pub.appUrl()}/p/${token}`;
  }

  /** Issue (or re-issue) an access link for one team. */
  async issueForTeam(tournamentId: string, teamId: string, userId: string) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const team = await this.prisma.team.findFirst({ where: { id: teamId, tournamentId } });
    if (!team) throw new NotFoundException('Team not found');
    const token = newToken();
    await this.prisma.team.update({
      where: { id: teamId },
      data: { accessTokenHash: hashToken(token) },
    });
    return { teamId, teamName: team.name, token, url: this.url(token) };
  }

  /**
   * Issue access links for every team. Existing hashes cannot be reversed, so
   * teams that already have a link are re-issued (new link invalidates old)
   * unless `onlyMissing` is set, in which case they are skipped.
   */
  async issueForAll(tournamentId: string, userId: string, onlyMissing = false) {
    await this.access.requireTournamentManager(tournamentId, userId);
    const teams = await this.prisma.team.findMany({
      where: { tournamentId },
      orderBy: { seed: 'asc' },
      include: { players: { orderBy: { order: 'asc' } } },
    });
    const links: { teamId: string; teamName: string; token: string | null; url: string | null; players: string[] }[] = [];
    for (const team of teams) {
      if (onlyMissing && team.accessTokenHash) {
        links.push({ teamId: team.id, teamName: team.name, token: null, url: null, players: team.players.map((p) => p.name) });
        continue;
      }
      const token = newToken();
      await this.prisma.team.update({
        where: { id: team.id },
        data: { accessTokenHash: hashToken(token) },
      });
      links.push({ teamId: team.id, teamName: team.name, token, url: this.url(token), players: team.players.map((p) => p.name) });
    }
    return links;
  }

  /** Resolve a public participant token into the team + tournament payload. */
  async resolve(token: string): Promise<ParticipantAccessPayload> {
    if (!token || token.length < 16 || token.length > 128) {
      throw new NotFoundException('Invalid access link');
    }
    const team = await this.prisma.team.findUnique({
      where: { accessTokenHash: hashToken(token) },
      include: { players: { orderBy: { order: 'asc' } }, group: true },
    });
    if (!team) throw new NotFoundException('This access link is not valid');
    // Access-link holders bypass the public/password gates for their own page.
    const t = await this.prisma.tournament.findUnique({
      where: { id: team.tournamentId },
      include: EXPORT_INCLUDE,
    });
    if (!t) throw new NotFoundException('Tournament not found');
    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    if (!settings.participantAccessPages) {
      throw new BadRequestException('Participant access pages are disabled for this tournament');
    }

    const total = knockoutRoundCount(t.matches);
    const mine = t.matches
      .filter((m) => !m.isBye && (m.homeTeamId === team.id || m.awayTeamId === team.id))
      .map((m) => this.toAccessMatch(m, team.id, settings, total));

    const now = Date.now();
    const pending = mine.filter((m) => m.status !== 'COMPLETED');
    const nextMatch =
      pending
        .filter((m) => m.opponent)
        .sort((a, b) => {
          const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
          const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
          if (ta !== tb) return ta - tb;
          return a.round - b.round;
        })
        .find((m) => !m.scheduledAt || new Date(m.scheduledAt).getTime() > now - 3 * 3600_000) ??
      pending[0] ??
      null;

    const standingRow = t.standings.find((s) => s.teamId === team.id);
    const groupSize = standingRow
      ? t.standings.filter((s) => s.groupId === standingRow.groupId).length
      : 0;
    const record = mine.reduce(
      (acc, m) => {
        if (m.result === 'win') acc.wins++;
        else if (m.result === 'loss') acc.losses++;
        else if (m.result === 'draw') acc.draws++;
        return acc;
      },
      { wins: 0, losses: 0, draws: 0 },
    );

    return {
      team: {
        id: team.id,
        name: team.name,
        seed: settings.hideSeedNumbers ? null : team.seed,
        logoUrl: team.logoUrl,
        players: team.players.map((p) => p.name),
      },
      tournament: {
        id: t.id,
        slug: t.slug,
        name: t.name,
        timezone: t.timezone,
        logoUrl: t.logoUrl,
        status: t.status,
        format: t.format,
      },
      matches: mine,
      nextMatch,
      standing: standingRow
        ? {
            rank: standingRow.rank,
            played: standingRow.played,
            wins: standingRow.wins,
            losses: standingRow.losses,
            draws: standingRow.draws,
            points: standingRow.points,
            groupName: standingRow.group?.name ?? null,
            groupSize,
          }
        : null,
      record,
    };
  }

  /** iCalendar feed of the participant's matches. */
  async ics(token: string): Promise<string> {
    const payload = await this.resolve(token);
    const tz = payload.tournament.timezone || 'UTC';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bracket//Participant schedule//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${esc(`${payload.tournament.name} — ${payload.team.name}`)}`,
      `X-WR-TIMEZONE:${tz}`,
    ];
    const stamp = fmtUtc(new Date());
    for (const m of payload.matches) {
      if (!m.scheduledAt) continue;
      const start = new Date(m.scheduledAt);
      const end = new Date(start.getTime() + 60 * 60_000);
      const opp = m.opponent?.name ?? 'TBD';
      lines.push(
        'BEGIN:VEVENT',
        `UID:${m.id}@bracket`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${fmtUtc(start)}`,
        `DTEND:${fmtUtc(end)}`,
        `SUMMARY:${esc(`${payload.team.name} vs ${opp} — ${payload.tournament.name}`)}`,
        `DESCRIPTION:${esc(`${m.roundLabel}${m.station ? ` · ${m.station}` : ''}\n${this.pub.appUrl()}/t/${payload.tournament.slug}`)}`,
        ...(m.station ? [`LOCATION:${esc(m.station)}`] : []),
        `URL:${this.pub.appUrl()}/t/${payload.tournament.slug}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  private toAccessMatch(
    m: ExportMatch,
    teamId: string,
    settings: ReturnType<typeof tournamentSettingsSchema.parse>,
    totalRounds: number,
  ): ParticipantAccessMatch {
    const isHome = m.homeTeamId === teamId;
    const opp = isHome ? m.awayTeam : m.homeTeam;
    const myScore = isHome ? m.homeScore : m.awayScore;
    const oppScore = isHome ? m.awayScore : m.homeScore;
    let result: ParticipantAccessMatch['result'] = null;
    if (m.status === 'COMPLETED') {
      if (m.isDraw) result = 'draw';
      else if (m.winnerTeamId === teamId) result = 'win';
      else if (m.winnerTeamId) result = 'loss';
    }
    return {
      id: m.id,
      round: m.round,
      roundLabel: roundLabelFor(m, settings, totalRounds),
      bracketSide: m.bracketSide,
      groupName: m.group?.name ?? null,
      status: m.status,
      scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
      station: stationName(m) || null,
      isHome,
      opponent: opp ? { id: opp.id, name: opp.name, logoUrl: opp.logoUrl } : null,
      myScore,
      opponentScore: oppScore,
      result,
    };
  }
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function fmtUtc(d: Date): string {
  return formatInTimeZone(d, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
}
