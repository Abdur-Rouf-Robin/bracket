'use client';

import type { EngineGroup, EngineTeam, GeneratedMatch } from '@bracket/bracket-engine';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { PreviewResult } from './generate-preview';

type Side = 'home' | 'away';

function roundLabel(round: number, totalRounds: number): string {
  const teamsLeft = 2 ** (totalRounds - round + 1);
  if (teamsLeft <= 2) return 'Final';
  if (teamsLeft === 4) return 'Semi-finals';
  if (teamsLeft === 8) return 'Quarter-finals';
  return `Round of ${teamsLeft}`;
}

function shortKey(key: string): string {
  const m = key.match(/r(\d+)-p(\d+)/);
  if (m) return `R${m[1]} M${Number(m[2]) + 1}`;
  if (key.endsWith('gf')) return 'Grand final';
  return key.toUpperCase();
}

function slotLabel(
  m: GeneratedMatch,
  side: Side,
  teams: Map<string, EngineTeam>,
  all: Map<string, GeneratedMatch>,
): { text: string; seed?: number; muted: boolean } {
  const id = side === 'home' ? m.homeTeamId : m.awayTeamId;
  if (id) {
    const t = teams.get(id);
    return { text: t?.name ?? id, seed: t?.seed, muted: false };
  }
  const from = side === 'home' ? m.homeFromMatchKey : m.awayFromMatchKey;
  if (from) {
    const src = all.get(from);
    const isLoserFeed = src?.loserNextMatchKey === m.key;
    return {
      text: `${isLoserFeed ? 'Loser' : 'Winner'} of ${shortKey(from)}`,
      muted: true,
    };
  }
  if (m.isBye) return { text: 'BYE', muted: true };
  return { text: 'TBD', muted: true };
}

