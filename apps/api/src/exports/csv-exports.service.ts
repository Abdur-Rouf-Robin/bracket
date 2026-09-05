import { BadRequestException, Injectable } from '@nestjs/common';
import Papa from 'papaparse';
import type { CsvExportKind, ImportParticipantRow, ImportParticipantsInput, ImportPreview } from '@bracket/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AccessService } from '../common/access.service';
import { tournamentSettingsSchema } from '@bracket/shared';
import type { ResolvedTournament } from './public-access.service';
import {
  formatScheduled,
  formatSets,
  knockoutRoundCount,
  matchStatusLabel,
  roundLabelFor,
  scoreText,
  stageLabel,
  stationName,
  tournamentTz,
} from './export-format.util';

type Row = Record<string, string | number | boolean | null>;

@Injectable()
export class CsvExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly access: AccessService,
  ) {}

  async build(kind: CsvExportKind, resolved: ResolvedTournament): Promise<string> {
    switch (kind) {
      case 'participants':
        return this.toCsv(this.participants(resolved));
      case 'matches':
        return this.toCsv(this.matches(resolved));
      case 'standings':
        return this.toCsv(this.standings(resolved));
      case 'registrations':
        return this.toCsv(await this.registrations(resolved));
      case 'player-stats':
        return this.toCsv(await this.playerStats(resolved));
      default:
        throw new BadRequestException('Unknown export kind');
    }
  }

  private toCsv(rows: Row[]): string {
    if (!rows.length) return '';
    return Papa.unparse(rows, { newline: '\r\n' });
  }

  participants({ tournament, settings }: ResolvedTournament): Row[] {
    const groupById = new Map(tournament.groups.map((g) => [g.id, g.name]));
    return tournament.teams.map((t) => ({
      seed: settings.hideSeedNumbers ? '' : (t.seed ?? ''),
      name: t.name,
      group: t.groupId ? (groupById.get(t.groupId) ?? '') : '',
      players: t.players.map((p) => p.name).join('; '),
      captain: t.players.find((p) => p.isCaptain)?.name ?? '',
      logoUrl: t.logoUrl ?? '',
      checkedIn: t.checkedIn ? 'yes' : 'no',
      withdrawn: t.withdrawn ? 'yes' : 'no',
    }));
  }

  matches({ tournament, settings }: ResolvedTournament): Row[] {
    const tz = tournamentTz(tournament);
    const total = knockoutRoundCount(tournament.matches);
    return tournament.matches
      .filter((m) => !m.isBye)
      .map((m) => ({
        stage: stageLabel(m.bracketSide, settings),
        round: m.round,
        roundLabel: roundLabelFor(m, settings, total),
        group: m.group?.name ?? '',
        station: stationName(m),
        scheduledAt: formatScheduled(m.scheduledAt, tz),
        home: m.homeTeam?.name ?? 'TBD',
        away: m.awayTeam?.name ?? 'TBD',
        homeScore: scoreText(m.homeScore),
        awayScore: scoreText(m.awayScore),
        sets: formatSets(m.sets),
        winner: m.isDraw ? 'Draw' : (m.winnerTeam?.name ?? ''),
        status: matchStatusLabel(m.status),
      }));
  }

  standings({ tournament }: ResolvedTournament): Row[] {
    return tournament.standings.map((s) => ({
      group: s.group?.name ?? '',
      rank: s.rank,
      team: s.team.name,
      played: s.played,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      pointsFor: scoreText(s.pointsFor),
      pointsAgainst: scoreText(s.pointsAgainst),
      diff: scoreText(s.pointsFor - s.pointsAgainst),
      setsWon: s.setsWon,
      setsLost: s.setsLost,
      adjustments: s.adjustments,
      points: s.points,
    }));
  }

  async registrations({ tournament }: ResolvedTournament): Promise<Row[]> {
    const rows = await this.prisma.registration.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { email: true, name: true } } },
    });
    const tz = tournamentTz(tournament);
    return rows.map((r) => {
      const players = Array.isArray(r.players)
        ? (r.players as unknown[])
            .map((p) =>
              typeof p === 'string' ? p : ((p as { name?: string }).name ?? ''),
            )
            .filter(Boolean)
            .join('; ')
        : '';
      return {
        teamName: r.teamName,
        status: r.status,
        waitlistPosition: r.waitlistPosition ?? '',
        players,
        email: r.email ?? r.user?.email ?? '',
        phone: r.phone ?? '',
        country: r.countryCode ?? '',
        skillLevel: r.skillLevel ?? '',
        paymentStatus: r.paymentStatus,
        amount: (r.amountCents / 100).toFixed(2),
        currency: r.currency,
        waiverAcceptedAt: formatScheduled(r.waiverAcceptedAt, tz),
        customFields: JSON.stringify(r.customFields ?? {}),
        notes: r.notes ?? '',
        registeredAt: formatScheduled(r.createdAt, tz),
      };
    });
  }

  async playerStats({ tournament }: ResolvedTournament): Promise<Row[]> {
    const stats = await this.prisma.matchPlayerStat.findMany({
      where: { match: { tournamentId: tournament.id } },
      include: { player: true, team: true },
    });
    const agg = new Map<
      string,
      {
        team: string;
        player: string;
        matches: number;
        goals: number;
        assists: number;
        points: number;
        kills: number;
        deaths: number;
        yellowCards: number;
        redCards: number;
        mvpScore: number;
        mvpCount: number;
      }
    >();
    for (const s of stats) {
      const cur = agg.get(s.playerId) ?? {
        team: s.team.name,
        player: s.player.name,
        matches: 0,
        goals: 0,
        assists: 0,
        points: 0,
        kills: 0,
        deaths: 0,
        yellowCards: 0,
        redCards: 0,
        mvpScore: 0,
        mvpCount: 0,
      };
      cur.matches += 1;
      cur.goals += s.goals;
      cur.assists += s.assists;
      cur.points += s.points;
      cur.kills += s.kills;
      cur.deaths += s.deaths;
      cur.yellowCards += s.yellowCards;
      cur.redCards += s.redCards;
      cur.mvpScore += s.mvpScore;
      if (s.isMvp) cur.mvpCount += 1;
      agg.set(s.playerId, cur);
    }
    return [...agg.values()]
      .sort((a, b) => b.mvpScore - a.mvpScore)
      .map((r) => ({ ...r, mvpScore: Number(r.mvpScore.toFixed(2)) }));
  }

  // -------------------------------------------------------------------------
  // Import
  // -------------------------------------------------------------------------

  private static HEADER_ALIASES: Record<string, string[]> = {
    name: ['name', 'team', 'team name', 'teamname', 'participant', 'player', 'title'],
    seed: ['seed', 'seeding', 'rank', '#'],
    group: ['group', 'pool', 'division', 'groupname'],
    players: ['players', 'roster', 'members', 'lineup'],
    logoUrl: ['logourl', 'logo', 'logo url', 'image', 'avatar'],
    email: ['email', 'e-mail', 'contact'],
  };

  private detectColumns(header: string[]): Record<string, number | null> {
    const norm = header.map((h) => h.trim().toLowerCase());
    const out: Record<string, number | null> = {};
    for (const [key, aliases] of Object.entries(CsvExportsService.HEADER_ALIASES)) {
      const idx = norm.findIndex((h) => aliases.includes(h));
      out[key] = idx >= 0 ? idx : null;
    }
    return out;
  }

  private looksLikeHeader(row: string[]): boolean {
    const norm = row.map((h) => h.trim().toLowerCase());
    const all = Object.values(CsvExportsService.HEADER_ALIASES).flat();
    return norm.some((h) => all.includes(h));
  }

  parseImport(input: ImportParticipantsInput, maxParticipants: number, existing: number): ImportPreview {
    const parsed = Papa.parse<string[]>(input.csv.trim(), {
      skipEmptyLines: 'greedy',
    });
    const errors: { line: number; message: string }[] = [];
    const warnings: string[] = [];
    let rows = parsed.data.map((r) => r.map((c) => (c ?? '').toString()));
    if (parsed.errors.length) {
      for (const e of parsed.errors.slice(0, 5)) {
        warnings.push(`Line ${(e.row ?? 0) + 1}: ${e.message}`);
      }
    }
    if (!rows.length) {
      return { rows: [], columns: {}, errors: [{ line: 1, message: 'No rows found' }], warnings, willCreate: 0, willReplace: 0 };
    }

    const hasHeader = input.hasHeader ?? this.looksLikeHeader(rows[0]);
    let cols: Record<string, number | null>;
    if (hasHeader) {
      cols = this.detectColumns(rows[0]);
      rows = rows.slice(1);
      if (cols.name === null) {
        // Fall back to first column as name
        cols.name = 0;
        warnings.push('No "name" column detected — using the first column as team name.');
      }
    } else {
      const width = Math.max(...rows.map((r) => r.length));
      cols = {
        name: 0,
        seed: width > 1 && rows.every((r) => !r[1] || /^\d+$/.test(r[1].trim())) ? 1 : null,
        group: null,
        players: null,
        logoUrl: null,
        email: null,
      };
      if (width > 1 && cols.seed === null) cols.players = 1;
      if (width > 2) cols.group = cols.seed !== null ? 2 : null;
      if (width > 3) cols.players = 3;
    }

    const out: ImportParticipantRow[] = [];
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      const line = i + (hasHeader ? 2 : 1);
      const get = (k: string) => {
        const idx = cols[k];
        return idx === null || idx === undefined ? '' : (r[idx] ?? '').trim();
      };
      const name = get('name');
      if (!name) {
        errors.push({ line, message: 'Missing team/participant name' });
        return;
      }
      if (name.length > 80) {
        errors.push({ line, message: 'Name longer than 80 characters' });
        return;
      }
      const key = name.toLowerCase();
      if (seen.has(key)) {
        errors.push({ line, message: `Duplicate name "${name}"` });
        return;
      }
      seen.add(key);
      const seedRaw = get('seed');
      let seed: number | null = null;
      if (seedRaw) {
        const n = Number(seedRaw);
        if (!Number.isInteger(n) || n < 1) {
          errors.push({ line, message: `Invalid seed "${seedRaw}"` });
          return;
        }
        seed = n;
      }
      const players = get('players')
        .split(/[;|]/)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 20);
      const logoUrl = get('logoUrl') || null;
      if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
        warnings.push(`Line ${line}: logo URL ignored (must start with http)`);
      }
      const email = get('email') || null;
      out.push({
        name,
        seed,
        group: get('group') || null,
        players,
        logoUrl: logoUrl && /^https?:\/\//i.test(logoUrl) ? logoUrl : null,
        email,
      });
    });

    const base = input.mode === 'replace' ? 0 : existing;
    if (base + out.length > maxParticipants) {
      errors.push({
        line: 0,
        message: `Too many participants: ${base + out.length} > max ${maxParticipants}. Increase "max participants" in settings or trim the list.`,
      });
    }

    const columns: Record<string, string | null> = {};
    for (const [k, idx] of Object.entries(cols)) {
      columns[k] = idx === null ? null : hasHeader ? (parsed.data[0]?.[idx] ?? `col ${idx + 1}`) : `col ${idx + 1}`;
    }

    return {
      rows: out,
      columns,
      errors,
      warnings,
      willCreate: out.length,
      willReplace: input.mode === 'replace' ? existing : 0,
    };
  }

  async importParticipants(
    tournamentId: string,
    userId: string,
    input: ImportParticipantsInput,
  ) {
    const t = await this.access.requireTournamentManager(tournamentId, userId);
    const settings = tournamentSettingsSchema.parse(t.settings ?? {});
    const [existingCount, matchCount] = await Promise.all([
      this.prisma.team.count({ where: { tournamentId } }),
      this.prisma.match.count({ where: { tournamentId } }),
    ]);
    const preview = this.parseImport(input, settings.maxParticipants, existingCount);
    if (matchCount > 0) {
      preview.errors.unshift({
        line: 0,
        message: 'Bracket already generated — reset the bracket before importing participants.',
      });
    }
    if (input.dryRun) return { ok: preview.errors.length === 0, preview };
    if (preview.errors.length) {
      throw new BadRequestException({
        message: preview.errors[0].message,
        preview,
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (input.mode === 'replace') {
        await tx.standing.deleteMany({ where: { tournamentId } });
        await tx.team.deleteMany({ where: { tournamentId } });
        await tx.group.deleteMany({ where: { tournamentId } });
      }
      const existingTeams = await tx.team.findMany({
        where: { tournamentId },
        select: { name: true, seed: true },
      });
      const existingNames = new Set(existingTeams.map((x) => x.name.toLowerCase()));
      const rows = preview.rows.filter((r) => !existingNames.has(r.name.toLowerCase()));
      const skipped = preview.rows.length - rows.length;

      const groupNames = [...new Set(rows.map((r) => r.group).filter((g): g is string => !!g))];
      const groups = await tx.group.findMany({ where: { tournamentId } });
      const groupMap = new Map(groups.map((g) => [g.name, g.id]));
      let order = groups.length;
      for (const name of groupNames) {
        if (!groupMap.has(name)) {
          const g = await tx.group.create({ data: { tournamentId, name, order: order++ } });
          groupMap.set(name, g.id);
        }
      }

      let nextSeed = Math.max(0, ...existingTeams.map((x) => x.seed ?? 0)) + 1;
      let created = 0;
      for (const r of rows) {
        const team = await tx.team.create({
          data: {
            tournamentId,
            name: r.name,
            seed: r.seed ?? nextSeed++,
            logoUrl: r.logoUrl ?? null,
            groupId: r.group ? (groupMap.get(r.group) ?? null) : null,
          },
        });
        if (r.seed && r.seed >= nextSeed) nextSeed = r.seed + 1;
        if (r.players.length) {
          await tx.teamPlayer.createMany({
            data: r.players.map((name, idx) => ({
              teamId: team.id,
              name,
              order: idx,
              isCaptain: idx === 0,
            })),
          });
        }
        created += 1;
      }
      return { created, skipped };
    });

    this.realtime.emitBracketUpdated(tournamentId);
    return { ok: true, ...result, replaced: preview.willReplace };
  }
}
