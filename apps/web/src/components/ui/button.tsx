import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { ButtonHTMLAttributes, forwardRef } from 'react';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-sm hover:bg-[var(--color-accent-deep)]',
        secondary:
          'border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface-hover)]',
        outline:
          'border border-[var(--color-line-strong)] bg-transparent text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface)]',
        ghost:
          'text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]',
        danger:
          'bg-[var(--color-danger)] text-white hover:brightness-110',
        link: 'h-auto px-0 py-0 text-[var(--color-accent)] underline-offset-4 hover:underline',
        premier:
          'bg-gradient-to-r from-[#f5b83d] to-[#f97316] text-[#1a1000] shadow-sm hover:brightness-105',
      },
      size: {
        sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
        md: 'h-10 px-4 text-sm [&_svg]:size-4',
        lg: 'h-12 px-6 text-base [&_svg]:size-5',
        icon: 'size-9 p-0 [&_svg]:size-4',
        'icon-sm': 'size-8 p-0 [&_svg]:size-3.5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
