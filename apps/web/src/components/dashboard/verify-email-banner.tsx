'use client';

import { useState } from 'react';
import { MailWarning, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function VerifyEmailBanner() {
  const { user, token } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerified !== false || dismissed) return null;

  async function resend() {
    setSending(true);
    try {
      await api('/account/verification/send', { method: 'POST', token });
      setSent(true);
      toast.success(`Verification email sent to ${user?.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send verification email');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="status"
      className="relative flex flex-col gap-3 rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-4 py-3 text-sm sm:flex-row sm:items-center"
    >
      <MailWarning className="size-5 shrink-0 text-[var(--color-warning)]" aria-hidden />
      <div className="flex-1">
        <p className="font-semibold">Verify your email address</p>
        <p className="text-xs text-[var(--color-muted)]">
          We sent a link to <span className="font-medium text-[var(--color-ink)]">{user.email}</span>. Verifying unlocks
          notifications, registrations and password recovery.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={resend} loading={sending} disabled={sent}>
        {sent ? 'Sent' : 'Resend email'}
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)] sm:static"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
