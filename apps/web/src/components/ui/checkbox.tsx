'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex size-4.5 shrink-0 items-center justify-center rounded-[4px] border border-[var(--color-line-strong)] bg-[var(--color-surface)] transition disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[var(--color-accent)] data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:text-[var(--color-accent-fg)] data-[state=indeterminate]:border-[var(--color-accent)] data-[state=indeterminate]:bg-[var(--color-accent)] data-[state=indeterminate]:text-[var(--color-accent-fg)]',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      {props.checked === 'indeterminate' ? (
        <Minus className="size-3" strokeWidth={3} />
      ) : (
        <Check className="size-3" strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';
