'use client';

import type { ScheduleConflictDto, ScheduleMatchDto } from '@bracket/shared';
import * as Tooltip from '@radix-ui/react-tooltip';
import { AlertTriangle, GripVertical, Whistle } from './icons';
import { cn } from '@/lib/utils';
import {
  conflictLabel,
  fmtTime,
  roundLabel,
  scoreLine,
  statusClasses,
  teamName,
} from './schedule-shared';

export function TeamLine({
  team,
  score,
  winner,
}: {
  team: { name: string } | null | undefined;
  score?: number | null;
  winner?: boolean;
}) {
  const tbd = !team;
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={cn(
          'truncate text-sm',
          tbd && 'italic text-[var(--color-muted)]',
          winner && 'font-semibold text-[var(--color-ink)]',
        )}
      >
        {teamName(team)}
      </span>
      {score != null && (
        <span className={cn('font-mono text-sm', winner && 'font-bold')}>{score}</span>
      )}
    </div>
  );
}

export function MatchCard({
  match,
  tz,
  conflicts = [],
  showReferee = false,
  showTime = true,
  showStation = false,
  draggable = false,
  onClick,
  className,
  dragHandleProps,
}: {
  match: ScheduleMatchDto;
  tz: string;
  conflicts?: ScheduleConflictDto[];
  showReferee?: boolean;
  showTime?: boolean;
  showStation?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  className?: string;
  dragHandleProps?: Record<string, unknown>;
}) {
  const completed = match.status === 'COMPLETED';
  const score = scoreLine(match);
  const mine = conflicts.filter((c) => c.matchIds.includes(match.id));
  const homeWon = completed && !!match.winnerTeamId && match.winnerTeamId === match.homeTeamId;
  const awayWon = completed && !!match.winnerTeamId && match.winnerTeamId === match.awayTeamId;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group relative rounded-lg border p-2 text-left transition',
        statusClasses(match.status),
        onClick && 'cursor-pointer hover:border-[var(--color-accent)]/70',
        mine.length > 0 && 'ring-1 ring-[var(--color-danger)]/70',
        className,
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
        <span className="flex items-center gap-1 truncate">
          {draggable && (
            <span
              {...dragHandleProps}
              className="-ml-1 cursor-grab text-[var(--color-muted)] hover:text-[var(--color-ink)] active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="size-3.5" />
            </span>
          )}
          <span className="truncate">{roundLabel(match)}</span>
        </span>
        <span className="flex items-center gap-1">
          {showTime && match.scheduledAt && (
            <span className="font-mono text-[var(--color-ink)]">{fmtTime(match.scheduledAt, tz)}</span>
          )}
          {showStation && (match.station?.name || match.stationLabel) && (
            <span className="badge badge-neutral">{match.station?.name ?? match.stationLabel}</span>
          )}
          {mine.length > 0 && (
            <Tooltip.Provider delayDuration={100}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-danger)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-danger)]">
                    <AlertTriangle className="size-3" />
                    {mine.length}
                  </span>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    className="z-50 max-w-xs rounded-md border border-[var(--color-line)] bg-[var(--color-card)] px-2 py-1.5 text-xs text-[var(--color-ink)] shadow-lg"
                  >
                    <ul className="space-y-0.5">
                      {mine.map((c, i) => (
                        <li key={i}>
                          <span className="font-semibold">{conflictLabel(c.kind)}</span> — {c.message}
                        </li>
                      ))}
                    </ul>
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          )}
        </span>
      </div>
      <TeamLine team={match.homeTeam} score={completed ? match.homeScore : undefined} winner={homeWon} />
      <TeamLine team={match.awayTeam} score={completed ? match.awayScore : undefined} winner={awayWon} />
      {(showReferee || score) && (
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--color-muted)]">
          {showReferee && match.referee ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] px-1.5 py-0.5">
              <Whistle className="size-3" />
              {match.referee.name}
            </span>
          ) : (
            <span />
          )}
          {completed && (
            <span className="uppercase tracking-wide">{match.isDraw ? 'Draw' : 'Final'}</span>
          )}
        </div>
      )}
    </div>
  );
}
