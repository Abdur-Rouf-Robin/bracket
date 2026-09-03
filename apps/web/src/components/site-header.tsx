'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

export function SiteHeader() {
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showUser = mounted && user;

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link
          href="/"
          className="font-display text-xl font-bold tracking-tight text-[var(--color-ink)]"
        >
          <span className="text-[var(--color-accent)]">Bracket</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium sm:gap-4">
          <Link
            href="/sports/football"
            className="hidden rounded-md px-3 py-1.5 text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] sm:inline"
          >
            Football
          </Link>
          <Link
            href="/sports/cricket"
            className="hidden rounded-md px-3 py-1.5 text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] sm:inline"
          >
            Cricket
          </Link>
          <Link
            href="/browse"
            className="rounded-md px-3 py-1.5 text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
          >
            Browse
          </Link>
          {showUser ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
              >
                Dashboard
              </Link>
              <Link
                href="/tournaments/new"
                className="rounded-md px-3 py-1.5 text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
              >
                New
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-md px-3 py-1.5 text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 font-semibold text-[#041018] transition hover:bg-[var(--color-accent-deep)] hover:text-white"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
