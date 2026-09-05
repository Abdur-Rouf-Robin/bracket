'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center gap-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-1 text-[var(--color-muted)]',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[var(--color-card)] data-[state=active]:text-[var(--color-ink)] data-[state=active]:shadow-sm hover:text-[var(--color-ink)]',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-4 outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';
