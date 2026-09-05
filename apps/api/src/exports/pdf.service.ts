import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { Response } from 'express';
import type { PdfExportKind } from '@bracket/shared';
import type { ExportMatch, ResolvedTournament } from './public-access.service';
import {
  formatScheduled,
  knockoutRoundCount,
  matchStatusLabel,
  roundLabelFor,
  scoreText,
  stageLabel,
  stationName,
  tournamentTz,
} from './export-format.util';

type Doc = PDFKit.PDFDocument;

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 40;
const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#d1d5db';
const ACCENT_FALLBACK = '#0ea5e9';

@Injectable()
export class PdfService {
  constructor() {}

  // -------------------------------------------------------------------------
  // Public entry points
  // -------------------------------------------------------------------------

  stream(res: Response, filename: string, build: (doc: Doc) => void | Promise<void>) {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true, info: { Title: filename } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    doc.pipe(res);
    Promise.resolve(build(doc))
      .catch((err: Error) => {
        doc.fontSize(12).fillColor('#b91c1c').text(`Could not render PDF: ${err.message}`);
      })
      .finally(() => doc.end());
  }

  async render(kind: PdfExportKind, resolved: ResolvedTournament, appUrl: string, doc: Doc) {
    const ctx = this.ctx(resolved, appUrl);
    this.header(doc, ctx, kind);
    switch (kind) {
      case 'standings':
        this.standings(doc, ctx);
        break;
      case 'matches':
        this.matches(doc, ctx);
        break;
      case 'participants':
        this.participants(doc, ctx);
        break;
      case 'bracket':
        this.bracket(doc, ctx);
        break;
      case 'schedule':
        this.schedule(doc, ctx);
        break;
    }
    this.footerAllPages(doc, ctx);
  }

  async qrPoster(resolved: ResolvedTournament, appUrl: string, doc: Doc) {
    const ctx = this.ctx(resolved, appUrl);
    const url = `${appUrl}/t/${ctx.t.slug}`;
    const png = await QRCode.toBuffer(url, { type: 'png', width: 900, margin: 1, errorCorrectionLevel: 'M' });
    doc.fillColor(ctx.accent).rect(0, 0, A4.width, 14).fill();
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(30);
    doc.text(ctx.t.name, MARGIN, 80, { width: A4.width - MARGIN * 2, align: 'center' });
    doc.font('Helvetica').fontSize(14).fillColor(MUTED);
    const sub = [ctx.t.game?.name, ctx.t.format?.replaceAll('_', ' ')].filter(Boolean).join(' · ');
    if (sub) doc.text(sub, { width: A4.width - MARGIN * 2, align: 'center' });
    const size = 340;
    const x = (A4.width - size) / 2;
    const y = 200;
    doc.roundedRect(x - 16, y - 16, size + 32, size + 32, 16).lineWidth(2).strokeColor(LINE).stroke();
    doc.image(png, x, y, { width: size, height: size });
    doc.font('Helvetica-Bold').fontSize(22).fillColor(INK);
    doc.text('Scan to follow live results', MARGIN, y + size + 50, { width: A4.width - MARGIN * 2, align: 'center' });
    doc.font('Helvetica').fontSize(13).fillColor(ctx.accent);
    doc.text(url, { width: A4.width - MARGIN * 2, align: 'center', link: url });
    this.footerAllPages(doc, ctx);
  }

