import { cn } from '@/lib/utils';
import { TextareaHTMLAttributes, forwardRef } from 'react';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-24 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]/50 focus:ring-2 focus:ring-[var(--color-accent)]/35 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[var(--color-danger)]',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
