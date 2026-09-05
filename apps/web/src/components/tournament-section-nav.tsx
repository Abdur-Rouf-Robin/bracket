'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { MainTab, NavItem } from '@/lib/tournament-nav';
import { navHref } from '@/lib/tournament-nav';
import { cn } from '@/lib/utils';

export function TournamentSectionNav({
  basePath,
  items,
  activeTab,
  activeSub,
}: {
  basePath: string;
  items: NavItem[];
  activeTab: MainTab;
  activeSub: string;
}) {
  const current = items.find((i) => i.id === activeTab);
  const subs = current?.subs ?? [];
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep the active tab visible when the row overflows on small screens.
  useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeTab]);

  return (
    <nav
      className="no-print sticky top-16 z-30 -mx-4 mt-6 border-b border-[var(--color-line)] bg-[var(--color-paper)]/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-paper)]/70 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-t-xl lg:px-0"
      aria-label="Tournament sections"
    >
      <div
        ref={scrollerRef}
        className="scrollbar-none -mb-px flex gap-1 overflow-x-auto"
        role="tablist"
      >
        {items.map((item) => {
          const isActive = item.id === activeTab;
          const href = navHref(basePath, item.id, item.subs?.[0]?.id);
          return (
            <Link
              key={item.id}
              href={href}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative shrink-0 whitespace-nowrap px-3 py-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset sm:px-4',
                isActive
                  ? 'text-[var(--color-ink)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]',
              )}
            >
              {item.label}
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--color-accent)] transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
              />
            </Link>
          );
        })}
      </div>

      {subs.length > 1 && (
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto py-2" role="tablist" aria-label={`${current?.label} sections`}>
          {subs.map((sub) => {
            const isActive = activeSub === sub.id;
            return (
              <Link
                key={sub.id}
                href={navHref(basePath, activeTab, sub.id)}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                  isActive
                    ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                    : 'border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-ink)]',
                )}
              >
                {sub.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
