'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import {
  Bell,
  Code2,
  CreditCard,
  ShieldCheck,
  UserCircle2,
  UserCog,
} from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/settings/profile', label: 'Profile', icon: UserCircle2, hint: 'Name, username, avatar' },
  { href: '/settings/account', label: 'Account', icon: UserCog, hint: 'Email, timezone, locale' },
  { href: '/settings/security', label: 'Security', icon: ShieldCheck, hint: 'Password, delete account' },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell, hint: 'Your inbox' },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard, hint: 'Plan & invoices' },
  { href: '/settings/developer', label: 'Developer', icon: Code2, hint: 'API keys & webhooks' },
];

export function SettingsShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname ?? '/settings')}`);
    }
  }, [loading, user, router, pathname]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Settings
          </p>
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
          )}
        </div>
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <nav className="md:sticky md:top-24 md:self-start">
            <ul className="flex gap-1 overflow-x-auto md:flex-col">
              {NAV.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href === '/settings/profile' && pathname === '/settings');
                const Icon = item.icon;
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition',
                        active
                          ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-ink)]'
                          : 'border-transparent text-[var(--color-muted)] hover:border-[var(--color-line)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]',
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>
                        <span className="block font-medium">{item.label}</span>
                        <span className="hidden text-[11px] text-[var(--color-muted)] md:block">
                          {item.hint}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <section className="min-w-0">
            {loading || !user ? (
              <p className="text-sm text-[var(--color-muted)]">Loading…</p>
            ) : (
              children
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