function MatchBox({
  m,
  teams,
  all,
  compact,
}: {
  m: GeneratedMatch;
  teams: Map<string, EngineTeam>;
  all: Map<string, GeneratedMatch>;
  compact: boolean;
}) {
  const home = slotLabel(m, 'home', teams, all);
  const away = slotLabel(m, 'away', teams, all);
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-card)] shadow-sm',
        m.isBye && 'opacity-60',
      )}
      data-match={m.key}
    >
      {[home, away].map((slot, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-1.5 px-2',
            compact ? 'h-6 text-[11px]' : 'h-7 text-xs',
            i === 0 && 'border-b border-[var(--color-line)]',
          )}
        >
          {slot.seed != null && (
            <span className="w-4 shrink-0 text-[10px] tabular-nums text-[var(--color-muted)]">
              {slot.seed}
            </span>
          )}
          <span
            className={cn(
              'truncate',
              slot.muted ? 'italic text-[var(--color-muted)]' : 'font-semibold text-[var(--color-ink)]',
            )}
          >
            {slot.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function BracketTree({
  title,
  matches,
  teams,
  all,
  compact,
  labelRounds,
}: {
  title?: string;
  matches: GeneratedMatch[];
  teams: Map<string, EngineTeam>;
  all: Map<string, GeneratedMatch>;
  compact: boolean;
  labelRounds: (round: number, total: number) => string;
}) {
  const rounds = useMemo(() => {
    const byRound = new Map<number, GeneratedMatch[]>();
    for (const m of matches) {
      const list = byRound.get(m.round) ?? [];
      list.push(m);
      byRound.set(m.round, list);
    }
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, list]) => ({ round, list: list.sort((a, b) => a.position - b.position) }));
  }, [matches]);

  if (!rounds.length) return null;
  const total = rounds.length;
  const maxCount = Math.max(...rounds.map((r) => r.list.length));
  const matchH = compact ? 50 : 58;
  const gap = compact ? 10 : 14;
  const height = maxCount * (matchH + gap);
  const colW = compact ? 150 : 176;

  return (
    <div>
      {title && (
        <p className="font-display mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-muted)]">
          {title}
        </p>
      )}
      <div className="flex gap-6" style={{ minHeight: height + 22 }}>
        {rounds.map(({ round, list }, idx) => (
          <div key={round} className="flex shrink-0 flex-col" style={{ width: colW }}>
            <p className="mb-1.5 truncate text-center text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">
              {labelRounds(idx + 1, total)}
            </p>
            <div className="flex flex-1 flex-col justify-around gap-2" style={{ height }}>
              {list.map((m) => (
                <div key={m.key} className="relative">
                  {idx > 0 && (
                    <span
                      aria-hidden
                      className="absolute -left-6 top-1/2 h-px w-6 bg-[var(--color-line-strong)]"
                    />
                  )}
                  <MatchBox m={m} teams={teams} all={all} compact={compact} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PairingsList({
  title,
  matches,
  teams,
  compact,
  groupLabel,
}: {
  title: string;
  matches: GeneratedMatch[];
  teams: Map<string, EngineTeam>;
  compact: boolean;
  groupLabel?: string;
}) {
  const rounds = useMemo(() => {
    const byRound = new Map<number, GeneratedMatch[]>();
    for (const m of matches) {
      const list = byRound.get(m.round) ?? [];
      list.push(m);
      byRound.set(m.round, list);
    }
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches]);

  return (
    <div className="min-w-0">
      <p className="font-display mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-muted)]">
        {title}
      </p>
      <div className={cn('grid gap-3', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3')}>
        {rounds.map(([round, list]) => (
          <div key={round} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)]">
            <p className="border-b border-[var(--color-line)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">
              {groupLabel ? `${groupLabel} · ` : ''}Round {round}
            </p>
            <ul className="divide-y divide-[var(--color-line)]">
              {list
                .sort((a, b) => a.position - b.position)
                .map((m) => (
                  <li
                    key={m.key}
                    className={cn(
                      'grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 text-xs',
                      compact ? 'h-7' : 'h-8',
                    )}
                  >
                    <span className="truncate text-right font-semibold">
                      {teams.get(m.homeTeamId ?? '')?.name ?? 'TBD'}
                    </span>
                    <span className="text-[10px] text-[var(--color-muted)]">vs</span>
                    <span className="truncate font-semibold">
                      {teams.get(m.awayTeamId ?? '')?.name ?? 'TBD'}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankingTable({
  teams,
  mode,
}: {
  teams: EngineTeam[];
  mode: 'points' | 'time' | 'placement';
}) {
  const cols =
    mode === 'time' ? ['#', 'Participant', 'Best time'] : mode === 'placement' ? ['#', 'Participant', 'Placement', 'Points'] : ['#', 'Participant', 'Events', 'Points'];
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-[var(--color-surface)] text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
          <tr>
            {cols.map((c, i) => (
              <th key={c} className={cn('px-3 py-2 text-left font-bold', i >= 2 && 'text-right')}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-line)]">
          {teams.map((t, i) => (
            <tr key={t.id}>
              <td className="px-3 py-1.5 tabular-nums text-[var(--color-muted)]">{i + 1}</td>
              <td className="px-3 py-1.5 font-semibold">{t.name}</td>
              {cols.slice(2).map((c) => (
                <td key={c} className="px-3 py-1.5 text-right text-[var(--color-muted)]">—</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Renders any engine output: elimination trees (winners/losers/grand final),
 * round-robin pairings (optionally per group), Swiss round 1, or a ranking
 * table for event-based formats.
 */
export function MiniBracket({
  preview,
  compact = false,
  className,
  id,
}: {
  preview: PreviewResult;
  compact?: boolean;
  className?: string;
  id?: string;
}) {
  const teams = useMemo(() => new Map(preview.teams.map((t) => [t.id, t])), [preview.teams]);
  const all = useMemo(() => new Map(preview.matches.map((m) => [m.key, m])), [preview.matches]);

  const winners = preview.matches.filter(
    (m) =>
      (m.bracketSide === 'WINNERS' || m.bracketSide === 'FINAL') &&
      !m.isThirdPlace &&
      !m.isPlacement &&
      !m.key.includes('3rd'),
  );
  const losers = preview.matches.filter((m) => m.bracketSide === 'LOSERS');
  const grandFinal = preview.matches.filter((m) => m.bracketSide === 'GRAND_FINAL');
  const third = preview.matches.filter((m) => m.isThirdPlace || m.key.includes('3rd'));
  const swiss = preview.matches.filter((m) => m.bracketSide === 'SWISS');
  const groupMatches = preview.matches.filter((m) => m.bracketSide === 'GROUP');

  const groupsById = new Map<string, EngineGroup>(preview.groups.map((g) => [g.id, g]));
  const groupIds = [...new Set(groupMatches.map((m) => m.groupId ?? 'all'))];

  const isEventFormat =
    preview.format === 'FREE_FOR_ALL' ||
    preview.format === 'LEADERBOARD' ||
    preview.format === 'RACING';

  if (preview.teams.length < 2) {
    return (
      <div className={cn('card flex items-center justify-center p-8 text-sm text-[var(--color-muted)]', className)}>
        Add at least two participants to preview.
      </div>
    );
  }

  return (
    <div id={id} className={cn('space-y-6 overflow-x-auto rounded-xl bg-[var(--color-paper)] p-3 sm:p-4', className)}>
      {isEventFormat && (
        <RankingTable
          teams={preview.teams}
          mode={preview.format === 'RACING' ? 'time' : preview.format === 'FREE_FOR_ALL' ? 'placement' : 'points'}
        />
      )}

      {groupIds.map((gid) => (
        <PairingsList
          key={gid}
          title={groupsById.get(gid)?.name ?? (preview.format === 'ROUND_ROBIN' ? 'Round robin schedule' : 'Group stage')}
          matches={groupMatches.filter((m) => (m.groupId ?? 'all') === gid)}
          teams={teams}
          compact={compact}
        />
      ))}

      {swiss.length > 0 && (
        <PairingsList title="Swiss · round 1 pairings (later rounds pair by record)" matches={swiss} teams={teams} compact={compact} />
      )}

      {winners.length > 0 && (
        <BracketTree
          title={losers.length ? 'Winners bracket' : preview.format === 'GROUPS_KNOCKOUT' ? 'Knockout stage' : undefined}
          matches={winners}
          teams={teams}
          all={all}
          compact={compact}
          labelRounds={roundLabel}
        />
      )}

      {losers.length > 0 && (
        <BracketTree
          title="Losers bracket"
          matches={losers}
          teams={teams}
          all={all}
          compact={compact}
          labelRounds={(r) => `Losers round ${r}`}
        />
      )}

      {(grandFinal.length > 0 || third.length > 0) && (
        <div className="flex flex-wrap gap-6">
          {grandFinal.length > 0 && (
            <div className="w-[176px]">
              <p className="font-display mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                Grand final
              </p>
              <div className="space-y-2">
                {grandFinal.map((m) => (
                  <div key={m.key}>
                    {m.isResetMatch && (
                      <p className="mb-1 text-[10px] text-[var(--color-muted)]">Bracket reset (if needed)</p>
                    )}
                    <MatchBox m={m} teams={teams} all={all} compact={compact} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {third.length > 0 && (
            <div className="w-[176px]">
              <p className="font-display mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                Third place
              </p>
              {third.map((m) => (
                <MatchBox key={m.key} m={m} teams={teams} all={all} compact={compact} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
