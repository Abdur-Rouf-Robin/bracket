import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton h-4 w-full', className)} {...props} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('card p-5', className)} aria-hidden>
      <Skeleton className="h-5 w-1/2" />
      <SkeletonText lines={2} className="mt-3" />
    </div>
  );
}
