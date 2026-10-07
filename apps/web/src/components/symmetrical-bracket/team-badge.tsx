'use client';

import type { Team } from '@/lib/types';
import { hashTeamColor, teamInitials, teamColor } from '@/lib/team-display';

export { hashTeamColor, teamInitials, teamColor };

export function TeamBadge({
  team,
  size = 'md',
  compact = false,
  showSeed = false,
  onDark = false,
}: {
  team: Team | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
  /** Prefix the name with the seed number (honours `hideSeedNumbers` upstream). */
  showSeed?: boolean;
  /** Bracket cards are always dark, even when the rest of the site is light. */
  onDark?: boolean;
}) {
  const name = team?.name ?? 'TBD';
  const bg = teamColor(team ?? { id: '', name, seed: null, groupId: null, poolColor: null });
  const dim =
    size === 'sm' ? 'size-6 text-[9px]' : size === 'lg' ? 'size-10 text-sm' : 'size-8 text-[10px]';

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div
        className={`${dim} flex shrink-0 items-center justify-center rounded border border-white/15 font-bold text-white shadow-sm`}
        style={{ backgroundColor: bg }}
        title={name}
      >
        {team ? teamInitials(name) : '?'}
      </div>
      {!compact && (
        <span
          className={`truncate text-[11px] font-medium leading-tight ${
            onDark ? 'text-[#e8eaef]' : 'text-[var(--color-ink)]'
          }`}
        >
          {showSeed && team?.seed != null && (
            <span className={`mr-1 text-[9px] ${onDark ? 'text-[#9aa3b5]' : 'text-[var(--color-muted)]'}`}>
              {team.seed}
            </span>
          )}
          {name}
        </span>
      )}
    </div>
  );
}
