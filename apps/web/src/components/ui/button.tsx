import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-50',
          variant === 'primary' &&
            'bg-[var(--color-accent)] text-[#041018] hover:bg-[var(--color-accent-deep)] hover:text-white',
          variant === 'secondary' &&
            'border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-hover)]',
          variant === 'ghost' &&
            'text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]',
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
