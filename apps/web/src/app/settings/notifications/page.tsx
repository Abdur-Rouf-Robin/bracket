'use client';

import Link from 'next/link';
import { SettingsShell } from '@/components/account/settings-shell';
import { InboxList } from '@/components/account/inbox-list';
import { NotificationPreferences } from '@/components/account/notification-preferences';

export default function SettingsNotificationsPage() {
  return (
    <SettingsShell
      title="Notifications"
      description="Registration updates, match comments and host alerts."
    >
      <div className="space-y-6">
        <section className="gaming-card rounded-2xl p-6">
          <h2 className="font-display text-lg font-semibold">Channels</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            These choices are saved to your account. Password reset and email
            verification always send.
          </p>
          <div className="mt-3">
            <NotificationPreferences />
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent</h2>
            <Link href="/inbox" className="text-sm text-[var(--color-accent)] hover:underline">
              Open full inbox →
            </Link>
          </div>
          <InboxList compact pageSize={10} />
        </section>
      </div>
    </SettingsShell>
  );
}
