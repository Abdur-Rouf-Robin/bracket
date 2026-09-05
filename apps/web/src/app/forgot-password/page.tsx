'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-display text-3xl font-bold">Forgot your password?</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Enter the email on your account and we&apos;ll send you a link to choose a
          new password. The link is valid for one hour.
        </p>

        {sent ? (
          <div className="gaming-card mt-8 rounded-xl p-5 text-sm">
            <p className="font-semibold">Check your inbox</p>
            <p className="mt-1 text-[var(--color-muted)]">
              If an account exists for <span className="text-[var(--color-ink)]">{email}</span>,
              a reset link is on its way. Didn&apos;t get it? Check spam or{' '}
              <button
                type="button"
                className="text-[var(--color-accent)] hover:underline"
                onClick={() => setSent(false)}
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Remembered it?{' '}
          <Link href="/login" className="text-[var(--color-accent)]">
            Back to sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
