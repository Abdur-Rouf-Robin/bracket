import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** Header + footer wrapper used by every marketing / public page. */
export function MarketingShell({
  children,
  className,
  mainClassName,
}: {
  children: ReactNode;
  className?: string;
  mainClassName?: string;
}) {
  return (
    <div className={cn('flex min-h-screen flex-col', className)}>
      <SiteHeader />
      <main className={cn('flex-1', mainClassName)}>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow && (
        <p className="font-display mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
      {description && (
        <p className="mt-3 text-base text-[var(--color-muted)] md:text-lg">{description}</p>
      )}
    </div>
  );
}
