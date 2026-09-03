'use client';

import Link from 'next/link';
import type { MainTab, NavItem } from '@/lib/tournament-nav';
import { navHref } from '@/lib/tournament-nav';

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

  return (
    <nav className="mt-8 space-y-3" aria-label="Tournament sections">
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-line)] pb-px">
        {items.map((item) => {
          const isActive = item.id === activeTab;
          const href = navHref(
            basePath,
            item.id,
            item.subs?.[0]?.id,
          );
          return (
            <Link
              key={item.id}
              href={href}
              className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'border border-b-0 border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-ink)]'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {subs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {subs.map((sub) => {
            const isActive = activeSub === sub.id;
            return (
              <Link
                key={sub.id}
                href={navHref(basePath, activeTab, sub.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-[var(--color-accent)] text-[#0a0c10]'
                    : 'border border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
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
