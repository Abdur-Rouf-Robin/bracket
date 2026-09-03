'use client';

import { useMemo, useRef } from 'react';
import type { Match, Team, Tournament } from '@/lib/types';
import { downloadElementPng } from '@/lib/export-png';
import { TeamBadge } from './team-badge';
import {
  computeBracketLayout,
  defaultRoundLabel,
  findChampion,
  getThirdPlaceMatch,
  type LayoutMatch,
} from './use-bracket-layout';

function teamLabel(m: Match, side: 'home' | 'away'): Team | null | undefined {
  return side === 'home' ? m.homeTeam : m.awayTeam;
}

function isWinner(m: Match, side: 'home' | 'away'): boolean {
  if (m.status !== 'COMPLETED' || !m.winnerTeamId) return false;
  const id = side === 'home' ? m.homeTeamId : m.awayTeamId;
  return id === m.winnerTeamId;
}

function winnerTeam(m: Match): Team | null | undefined {
  if (m.status !== 'COMPLETED') return null;
  return (
    m.winnerTeam ??
    (m.winnerTeamId
      ? { id: m.winnerTeamId, name: 'Winner', seed: null, groupId: null }
      : null)
  );
}

function MatchNode({ node }: { node: LayoutMatch }) {
  const { match: m, compact } = node;

  if (compact) {
    const w = winnerTeam(m);
    return (
      <div
        className="flex items-center justify-center rounded border border-[#2a3140] bg-[#12151c] px-2 shadow-sm"
        style={{ width: '100%', height: '100%' }}
      >
        {w ? (
          <TeamBadge team={w} size="sm" />
        ) : (
          <div className="flex gap-1">
            <div className="size-6 rounded border border-dashed border-[#3a4255] bg-[#1a1f2a]" />
            <div className="size-6 rounded border border-dashed border-[#3a4255] bg-[#1a1f2a]" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded border border-[#2a3140] bg-[#12151c] shadow-sm"
      style={{ width: '100%', height: '100%' }}
    >
      <div
        className={`flex items-center justify-between gap-1 border-b border-[#2a3140] px-2 py-1 ${
          isWinner(m, 'home') ? 'bg-emerald-500/15' : ''
        }`}
      >
        <TeamBadge team={teamLabel(m, 'home')} size="sm" />
        {m.status === 'COMPLETED' && (
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-[#9aa3b5]">
            {m.homeScore ?? 0}
          </span>
        )}
      </div>
      <div
        className={`flex items-center justify-between gap-1 px-2 py-1 ${
          isWinner(m, 'away') ? 'bg-emerald-500/15' : ''
        }`}
      >
        <TeamBadge team={teamLabel(m, 'away')} size="sm" />
        {m.status === 'COMPLETED' && (
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-[#9aa3b5]">
            {m.awayScore ?? 0}
          </span>
        )}
      </div>
    </div>
  );
}

function RoundHeaders({
  layout,
  roundLabels,
}: {
  layout: NonNullable<ReturnType<typeof computeBracketLayout>>;
  roundLabels?: Record<string, string>;
}) {
  const { totalRounds } = layout;
  const leftCols = totalRounds - 1;
  const centerX = leftCols * (168 + 36) + 24;

  const headers: { label: string; x: number }[] = [];

  for (let r = 1; r <= totalRounds - 1; r++) {
    const label = defaultRoundLabel(r, totalRounds, roundLabels);
    headers.push({ label, x: (r - 1) * (168 + 36) });
    headers.push({
      label,
      x: centerX + 24 + 168 + (leftCols - r) * (168 + 36),
    });
  }
  headers.push({
    label: defaultRoundLabel(totalRounds, totalRounds, roundLabels),
    x: centerX,
  });

  return (
    <>
      {headers.map((h, i) => (
        <div
          key={`${h.label}-${i}`}
          className="pointer-events-none absolute w-[168px] text-center text-[9px] font-bold uppercase tracking-widest text-[#9aa3b5]"
          style={{ left: h.x, top: 0 }}
        >
          {h.label}
        </div>
      ))}
    </>
  );
}

export function SymmetricalBracket({
  tournament,
  exportId,
  showHeader = true,
  showFooter = true,
}: {
  tournament: Tournament;
  exportId?: string;
  showHeader?: boolean;
  showFooter?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const settings = tournament.settings as
    | { roundLabels?: Record<string, string>; showCustomRoundLabels?: boolean }
    | undefined;
  const roundLabels =
    settings?.showCustomRoundLabels ? settings.roundLabels : undefined;

  const layout = useMemo(
    () => computeBracketLayout(tournament.matches),
    [tournament.matches],
  );

  const thirdPlace = useMemo(
    () => getThirdPlaceMatch(tournament.matches),
    [tournament.matches],
  );

  const champion = useMemo(
    () => findChampion(tournament.matches, tournament.teams),
    [tournament.matches, tournament.teams],
  );

  if (!layout) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Bracket tree appears once knockout matches are generated.
      </p>
    );
  }

  const canvasHeight =
    layout.height + (thirdPlace ? 72 : 0) + (showHeader ? 0 : 0);

  return (
    <div ref={containerRef} className="symmetrical-bracket">
      <div className="overflow-x-auto pb-2">
        <div
          id={exportId}
          className="relative rounded-2xl border border-[#2a3140] bg-[#0a0c10] p-4"
          style={{
            width: layout.width + 32,
            minWidth: layout.width + 32,
          }}
        >
          {showHeader && (
            <div className="mb-3 border-b border-[#2a3140] pb-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#38bdf8]">
                Knockout bracket
              </p>
              <h3 className="font-display text-lg font-bold text-white">
                {tournament.name}
              </h3>
              {tournament.game?.name && (
                <p className="text-xs text-[#9aa3b5]">{tournament.game.name}</p>
              )}
            </div>
          )}

          <div
            className="relative"
            style={{
              width: layout.width,
              height: canvasHeight,
              minWidth: layout.width,
            }}
          >
            <div className="relative" style={{ height: layout.height }}>
              <RoundHeaders layout={layout} roundLabels={roundLabels} />

              <svg
                className="pointer-events-none absolute left-0"
                style={{ top: 28, width: layout.width, height: layout.height - 28 }}
                width={layout.width}
                height={layout.height - 28}
              >
                {layout.connectors.map((c, i) => (
                  <path
                    key={i}
                    d={`M ${c.x1} ${c.y1 - 28} L ${c.x2} ${c.y2 - 28}`}
                    fill="none"
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth={1.5}
                  />
                ))}
              </svg>

              {layout.nodes.map((node) => (
                <div
                  key={node.match.id}
                  className="absolute"
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                  }}
                >
                  <MatchNode node={node} />
                </div>
              ))}
            </div>

            {thirdPlace && (
              <div
                className="absolute rounded border border-dashed border-[#3a4255] bg-[#12151c]/90 px-3 py-2"
                style={{
                  left: layout.width / 2 - 84,
                  top: layout.height - 48,
                  width: 168,
                }}
              >
                <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wider text-[#9aa3b5]">
                  3rd place
                </p>
                <div className="space-y-1">
                  <TeamBadge team={teamLabel(thirdPlace, 'home')} size="sm" />
                  <TeamBadge team={teamLabel(thirdPlace, 'away')} size="sm" />
                </div>
              </div>
            )}
          </div>

          {showFooter && (
            <div className="mt-2 border-t border-[#2a3140] pt-4 text-center">
              <p className="text-xs uppercase tracking-widest text-[#9aa3b5]">
                {champion ? 'Champion' : 'Winner'}
              </p>
              <p className="font-display text-2xl font-bold text-[#38bdf8]">
                {champion?.name ?? 'TBD'}
              </p>
              <p className="mt-1 font-mono text-[10px] text-[#6b7280]">
                /t/{tournament.slug}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export async function downloadBracketPng(
  elementId: string,
  filename: string,
): Promise<void> {
  return downloadElementPng(elementId, filename);
}

export function printBracket(): void {
  window.print();
}
