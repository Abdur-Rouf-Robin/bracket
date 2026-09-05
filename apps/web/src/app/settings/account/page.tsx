'use client';

import { SettingsShell } from '@/components/account/settings-shell';
import { AccountPanel } from '@/components/account/account-panel';

export default function SettingsAccountPage() {
  return (
    <SettingsShell
      title="Account"
      description="Email verification, timezone and language."
    >
      <AccountPanel />
    </SettingsShell>
  );
}
