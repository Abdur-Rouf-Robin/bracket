'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-1 scrollbar-none',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition disabled:opacity-50',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              active
                ? 'bg-[var(--color-card)] text-[var(--color-ink)] shadow-sm ring-1 ring-[var(--color-line)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]',
            )}
          >
            {opt.label}
            {typeof opt.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] tabular-nums',
                  active
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                    : 'bg-[var(--color-progress)] text-[var(--color-muted)]',
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
