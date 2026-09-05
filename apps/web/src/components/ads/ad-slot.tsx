import Link from 'next/link';
import { cn } from '@/lib/utils';

type Plan = 'FREE' | 'PREMIER' | null | undefined;

/**
 * Ad placeholder for the ad-supported Standard tier. Renders only when ads are
 * enabled via NEXT_PUBLIC_ADS_ENABLED and the viewer is on the FREE plan.
 */
export function AdSlot({
  plan,
  size = 'rect',
  className,
}: {
  plan: Plan;
  size?: 'rect' | 'leaderboard' | 'skyscraper';
  className?: string;
}) {
  const enabled = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';
  if (!enabled) return null;
  if (plan === 'PREMIER') return null;

  const dims =
    size === 'leaderboard'
      ? 'h-[90px] w-full max-w-[728px]'
      : size === 'skyscraper'
        ? 'h-[600px] w-[160px]'
        : 'h-[250px] w-full max-w-[300px]';

  return (
    <aside
      aria-label="Advertisement"
      className={cn(
        'no-print flex flex-col items-center gap-1 text-center',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)]/60 text-xs text-[var(--color-muted)]',
          dims,
        )}
      >
        <span className="badge badge-neutral">Ad</span>
      </div>
      <Link
        href="/pricing"
        className="text-[11px] text-[var(--color-muted)] underline-offset-2 hover:text-[var(--color-ink)] hover:underline"
      >
        Remove ads with Premier
      </Link>
    </aside>
  );
}