  async participantQrSheet(
    resolved: ResolvedTournament,
    appUrl: string,
    links: { teamId: string; teamName: string; url: string; players: string[] }[],
    doc: Doc,
  ) {
    const ctx = this.ctx(resolved, appUrl);
    const cols = 2;
    const rows = 4;
    const cellW = (A4.width - MARGIN * 2) / cols;
    const cellH = (A4.height - MARGIN * 2 - 30) / rows;
    const qrSize = Math.min(cellH - 70, 120);
    let i = 0;
    for (const link of links) {
      const slot = i % (cols * rows);
      if (i > 0 && slot === 0) doc.addPage();
      if (slot === 0) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor(MUTED);
        doc.text(`${ctx.t.name} — participant access cards`, MARGIN, MARGIN - 20);
      }
      const cx = MARGIN + (slot % cols) * cellW;
      const cy = MARGIN + 10 + Math.floor(slot / cols) * cellH;
      doc.roundedRect(cx + 6, cy + 6, cellW - 12, cellH - 12, 10).lineWidth(1).strokeColor(LINE).stroke();
      const png = await QRCode.toBuffer(link.url, { type: 'png', width: 500, margin: 1 });
      doc.image(png, cx + (cellW - qrSize) / 2, cy + 16, { width: qrSize, height: qrSize });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(INK);
      doc.text(link.teamName, cx + 12, cy + 16 + qrSize + 8, { width: cellW - 24, align: 'center', ellipsis: true, height: 16 });
      doc.font('Helvetica').fontSize(8).fillColor(MUTED);
      if (link.players.length) {
        doc.text(link.players.join(', '), cx + 12, cy + 16 + qrSize + 26, { width: cellW - 24, align: 'center', ellipsis: true, height: 10 });
      }
      doc.fontSize(7).fillColor(ctx.accent);
      doc.text(link.url, cx + 12, cy + cellH - 26, { width: cellW - 24, align: 'center', ellipsis: true, height: 9, link: link.url });
      i += 1;
    }
    if (!links.length) {
      doc.font('Helvetica').fontSize(12).fillColor(MUTED).text('No participants yet.', MARGIN, MARGIN + 20);
    }
    this.footerAllPages(doc, ctx);
  }

  // -------------------------------------------------------------------------
  // Shared chrome
  // -------------------------------------------------------------------------

  private ctx(resolved: ResolvedTournament, appUrl: string) {
    const { tournament: t, settings, ownerPlan } = resolved;
    const accent =
      settings.brandPrimaryColor && /^#[0-9a-f]{6}$/i.test(settings.brandPrimaryColor)
        ? settings.brandPrimaryColor
        : ACCENT_FALLBACK;
    return {
      t,
      settings,
      appUrl,
      accent,
      tz: tournamentTz(t),
      hideBranding: !!settings.hideBranding,
      totalRounds: knockoutRoundCount(t.matches),
    };
  }
  private header(doc: Doc, ctx: ReturnType<PdfService['ctx']>, kind: string) {
    doc.fillColor(ctx.accent).rect(0, 0, A4.width, 8).fill();
    doc.font('Helvetica-Bold').fontSize(20).fillColor(INK);
    doc.text(ctx.t.name, MARGIN, MARGIN, { width: A4.width - MARGIN * 2 - 120 });
    doc.font('Helvetica').fontSize(10).fillColor(MUTED);
    const meta = [
      ctx.t.game?.name,
      ctx.t.format ? ctx.t.format.replaceAll('_', ' ') : null,
      ctx.t.startAt ? formatScheduled(ctx.t.startAt, ctx.tz, 'd MMM yyyy HH:mm') : null,
      ctx.t.venueName,
    ]
      .filter(Boolean)
      .join('  ·  ');
    if (meta) doc.text(meta);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(ctx.accent);
    doc.text(kind.charAt(0).toUpperCase() + kind.slice(1), A4.width - MARGIN - 120, MARGIN + 4, { width: 120, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text(`Generated ${formatScheduled(new Date(), ctx.tz, 'd MMM yyyy HH:mm')}`, A4.width - MARGIN - 160, MARGIN + 20, { width: 160, align: 'right' });
    doc.moveTo(MARGIN, MARGIN + 44).lineTo(A4.width - MARGIN, MARGIN + 44).lineWidth(1).strokeColor(LINE).stroke();
    doc.y = MARGIN + 56;
    doc.x = MARGIN;
  }

  private footerAllPages(doc: Doc, ctx: ReturnType<PdfService['ctx']>) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const y = A4.height - 28;
      doc.font('Helvetica').fontSize(8).fillColor(MUTED);
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      if (!ctx.hideBranding) {
        doc.text(`Generated by Bracket · ${ctx.appUrl}`, MARGIN, y, { width: 300, lineBreak: false });
      }
      doc.text(`${ctx.appUrl}/t/${ctx.t.slug}   ·   Page ${i - range.start + 1} of ${range.count}`, A4.width - MARGIN - 300, y, { width: 300, align: 'right', lineBreak: false });
      doc.page.margins.bottom = oldBottom;
    }
  }

  private ensureSpace(doc: Doc, needed: number) {
    if (doc.y + needed > A4.height - MARGIN - 20) {
      doc.addPage();
      doc.y = MARGIN;
    }
  }

  private sectionTitle(doc: Doc, text: string, accent: string) {
    this.ensureSpace(doc, 40);
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(accent).text(text, MARGIN);
    doc.moveDown(0.3);
  }

  private table(
    doc: Doc,
    columns: { key: string; label: string; width: number; align?: 'left' | 'right' | 'center' }[],
    rows: Record<string, string | number>[],
    accent: string,
  ) {
    const rowH = 18;
    const drawHead = () => {
      doc.rect(MARGIN, doc.y, A4.width - MARGIN * 2, rowH).fillColor('#f3f4f6').fill();
      let x = MARGIN + 4;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK);
      const y = doc.y + 5;
      for (const c of columns) {
        doc.text(c.label, x, y, { width: c.width - 8, align: c.align ?? 'left', lineBreak: false });
        x += c.width;
      }
      doc.y = y + rowH - 5;
    };
    drawHead();
    doc.font('Helvetica').fontSize(8.5);
    rows.forEach((r, idx) => {
      if (doc.y + rowH > A4.height - MARGIN - 20) {
        doc.addPage();
        doc.y = MARGIN;
        drawHead();
      }
      if (idx % 2 === 1) {
        doc.rect(MARGIN, doc.y, A4.width - MARGIN * 2, rowH).fillColor('#fafafa').fill();
      }
      let x = MARGIN + 4;
      const y = doc.y + 5;
      for (const c of columns) {
        doc.fillColor(c.key === 'winner' ? accent : INK);
        doc.text(String(r[c.key] ?? ''), x, y, { width: c.width - 8, align: c.align ?? 'left', lineBreak: false, ellipsis: true });
        x += c.width;
      }
      doc.y = y + rowH - 5;
    });
    doc.moveTo(MARGIN, doc.y).lineTo(A4.width - MARGIN, doc.y).strokeColor(LINE).lineWidth(0.5).stroke();
    doc.x = MARGIN;
    if (!rows.length) {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text('Nothing to show yet.', MARGIN, doc.y + 6);
    }
  }

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------

  private standings(doc: Doc, ctx: ReturnType<PdfService['ctx']>) {
    const { t } = ctx;
    const groups = t.groups.length ? t.groups : [{ id: null as string | null, name: 'Standings', order: 0 }];
    const cols = [
      { key: 'rank', label: '#', width: 30, align: 'center' as const },
      { key: 'team', label: 'Team', width: 190 },
      { key: 'played', label: 'P', width: 36, align: 'center' as const },
      { key: 'wins', label: 'W', width: 36, align: 'center' as const },
      { key: 'draws', label: 'D', width: 36, align: 'center' as const },
      { key: 'losses', label: 'L', width: 36, align: 'center' as const },
      { key: 'for', label: 'For', width: 44, align: 'center' as const },
      { key: 'against', label: 'Agst', width: 44, align: 'center' as const },
      { key: 'diff', label: '+/-', width: 44, align: 'center' as const },
      { key: 'points', label: 'Pts', width: 40, align: 'center' as const },
    ];
    let any = false;
    for (const g of groups) {
      const rows = t.standings.filter((s) => (g.id ? s.groupId === g.id : true));
      if (!rows.length && t.groups.length) continue;
      any = true;
      this.sectionTitle(doc, g.id ? `Group ${g.name}` : 'Standings', ctx.accent);
      this.table(
        doc,
        cols,
        rows.map((s) => ({
          rank: s.rank,
          team: s.team.name,
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          for: scoreText(s.pointsFor),
          against: scoreText(s.pointsAgainst),
          diff: scoreText(s.pointsFor - s.pointsAgainst),
          points: s.points,
        })),
        ctx.accent,
      );
    }
    if (!any) {
      doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('Standings appear once matches are played.', MARGIN, doc.y + 10);
    }
  }

  private matchRows(ctx: ReturnType<PdfService['ctx']>, matches: ExportMatch[]) {
    return matches.map((m) => ({
      stage: `${stageLabel(m.bracketSide, ctx.settings)}${m.group ? ` ${m.group.name}` : ''}`,
      round: roundLabelFor(m, ctx.settings, ctx.totalRounds),
      when: formatScheduled(m.scheduledAt, ctx.tz, 'd MMM HH:mm'),
      station: stationName(m),
      home: m.homeTeam?.name ?? 'TBD',
      score:
        m.status === 'COMPLETED' || m.homeScore != null || m.awayScore != null
          ? `${scoreText(m.homeScore) || '0'} – ${scoreText(m.awayScore) || '0'}`
          : 'vs',
      away: m.awayTeam?.name ?? 'TBD',
      winner: m.isDraw ? 'Draw' : (m.winnerTeam?.name ?? ''),
      status: matchStatusLabel(m.status),
    }));
  }

  private matches(doc: Doc, ctx: ReturnType<PdfService['ctx']>) {
    const cols = [
      { key: 'stage', label: 'Stage', width: 70 },
      { key: 'round', label: 'Round', width: 70 },
      { key: 'when', label: 'When', width: 62 },
      { key: 'home', label: 'Home', width: 110, align: 'right' as const },
      { key: 'score', label: 'Score', width: 46, align: 'center' as const },
      { key: 'away', label: 'Away', width: 110 },
      { key: 'status', label: 'Status', width: 48 },
    ];
    this.sectionTitle(doc, 'Matches', ctx.accent);
    this.table(doc, cols, this.matchRows(ctx, ctx.t.matches.filter((m) => !m.isBye)), ctx.accent);
  }

  private participants(doc: Doc, ctx: ReturnType<PdfService['ctx']>) {
    const groupById = new Map(ctx.t.groups.map((g) => [g.id, g.name]));
    const cols = [
      { key: 'seed', label: 'Seed', width: 40, align: 'center' as const },
      { key: 'name', label: 'Participant', width: 170 },
      { key: 'group', label: 'Group', width: 55 },
      { key: 'players', label: 'Players', width: 200 },
      { key: 'checkedIn', label: 'Check-in', width: 50, align: 'center' as const },
    ];
    this.sectionTitle(doc, `Participants (${ctx.t.teams.length})`, ctx.accent);
    this.table(
      doc,
      cols,
      ctx.t.teams.map((team) => ({
        seed: ctx.settings.hideSeedNumbers ? '' : (team.seed ?? ''),
        name: team.name,
        group: team.groupId ? (groupById.get(team.groupId) ?? '') : '',
        players: team.players.map((p) => p.name).join(', '),
        checkedIn: team.checkedIn ? '✓' : '',
      })),
      ctx.accent,
    );
  }

  private schedule(doc: Doc, ctx: ReturnType<PdfService['ctx']>) {
    const scheduled = ctx.t.matches.filter((m) => !m.isBye && m.scheduledAt);
    const unscheduled = ctx.t.matches.filter((m) => !m.isBye && !m.scheduledAt);
    const byDay = new Map<string, ExportMatch[]>();
    for (const m of scheduled) {
      const day = formatScheduled(m.scheduledAt, ctx.tz, 'EEEE d MMMM yyyy');
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(m);
    }
    const cols = [
      { key: 'when', label: 'Time', width: 50 },
      { key: 'station', label: 'Station', width: 70 },
      { key: 'stage', label: 'Stage', width: 90 },
      { key: 'home', label: 'Home', width: 120, align: 'right' as const },
      { key: 'score', label: '', width: 40, align: 'center' as const },
      { key: 'away', label: 'Away', width: 120 },
    ];
    if (!byDay.size) {
      doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('No matches have been scheduled yet.', MARGIN, doc.y + 10);
    }
    for (const [day, list] of byDay) {
      this.sectionTitle(doc, day, ctx.accent);
      const sorted = [...list].sort((a, b) => {
        const sa = stationName(a);
        const sb = stationName(b);
        const ta = a.scheduledAt!.getTime();
        const tb = b.scheduledAt!.getTime();
        return ta - tb || sa.localeCompare(sb);
      });
      this.table(
        doc,
        cols,
        this.matchRows(ctx, sorted).map((r) => ({ ...r, when: r.when.split(' ').slice(-1)[0] })),
        ctx.accent,
      );
    }
    if (unscheduled.length) {
      this.sectionTitle(doc, `Not yet scheduled (${unscheduled.length})`, ctx.accent);
      this.table(doc, cols, this.matchRows(ctx, unscheduled), ctx.accent);
    }
  }

  // -------------------------------------------------------------------------
  // Bracket tree
  // -------------------------------------------------------------------------

  private bracket(doc: Doc, ctx: ReturnType<PdfService['ctx']>) {
    const t = ctx.t;
    const knockout = t.matches.filter((m) => m.bracketSide !== 'GROUP' && m.bracketSide !== 'SWISS');
    const isTree =
      t.format === 'SINGLE_ELIMINATION' ||
      t.format === 'DOUBLE_ELIMINATION' ||
      t.format === 'GROUPS_KNOCKOUT';
    if (!isTree || !knockout.length) {
      this.sectionTitle(doc, 'Bracket', ctx.accent);
      doc.font('Helvetica').fontSize(9).fillColor(MUTED);
      doc.text(
        knockout.length
          ? 'Tree view is available for elimination formats; showing match list.'
          : 'No knockout matches yet — showing match list.',
        MARGIN,
      );
      this.matches(doc, ctx);
      return;
    }

    const winners = knockout.filter((m) => m.bracketSide === 'WINNERS');
    const finals = knockout.filter((m) => m.bracketSide === 'FINAL' || m.bracketSide === 'GRAND_FINAL');
    const losers = knockout.filter((m) => m.bracketSide === 'LOSERS');

    // Landscape page for the tree
    doc.addPage({ size: 'A4', layout: 'landscape', margin: MARGIN });
    const pageW = A4.height;
    const pageH = A4.width;
    doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text(`${t.name} — Bracket`, MARGIN, MARGIN - 10);
    let top = MARGIN + 16;
    const mainTree = [...winners, ...finals];
    const hasLosers = losers.length > 0;
    const availH = pageH - MARGIN * 2 - 30;
    const winnersH = hasLosers ? availH * 0.55 : availH;
    if (hasLosers) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(ctx.settings.bracketNames?.winners || 'Winners bracket', MARGIN, top);
      top += 12;
    }
    this.drawTree(doc, ctx, mainTree, MARGIN, top, pageW - MARGIN * 2, winnersH - (hasLosers ? 12 : 0));
    if (hasLosers) {
      const ly = top + winnersH;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(ctx.settings.bracketNames?.losers || 'Losers bracket', MARGIN, ly);
      this.drawTree(doc, ctx, losers, MARGIN, ly + 12, pageW - MARGIN * 2, availH - winnersH - 24);
    }
  }

  private drawTree(
    doc: Doc,
    ctx: ReturnType<PdfService['ctx']>,
    matches: ExportMatch[],
    x0: number,
    y0: number,
    width: number,
    height: number,
  ) {
    if (!matches.length) return;
    const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
    // Finals belong to the last column(s)
    const byRound = new Map<number, ExportMatch[]>();
    for (const r of rounds) {
      byRound.set(
        r,
        matches.filter((m) => m.round === r).sort((a, b) => a.position - b.position),
      );
    }
    const colCount = rounds.length;
    const colW = width / colCount;
    const boxW = Math.min(colW - 18, 150);
    const firstCount = Math.max(...[...byRound.values()].map((l) => l.length));
    const boxH = Math.max(18, Math.min(34, (height - 20) / firstCount - 6));
    const fontSize = boxH >= 30 ? 8 : boxH >= 24 ? 7 : 6;
    const centers = new Map<string, { x: number; y: number }>();

    rounds.forEach((r, ci) => {
      const list = byRound.get(r)!;
      const x = x0 + ci * colW;
      // Column header
      doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED);
      doc.text(roundLabelFor(list[0], ctx.settings, ctx.totalRounds).toUpperCase(), x, y0, { width: boxW, align: 'center', lineBreak: false });
      const slotH = (height - 14) / list.length;
      list.forEach((m, i) => {
        const feeders = matches.filter((f) => f.nextMatchId === m.id && centers.has(f.id));
        let cy: number;
        if (feeders.length) {
          cy = feeders.reduce((s, f) => s + centers.get(f.id)!.y, 0) / feeders.length;
        } else {
          cy = y0 + 14 + slotH * i + slotH / 2;
        }
        const by = cy - boxH / 2;
        this.drawMatchBox(doc, ctx, m, x, by, boxW, boxH, fontSize);
        centers.set(m.id, { x: x + boxW, y: cy });
        // Connectors from feeders
        for (const f of feeders) {
          const c = centers.get(f.id)!;
          const midX = x - 8;
          doc.moveTo(c.x, c.y).lineTo(midX, c.y).lineTo(midX, cy).lineTo(x, cy).lineWidth(0.7).strokeColor(LINE).stroke();
        }
      });
    });
  }

  private drawMatchBox(
    doc: Doc,
    ctx: ReturnType<PdfService['ctx']>,
    m: ExportMatch,
    x: number,
    y: number,
    w: number,
    h: number,
    fontSize: number,
  ) {
    doc.roundedRect(x, y, w, h, 3).lineWidth(0.8).strokeColor(m.status === 'COMPLETED' ? ctx.accent : LINE).stroke();
    const half = h / 2;
    doc.moveTo(x, y + half).lineTo(x + w, y + half).lineWidth(0.4).strokeColor(LINE).stroke();
    const rows: [string, string, boolean][] = [
      [m.homeTeam?.name ?? (m.isBye ? 'BYE' : 'TBD'), scoreText(m.homeScore), m.winnerTeamId != null && m.winnerTeamId === m.homeTeamId],
      [m.awayTeam?.name ?? (m.isBye ? 'BYE' : 'TBD'), scoreText(m.awayScore), m.winnerTeamId != null && m.winnerTeamId === m.awayTeamId],
    ];
    rows.forEach(([name, score, won], i) => {
      const ty = y + i * half + (half - fontSize) / 2 - 1;
      doc.font(won ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(won ? INK : m.homeTeam || m.awayTeam ? INK : MUTED);
      doc.text(name, x + 4, ty, { width: w - 26, lineBreak: false, ellipsis: true });
      if (score) {
        doc.fillColor(won ? ctx.accent : MUTED);
        doc.text(score, x + w - 22, ty, { width: 18, align: 'right', lineBreak: false });
      }
    });
    if (m.scheduledAt && h >= 30) {
      doc.font('Helvetica').fontSize(5).fillColor(MUTED);
      doc.text(formatScheduled(m.scheduledAt, ctx.tz, 'd MMM HH:mm'), x, y - 6, { width: w, align: 'right', lineBreak: false });
    }
  }
}
