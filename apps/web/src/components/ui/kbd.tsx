import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-1.5 font-mono text-[10px] font-semibold text-[var(--color-muted)] shadow-[inset_0_-1px_0_var(--color-line-strong)]',
        className,
      )}
      {...props}
    />
  );
}
