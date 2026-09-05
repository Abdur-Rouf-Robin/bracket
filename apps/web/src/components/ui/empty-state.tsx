import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'card flex flex-col items-center justify-center border-dashed text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-accent)] ring-1 ring-[var(--color-line)]">
          <Icon className="size-5" aria-hidden />
        </div>
      )}
      <h3 className="font-display text-base font-bold">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">{description}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
