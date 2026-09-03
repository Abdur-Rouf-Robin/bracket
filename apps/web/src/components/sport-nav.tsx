'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SPORTS = [
  { href: '/', label: 'Brackets', match: (p: string) => p === '/' || p.startsWith('/t/') || p.startsWith('/tournaments') || p.startsWith('/dashboard') || p.startsWith('/browse') },
  { href: '/sports/football', label: 'Football', match: (p: string) => p.startsWith('/sports/football') },
  { href: '/sports/cricket', label: 'Cricket', match: (p: string) => p.startsWith('/sports/cricket') || p.includes('/scoreboard/') },
] as const;

export function SportNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label="Sport modes"
      className="border-b border-[var(--color-line)] bg-[var(--color-surface)]/80"
    >
      <div className="mx-auto flex max-w-6xl gap-1 px-6 py-2">
        {SPORTS.map((s) => {
          const active = s.match(pathname);
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
                active
                  ? 'bg-[var(--color-accent)] text-[#041018]'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-ink)]'
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
