'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

export function MustChangePasswordBanner() {
  const { user } = useAuth();
  const pathname = usePathname() ?? '';
  if (!user?.mustChangePassword) return null;
  if (pathname.startsWith('/settings/security')) return null;

  return (
    <div
      role="alert"
      className="border-b border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--color-danger)]" />
          <span>
            This account still uses the public demo password. Change it before you run a real
            event.
          </span>
        </p>
        <Button size="sm" asChild>
          <Link href="/settings/security">Change password</Link>
        </Button>
      </div>
    </div>
  );
}
