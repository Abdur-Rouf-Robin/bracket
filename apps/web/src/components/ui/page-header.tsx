import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-xs text-[var(--color-muted)]', className)}>
      {items.map((c, i) => (
        <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3 opacity-60" aria-hidden />}
          {c.href ? (
            <Link href={c.href} className="hover:text-[var(--color-ink)]">
              {c.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-[var(--color-ink)]">
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  crumbs,
  className,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  crumbs?: Crumb[];
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      {crumbs && crumbs.length > 0 && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-display mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-[var(--color-muted)]">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
