import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export type BadgeVariant =
  | 'neutral'
  | 'accent'
  | 'ok'
  | 'warning'
  | 'danger'
  | 'info'
  | 'premier';

export function Badge({
  className,
  variant = 'neutral',
  dot = false,
  live = false,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  dot?: boolean;
  /** Animated ping on the dot — implies `dot`. */
  live?: boolean;
}) {
  return (
    <span className={cn('badge', `badge-${variant}`, className)} {...props}>
      {(dot || live) && (
        <span
          aria-hidden
          className={cn('relative inline-block size-1.5 rounded-full bg-current', live && 'live-dot')}
        />
      )}
      {props.children}
    </span>
  );
}

/** Maps tournament status (+ registration state) to a badge. */
export function tournamentStatusBadge(input: {
  status: string;
  registrationOpen?: boolean;
  hasMatches?: boolean;
}): { label: string; variant: BadgeVariant; live?: boolean } {
  if (input.status === 'COMPLETED') return { label: 'Completed', variant: 'neutral' };
  if (input.status === 'ACTIVE' || (input.hasMatches && input.status !== 'DRAFT')) {
    return { label: 'Live', variant: 'ok', live: true };
  }
  if (input.registrationOpen) return { label: 'Registration open', variant: 'accent' };
  if (input.hasMatches) return { label: 'Live', variant: 'ok', live: true };
  return { label: 'Draft', variant: 'warning' };
}
