import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { Skeleton } from './skeleton';

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  loading = false,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: 'default' | 'accent' | 'ok' | 'warning';
  loading?: boolean;
  className?: string;
}) {
  const toneClass =
    tone === 'accent'
      ? 'text-[var(--color-accent)]'
      : tone === 'ok'
        ? 'text-[var(--color-ok)]'
        : tone === 'warning'
          ? 'text-[var(--color-warning)]'
          : 'text-[var(--color-muted)]';
  return (
    <div className={cn('card flex items-start gap-3 p-4', className)}>
      {Icon && (
        <span
          className={cn(
            'mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface)] ring-1 ring-[var(--color-line)]',
            toneClass,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {label}
        </p>
        {loading ? (
          <Skeleton className="mt-1.5 h-7 w-16" />
        ) : (
          <p className="font-display mt-0.5 text-2xl font-bold tabular-nums leading-none">
            {value}
          </p>
        )}
        {hint && <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>}
      </div>
    </div>
  );
}
