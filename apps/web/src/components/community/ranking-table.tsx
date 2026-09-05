'use client';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { RankingEntry } from '@/lib/types-platform';
import { cn } from '@/lib/utils';
import { formatDate, initialsOf } from './types';

function rankTone(rank: number | undefined) {
  if (rank === 1) return 'text-amber-300';
  if (rank === 2) return 'text-slate-300';
  if (rank === 3) return 'text-orange-300';
  return 'text-[var(--color-muted)]';
}

export function RankingTable({
  entries,
  onSelect,
  selectedId,
  compact,
}: {
  entries: RankingEntry[];
  onSelect?: (entry: RankingEntry) => void;
  selectedId?: string | null;
  compact?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-muted)]">
        No rated players yet. Ratings appear once matches in assigned tournaments are completed.
      </p>
    );
  }
  return (
    <div className="panel-card overflow-x-auto rounded-xl">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
            <th className="px-3 py-2.5 font-semibold">#</th>
            <th className="px-3 py-2.5 font-semibold">Player / team</th>
            <th className="px-3 py-2.5 text-right font-semibold">Rating</th>
            <th className="px-3 py-2.5 text-center font-semibold">W-L-D</th>
            {!compact && (
              <>
                <th className="px-3 py-2.5 text-right font-semibold">Matches</th>
                <th className="px-3 py-2.5 text-right font-semibold">Peak</th>
                <th className="px-3 py-2.5 text-right font-semibold">Last played</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const name = e.user?.name ?? e.displayName;
            const trend =
              e.rating > e.peakRating - 0.01
                ? 'peak'
                : e.rating < e.peakRating - 50
                  ? 'down'
                  : 'flat';
            return (
              <tr
                key={e.id}
                onClick={onSelect ? () => onSelect(e) : undefined}
                className={cn(
                  'border-b border-[var(--color-line)]/60 last:border-0',
                  onSelect && 'cursor-pointer hover:bg-[var(--color-surface-hover)]',
                  selectedId === e.id && 'bg-[var(--color-accent)]/10',
                )}
              >
                <td className={cn('px-3 py-2.5 font-mono font-bold', rankTone(e.rank))}>
                  {e.rank ?? '—'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface)] text-xs font-bold">
                      {e.user?.avatarUrl ? (
                        <img src={e.user.avatarUrl} alt="" className="size-full object-cover" />
                      ) : (
                        initialsOf(name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{name}</p>
                      {e.user?.username && (
                        <p className="truncate text-xs text-[var(--color-muted)]">
                          @{e.user.username}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="inline-flex items-center gap-1 font-mono text-base font-bold">
                    {Math.round(e.rating)}
                    {trend === 'peak' ? (
                      <TrendingUp className="size-3.5 text-[var(--color-ok)]" />
                    ) : trend === 'down' ? (
                      <TrendingDown className="size-3.5 text-[var(--color-danger)]" />
                    ) : (
                      <Minus className="size-3.5 text-[var(--color-muted)]" />
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center font-mono text-xs">
                  <span className="text-[var(--color-ok)]">{e.wins}</span>-
                  <span className="text-[var(--color-danger)]">{e.losses}</span>-
                  <span className="text-[var(--color-muted)]">{e.draws}</span>
                </td>
                {!compact && (
                  <>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{e.matchesPlayed}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {Math.round(e.peakRating)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-[var(--color-muted)]">
                      {formatDate(e.lastPlayedAt)}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RankingTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="panel-card animate-pulse space-y-2 rounded-xl p-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-4 w-6 rounded bg-[var(--color-surface)]" />
          <div className="size-8 rounded-full bg-[var(--color-surface)]" />
          <div className="h-4 flex-1 rounded bg-[var(--color-surface)]" />
          <div className="h-4 w-12 rounded bg-[var(--color-surface)]" />
        </div>
      ))}
    </div>
  );
}
