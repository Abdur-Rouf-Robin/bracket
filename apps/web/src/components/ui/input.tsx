import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]/50 focus:ring-2 focus:ring-[var(--color-accent)]/35 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[var(--color-danger)]',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
