'use client';

import { SettingsShell } from '@/components/account/settings-shell';
import { ProfileForm } from '@/components/account/profile-form';

export default function SettingsProfilePage() {
  return (
    <SettingsShell
      title="Profile"
      description="How you appear to other players and hosts."
    >
      <ProfileForm />
    </SettingsShell>
  );
}
