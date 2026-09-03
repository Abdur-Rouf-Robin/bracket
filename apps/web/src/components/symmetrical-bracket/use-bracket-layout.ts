import type { Match } from '@/lib/types';

export type Wing = 'left' | 'right' | 'center';

export type LayoutMatch = {
  match: Match;
  x: number;
  y: number;
  width: number;
  height: number;
  wing: Wing;
  round: number;
  compact: boolean;
};

export type Connector = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  wing: Wing;
};

export type BracketLayout = {
  nodes: LayoutMatch[];
  connectors: Connector[];
  width: number;
  height: number;
  totalRounds: number;
  round1Count: number;
};

const COL_W = 168;
const CONN_W = 36;
const TEAM_H = 26;
const MATCH_PAD = 4;
const FULL_MATCH_H = TEAM_H * 2 + MATCH_PAD * 2 + 2;
const COMPACT_MATCH_H = 34;
const HEADER_H = 28;
const FOOTER_H = 72;
const CENTER_GAP = 48;

function isThirdPlace(m: Match) {
  return m.key.includes('3rd');
}

function isGrandFinalReset(m: Match) {
  return m.key.includes('gf-reset');
}

export function filterSymmetricalMatches(matches: Match[]): Match[] {
  return matches.filter(
    (m) =>
      !isThirdPlace(m) &&
      !isGrandFinalReset(m) &&
      (m.bracketSide === 'WINNERS' || m.bracketSide === 'FINAL'),
  );
}

export function getThirdPlaceMatch(matches: Match[]): Match | undefined {
  return matches.find(isThirdPlace);
}

function wingFor(round: number, position: number, round1Count: number): Wing {
  const inRound = round1Count / 2 ** (round - 1);
  const half = inRound / 2;
  if (half <= 0) return 'center';
  return position < half ? 'left' : 'right';
}

function localPosition(round: number, position: number, round1Count: number): number {
  const inRound = round1Count / 2 ** (round - 1);
  const half = inRound / 2;
  return position < half ? position : position - half;
}

function yForMatch(
  round: number,
  localPos: number,
  unit: number,
  blockH: number,
): number {
  const slot = localPos * 2 ** round + 2 ** (round - 1);
  return HEADER_H + slot * unit - blockH / 2;
}

export function defaultRoundLabel(
  round: number,
  totalRounds: number,
  custom?: Record<string, string>,
): string {
  if (custom?.[String(round)]) return custom[String(round)]!;
  const teamsLeft = 2 ** (totalRounds - round + 1);
  if (teamsLeft <= 2) return 'Final';
  if (teamsLeft === 4) return 'Semi-finals';
  if (teamsLeft === 8) return 'Quarter-finals';
  return `Round of ${teamsLeft}`;
}

export function computeBracketLayout(matches: Match[]): BracketLayout | null {
  const tree = filterSymmetricalMatches(matches);
  if (!tree.length) return null;

  const round1 = tree
    .filter((m) => m.round === 1 && m.bracketSide === 'WINNERS')
    .sort((a, b) => a.position - b.position);
  if (!round1.length) return null;

  const round1Count = round1.length;
  const totalRounds = Math.max(...tree.map((m) => m.round));
  const unit = TEAM_H + MATCH_PAD;
  const treeHeight = round1Count * unit * 2;

  const byId = new Map(tree.map((m) => [m.id, m]));
  const nodes: LayoutMatch[] = [];
  const connectors: Connector[] = [];

  const leftRounds = Math.ceil((totalRounds - 1) / 1); // rounds before final on each wing
  const leftCols = leftRounds;
  const centerX =
    leftCols * (COL_W + CONN_W) + CENTER_GAP / 2;

  for (const m of tree) {
    const isFinal = m.bracketSide === 'FINAL';
    const compact = m.round > 1;
    const blockH = compact ? COMPACT_MATCH_H : FULL_MATCH_H;

    if (isFinal) {
      const x = centerX;
      const y = HEADER_H + treeHeight / 2 - blockH / 2;
      nodes.push({
        match: m,
        x,
        y,
        width: COL_W,
        height: blockH,
        wing: 'center',
        round: m.round,
        compact,
      });
      continue;
    }

    const wing = wingFor(m.round, m.position, round1Count);
    const localPos = localPosition(m.round, m.position, round1Count);
    const y = yForMatch(m.round, localPos, unit, blockH);

    const col = m.round - 1;
    const x =
      wing === 'left'
        ? col * (COL_W + CONN_W)
        : centerX + CENTER_GAP / 2 + COL_W + (leftCols - 1 - col) * (COL_W + CONN_W);

    nodes.push({
      match: m,
      x,
      y,
      width: COL_W,
      height: blockH,
      wing,
      round: m.round,
      compact,
    });
  }

  for (const m of tree) {
    if (!m.nextMatchId) continue;
    const next = byId.get(m.nextMatchId);
    if (!next || isThirdPlace(next)) continue;

    const from = nodes.find((n) => n.match.id === m.id);
    const to = nodes.find((n) => n.match.id === next.id);
    if (!from || !to) continue;

    const fromMidY = from.y + from.height / 2;
    const toMidY = to.y + to.height / 2;
    const wing = from.wing === 'center' ? 'center' : from.wing;

    if (from.wing === 'left') {
      const x1 = from.x + from.width;
      const x2 = to.x;
      const midX = x1 + CONN_W / 2;
      connectors.push({ x1, y1: fromMidY, x2: midX, y2: fromMidY, wing });
      connectors.push({ x1: midX, y1: fromMidY, x2: midX, y2: toMidY, wing });
      connectors.push({ x1: midX, y1: toMidY, x2: x2, y2: toMidY, wing });
    } else if (from.wing === 'right') {
      const x1 = from.x;
      const x2 = to.x + to.width;
      const midX = x1 - CONN_W / 2;
      connectors.push({ x1, y1: fromMidY, x2: midX, y2: fromMidY, wing });
      connectors.push({ x1: midX, y1: fromMidY, x2: midX, y2: toMidY, wing });
      connectors.push({ x1: midX, y1: toMidY, x2: x2, y2: toMidY, wing });
    } else {
      connectors.push({
        x1: from.x + from.width / 2,
        y1: from.y + from.height,
        x2: to.x + to.width / 2,
        y2: to.y,
        wing: 'center',
      });
    }
  }

  const maxX = Math.max(...nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...nodes.map((n) => n.y + n.height));

  return {
    nodes,
    connectors,
    width: maxX + 24,
    height: maxY + FOOTER_H,
    totalRounds,
    round1Count,
  };
}

export function findChampion(
  matches: Match[],
  teams: { id: string; name: string }[],
): { id: string; name: string } | null {
  const final = matches.find(
    (m) => m.bracketSide === 'FINAL' && !isThirdPlace(m) && m.status === 'COMPLETED',
  );
  if (!final?.winnerTeamId) return null;
  const team = teams.find((t) => t.id === final.winnerTeamId);
  return team ?? null;
}
