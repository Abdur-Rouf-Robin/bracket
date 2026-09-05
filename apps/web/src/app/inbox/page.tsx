'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SiteHeader } from '@/components/site-header';
import { InboxList } from '@/components/account/inbox-list';
import { useAuth } from '@/lib/auth';

export default function InboxPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/inbox');
  }, [loading, user, router]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Inbox</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Everything that needs your attention, in one place.
            </p>
          </div>
          <Link
            href="/settings/notifications"
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            Notification settings
          </Link>
        </div>
        {loading || !user ? (
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        ) : (
          <InboxList />
        )}
      </main>
    </div>
  );
}
