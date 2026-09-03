import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] ring-[var(--color-accent)] focus:border-[var(--color-accent)]/50 focus:ring-2',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
