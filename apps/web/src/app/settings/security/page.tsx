'use client';

import { SettingsShell } from '@/components/account/settings-shell';
import { SecurityPanel } from '@/components/account/security-panel';

export default function SettingsSecurityPage() {
  return (
    <SettingsShell
      title="Security"
      description="Keep your account safe."
    >
      <SecurityPanel />
    </SettingsShell>
  );
}
