'use client';

import { SettingsShell } from '@/components/account/settings-shell';
import { DeveloperSettings } from '@/components/developer/developer-settings';

export default function SettingsDeveloperPage() {
  return (
    <SettingsShell
      title="Developer"
      description="API keys, webhooks and access to the public REST API."
    >
      <DeveloperSettings />
    </SettingsShell>
  );
}
