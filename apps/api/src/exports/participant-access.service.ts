import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { formatInTimeZone } from 'date-fns-tz';
import {
  tournamentSettingsSchema,
  type MatchResultInput,
  type ParticipantAccessMatch,
  type ParticipantAccessPayload,
  type PlayerHubItem,
} from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { MatchesService } from '../matches/matches.service';
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
    private readonly matches: MatchesService,
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
    return this.buildPayload(team, t, settings);
  }

  private buildPayload(
    team: {
      id: string;
      name: string;
      seed: number | null;
      logoUrl: string | null;
      checkedIn: boolean;
      withdrawn: boolean;
      players: { name: string }[];
    },
    t: {
      id: string;
      slug: string;
      name: string;
      timezone: string;
      logoUrl: string | null;
      status: string;
      format: string | null;
      matches: ExportMatch[];
      standings: {
        teamId: string;
        groupId: string | null;
        rank: number;
        played: number;
        wins: number;
        losses: number;
        draws: number;
        points: number;
        group?: { name: string } | null;
      }[];
    },
    settings: ReturnType<typeof tournamentSettingsSchema.parse>,
  ): ParticipantAccessPayload {
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

    const requireCheckIn = settings.requireCheckIn;
    const canCheckIn =
      requireCheckIn &&
      !team.checkedIn &&
      !team.withdrawn &&
      t.status !== 'COMPLETED';
    const canReportScore =
      settings.allowParticipantsReportScores &&
      t.status === 'ACTIVE' &&
      !!nextMatch &&
      nextMatch.status !== 'COMPLETED' &&
      !!nextMatch.opponent &&
      (!requireCheckIn || team.checkedIn);

    return {
      team: {
        id: team.id,
        name: team.name,
        seed: settings.hideSeedNumbers ? null : team.seed,
        logoUrl: team.logoUrl,
        players: team.players.map((p) => p.name),
        checkedIn: team.checkedIn,
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
      actions: {
        requireCheckIn,
        checkedIn: team.checkedIn,
        canCheckIn,
        canReportScore,
      },
    };
  }

  async checkIn(token: string) {
    const { team, tournament, settings } = await this.loadTeamFromToken(token);
    if (!settings.requireCheckIn) {
      throw new BadRequestException('Check-in is not required for this tournament');
    }
    if (tournament.status === 'COMPLETED') {
      throw new BadRequestException('This tournament is already finished');
    }
    if (team.withdrawn) throw new BadRequestException('This team has withdrawn');
    if (team.checkedIn) return this.resolve(token);
    await this.prisma.team.update({
      where: { id: team.id },
      data: { checkedIn: true, checkedInAt: new Date() },
    });
    return this.resolve(token);
  }

  async reportResult(token: string, matchId: string, input: MatchResultInput) {
    const { team } = await this.loadTeamFromToken(token);
    await this.matches.setResult(matchId, null, input, { teamId: team.id });
    return this.resolve(token);
  }

  async playHub(userId: string): Promise<PlayerHubItem[]> {
    const teams = await this.prisma.team.findMany({
      where: {
        registeredByUserId: userId,
        withdrawn: false,
        tournament: { status: { in: ['DRAFT', 'ACTIVE'] } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        tournament: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            logoUrl: true,
            settings: true,
          },
        },
      },
    });
    const items: PlayerHubItem[] = [];
    for (const team of teams) {
      try {
        const payload = await this.resolveFromTeamId(team.id);
        if (payload) {
          items.push({
            team: {
              id: payload.team.id,
              name: payload.team.name,
              checkedIn: payload.team.checkedIn,
            },
            tournament: {
              id: payload.tournament.id,
              slug: payload.tournament.slug,
              name: payload.tournament.name,
              status: payload.tournament.status,
              logoUrl: payload.tournament.logoUrl,
            },
            nextMatch: payload.nextMatch,
            requireCheckIn: payload.actions.requireCheckIn,
            canCheckIn: payload.actions.canCheckIn,
            canReportScore: payload.actions.canReportScore,
          });
          continue;
        }
      } catch {
        // Fall through to a lightweight row if the access page is disabled.
      }
      const settings = tournamentSettingsSchema.parse(team.tournament.settings ?? {});
      items.push({
        team: { id: team.id, name: team.name, checkedIn: team.checkedIn },
        tournament: {
          id: team.tournament.id,
          slug: team.tournament.slug,
          name: team.tournament.name,
          status: team.tournament.status,
          logoUrl: team.tournament.logoUrl,
        },
        nextMatch: null,
        requireCheckIn: settings.requireCheckIn,
        canCheckIn: settings.requireCheckIn && !team.checkedIn,
        canReportScore: false,
      });
    }
    return items;
  }

  private async resolveFromTeamId(teamId: string): Promise<ParticipantAccessPayload | null> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { players: { orderBy: { order: 'asc' } }, group: true },
    });
    if (!team) return null;
    const t = await this.prisma.tournament.findUnique({
      where: { id: team.tournamentId },
      include: EXPORT_INCLUDE,
    });
    if (!t) return null;
    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    if (!settings.participantAccessPages) return null;
    return this.buildPayload(team, t, settings);
  }

  private async loadTeamFromToken(token: string) {
    if (!token || token.length < 16 || token.length > 128) {
      throw new NotFoundException('Invalid access link');
    }
    const team = await this.prisma.team.findUnique({
      where: { accessTokenHash: hashToken(token) },
    });
    if (!team) throw new NotFoundException('This access link is not valid');
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: team.tournamentId },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    const settings = tournamentSettingsSchema.parse(tournament.settings ?? {});
    if (!settings.participantAccessPages) {
      throw new BadRequestException('Participant access pages are disabled for this tournament');
    }
    return { team, tournament, settings };
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
