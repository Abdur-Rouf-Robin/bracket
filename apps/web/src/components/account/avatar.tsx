'use client';

import { initialsFor } from '@bracket/shared';
import { cn } from '@/lib/utils';

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const dims =
    size === 'sm'
      ? 'size-8 text-xs'
      : size === 'lg'
        ? 'size-16 text-xl'
        : size === 'xl'
          ? 'size-24 text-3xl'
          : 'size-10 text-sm';
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn('rounded-full border border-[var(--color-line)] object-cover', dims, className)}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-[var(--color-accent)]/15 font-display font-bold text-[var(--color-accent)]',
        dims,
        className,
      )}
    >
      {initialsFor(name)}
    </span>
  );
}
