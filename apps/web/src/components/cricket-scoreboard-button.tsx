'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

export function CricketScoreboardButton({
  slug,
  matchId,
  className,
  fullWidth = false,
}: {
  slug: string;
  matchId: string;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <Link
      href={`/t/${slug}/scoreboard/${matchId}`}
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#041018] transition hover:bg-[var(--color-accent-deep)] hover:text-white',
        fullWidth && 'w-full',
        className,
      )}
    >
      Go to scoreboard
    </Link>
  );
}
